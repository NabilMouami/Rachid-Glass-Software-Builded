const { Devis, DevisItem, Client, Produit, Facture, FactureItem, BonLivraison, BonLivraisonProduit } = require("../models");
const { Op } = require("sequelize");

const PDFDocument = require("pdfkit");
const fs = require("fs");

const generateDevisNumber = async () => {
  const prefix = "DV";
  const lastDevis = await Devis.findOne({
    where: {
      devisNumber: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastDevis) {
    const lastNum = lastDevis.devisNumber;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
};

const createDevis = async (req, res) => {
  console.log("🚀 CREATE DEVIS - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await Devis.sequelize.transaction();

  try {
    const {
      clientId,
      customerName,
      customerPhone,
      issueDate,
      validUntil,
      notes,
      items,
      status,
      discountType,
      discountValue,
      discountAmount,
      subTotal,
      preparedBy,
    } = req.body;

    // ─── Validation ────────────────────────────────────────
    if (!customerName || customerName.trim() === "") {
      return res.status(400).json({ message: "Nom du client requis" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Le devis doit contenir au moins un article" });
    }

    // Generate number
    const devisNumber = await generateDevisNumber();

    // Prepare line items
    const preparedItems = items.map((item) => ({
      produit_id: item.productId || null,
      quantite: parseFloat(item.quantity) || 1,
      v1: parseFloat(item.v1) || 1,
      v2: parseFloat(item.v2) || 1,
      prix_unitaire: parseFloat(item.unitPrice) || 0,
      total_ligne: parseFloat(item.totalPrice) || 0,
      remise_ligne: 0,
      articleName: item.articleName || null,
    }));

    // Calculate totals (fallback if frontend didn't send them)
    const calculatedSubTotal =
      subTotal ||
      preparedItems.reduce((sum, it) => sum + (it.total_ligne || 0), 0);

    const calculatedDiscount =
      discountAmount ||
      (discountType === "percentage"
        ? (calculatedSubTotal * (discountValue || 0)) / 100
        : discountValue || 0);

    const calculatedTotal = Math.max(
      0,
      calculatedSubTotal - calculatedDiscount,
    );

    // Create main Devis record
    const devis = await Devis.create(
      {
        devisNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone?.trim() || null,
        issueDate: issueDate || new Date(),
        validUntil: validUntil || null,
        notes: notes || null,
        status: status || "brouillon",
        discountType: discountType || "fixed",
        discountValue: discountValue || 0,
        discountAmount: calculatedDiscount,
        subTotal: calculatedSubTotal,
        total: calculatedTotal,
        client_id: clientId || null,
        preparedBy: preparedBy || null,
      },
      { transaction },
    );

    // Create line items
    const devisItems = await Promise.all(
      preparedItems.map(async (item) =>
        DevisItem.create(
          {
            ...item,
            devis_id: devis.id,
          },
          { transaction },
        ),
      ),
    );

    await transaction.commit();

    // Fetch complete object with relations
    const completeDevis = await Devis.findByPk(devis.id, {
      include: [
        {
          model: DevisItem,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        {
          model: Client,
          as: "client",
        },
      ],
    });

    return res.status(201).json({
      message: "Devis créé avec succès",
      devis: completeDevis,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("❌ CREATE DEVIS ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Numéro de devis déjà utilisé" });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: "Erreur de validation",
        errors: err.errors.map((e) => e.message),
      });
    }

    return res.status(500).json({
      message: "Erreur serveur lors de la création du devis",
      error: err.message,
    });
  }
};

const getDevis = async (req, res) => {
  try {
    const devis = await Devis.findAll({
      attributes: {
        exclude: ["pdfPath", "pdfUploadedAt"], // Temporarily exclude these fields
      },
      include: [{ model: DevisItem, as: "lignes" }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(devis);
  } catch (err) {
    console.error("Get devis error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getDevisById = async (req, res) => {
  try {
    const devis = await Devis.findByPk(req.params.id, {
      include: [
        {
          model: DevisItem,
          as: "lignes",
          include: [
            {
              model: Produit, // Import Produit at the top of your file
              as: "produit", // This should match the association name in your DevisItem model
            },
          ],
        },
        { model: Client, as: "client" }, // If you have client association
      ],
    });

    if (!devis) return res.status(404).json({ message: "Devis not found" });

    return res.json(devis);
  } catch (err) {
    console.error("Get devis error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
const updateDevis = async (req, res) => {
  const transaction = await Devis.sequelize.transaction();

  try {
    const devis = await Devis.findByPk(req.params.id, {
      include: [{ model: DevisItem, as: "lignes" }],
    });

    if (!devis) {
      return res.status(404).json({ message: "Devis not found" });
    }

    const {
      customerName,
      customerPhone,
      issueDate,
      validUntil,
      notes,
      lignes,
      status,
      discountType,
      discountValue,
      subTotal,
      total,
      discountAmount,
    } = req.body;

    console.log("📝 Update devis request for ID:", req.params.id);
    console.log("📦 Received data:", JSON.stringify(req.body, null, 2));

    // Update devis fields - only if provided
    const updateFields = {};

    if (customerName !== undefined)
      updateFields.customerName = customerName.trim();
    if (customerPhone !== undefined) updateFields.customerPhone = customerPhone;
    if (issueDate !== undefined) updateFields.issueDate = issueDate;
    if (validUntil !== undefined) updateFields.validUntil = validUntil;
    if (notes !== undefined) updateFields.notes = notes;
    if (status !== undefined) updateFields.status = status;
    if (discountType !== undefined) updateFields.discountType = discountType;
    if (discountValue !== undefined)
      updateFields.discountValue = parseFloat(discountValue) || 0;
    if (subTotal !== undefined)
      updateFields.subTotal = parseFloat(subTotal) || 0;
    if (total !== undefined) updateFields.total = parseFloat(total) || 0;
    if (discountAmount !== undefined)
      updateFields.discountAmount = parseFloat(discountAmount) || 0;

    // Apply updates
    Object.keys(updateFields).forEach((key) => {
      devis[key] = updateFields[key];
    });

    await devis.save({ transaction });
    console.log("✅ Devis updated successfully");

    // Update lignes if provided
    if (lignes && Array.isArray(lignes)) {
      console.log(`📦 Processing ${lignes.length} ligne items...`);

      // Get existing ligne IDs from request (excluding temp IDs)
      const receivedIds = lignes
        .filter((l) => l.id && !String(l.id).startsWith("temp-"))
        .map((l) => parseInt(l.id));

      // Get existing IDs from database
      const existingIds = devis.lignes.map((l) => l.id);

      // Delete lignes that are not in the new list
      const toDelete = existingIds.filter((id) => !receivedIds.includes(id));

      if (toDelete.length > 0) {
        const deletedCount = await DevisItem.destroy({
          where: { id: toDelete },
          transaction,
        });
        console.log(`✅ Deleted ${deletedCount} ligne items`);
      }

      // Update or create lignes
      for (let index = 0; index < lignes.length; index++) {
        const ligne = lignes[index];

        // Validate required fields
        if (!ligne.articleName && !ligne.designation) {
          console.log(
            `⚠️ Ligne ${index} has no article name/designation, using default`,
          );
        }

        // Calculate total_ligne if not provided
        const quantity = parseFloat(ligne.quantite) || 1;
        const v1 = parseFloat(ligne.v1) || 1;
        const v2 = parseFloat(ligne.v2) || 1;
        const prix_unitaire = parseFloat(ligne.prix_unitaire) || 0;

        const calculatedTotalLigne = quantity * v1 * v2 * prix_unitaire;
        const totalLigne =
          parseFloat(ligne.total_ligne) || calculatedTotalLigne;

        const ligneData = {
          articleName:
            ligne.articleName || ligne.designation || "Nouvel article",
          quantite: quantity,
          v1: v1,
          v2: v2,
          v3: 1, // Default v3 if not provided
          prix_unitaire: prix_unitaire,
          total_ligne: totalLigne,
          remise_ligne: parseFloat(ligne.remise_ligne) || 0,
          produit_id: ligne.produit_id || null,
          devis_id: devis.id,
        };

        console.log(`🔄 Processing ligne ${index}:`, {
          id: ligne.id || "new",
          articleName: ligneData.articleName,
          quantite: ligneData.quantite,
          total_ligne: ligneData.total_ligne,
        });

        if (ligne.id && !String(ligne.id).toString().startsWith("temp-")) {
          // Update existing ligne
          const [updatedCount] = await DevisItem.update(ligneData, {
            where: { id: ligne.id },
            transaction,
          });

          if (updatedCount > 0) {
            console.log(`✅ Updated existing ligne ID: ${ligne.id}`);
          } else {
            console.log(`⚠️ No changes for ligne ID: ${ligne.id}`);
          }
        } else {
          // Create new ligne
          const newLigne = await DevisItem.create(ligneData, { transaction });
          console.log(`✅ Created new ligne with ID: ${newLigne.id}`);
        }
      }
    } else {
      console.log("ℹ️ No lignes provided for update");
    }

    await transaction.commit();
    console.log("🎉 Transaction committed successfully");

    // Reload with relations
    const updatedDevis = await Devis.findByPk(devis.id, {
      include: [
        {
          model: DevisItem,
          as: "lignes",
          include: [{ model: Produit, as: "produit" }],
        },
        { model: Client, as: "client" },
      ],
    });

    // Recalculate totals on the updated devis to ensure consistency
    if (updatedDevis.lignes && updatedDevis.lignes.length > 0) {
      const calculatedSubTotal = updatedDevis.lignes.reduce(
        (sum, item) => sum + (parseFloat(item.total_ligne) || 0),
        0,
      );

      const calculatedDiscount =
        updatedDevis.discountType === "percentage"
          ? (calculatedSubTotal * (updatedDevis.discountValue || 0)) / 100
          : updatedDevis.discountValue || 0;

      const calculatedTotal = Math.max(
        0,
        calculatedSubTotal - calculatedDiscount,
      );

      // Update if there's a discrepancy
      if (
        Math.abs(calculatedSubTotal - (updatedDevis.subTotal || 0)) > 0.01 ||
        Math.abs(calculatedTotal - (updatedDevis.total || 0)) > 0.01
      ) {
        console.log("📊 Updating totals to match calculated values");
        updatedDevis.subTotal = calculatedSubTotal;
        updatedDevis.discountAmount = calculatedDiscount;
        updatedDevis.total = calculatedTotal;
        await updatedDevis.save();
      }
    }

    return res.json({
      success: true,
      message: "Devis updated successfully",
      devis: updatedDevis,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Update devis error:", err);
    console.error("❌ Error stack:", err.stack);

    if (err.errors) {
      console.error(
        "❌ Validation errors:",
        err.errors.map((e) => ({
          field: e.path,
          message: e.message,
          value: e.value,
          type: e.type,
        })),
      );
    }

    // Handle specific error types
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Devis number already exists",
        error: err.message,
      });
    }

    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => error.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Invalid foreign key reference",
        error: "The product or client referenced does not exist",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

const updateDevisStatus = async (req, res) => {
  try {
    const devis = await Devis.findByPk(req.params.id);
    if (!devis) return res.status(404).json({ message: "Devis not found" });

    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    devis.status = status;
    await devis.save();

    return res.json({
      message: "Devis status updated successfully",
      devis,
    });
  } catch (err) {
    console.error("Update devis status error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getDevisPDF = async (req, res) => {
  try {
    const devis = await Devis.findByPk(req.params.id, {
      include: [{ model: DevisItem, as: "items" }],
    });
    if (!devis) return res.status(404).json({ message: "Devis not found" });

    // For now, return JSON data - you can integrate PDF generation later
    return res.json({
      message: "PDF endpoint - integrate PDF generation here",
      devis,
    });
  } catch (err) {
    console.error("Get devis PDF error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const deleteDevis = async (req, res) => {
  try {
    const devis = await Devis.findByPk(req.params.id);
    if (!devis) return res.status(404).json({ message: "Devis not found" });

    await devis.destroy();
    return res.json({ message: "Devis deleted successfully" });
  } catch (err) {
    console.error("Delete devis error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const uploadDevisPDF = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const devis = await Devis.findByPk(id);
    if (!devis) {
      // Delete the uploaded file if devis not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Devis not found" });
    }

    // Delete old PDF if exists
    if (devis.pdfPath && fs.existsSync(devis.pdfPath)) {
      fs.unlinkSync(devis.pdfPath);
    }

    // Update devis with PDF path
    devis.pdfPath = req.file.path;
    devis.pdfUploadedAt = new Date();
    await devis.save();

    return res.json({
      message: "PDF uploaded successfully",
      pdfPath: req.file.path,
      filename: req.file.filename,
    });
  } catch (err) {
    console.error("Upload PDF error:", err);

    // Delete the uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      message: "Server error during PDF upload",
      error: err.message,
    });
  }
};
const generateDevisPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const devis = await Devis.findByPk(id, {
      include: [{ model: DevisItem, as: "items" }],
    });

    if (!devis) {
      return res.status(404).json({ message: "Devis not found" });
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=devis-${devis.devisNumber}.pdf`,
    );

    doc.pipe(res);

    // ===== HEADER =====
    doc.rect(0, 0, doc.page.width, 100).fill("#1a73e8");
    doc
      .fillColor("white")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("DEVIS", 50, 40);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`N°: ${devis.devisNumber}`, 450, 40)
      .text(
        `Date: ${
          devis.issueDate
            ? new Date(devis.issueDate).toLocaleDateString("fr-FR")
            : "-"
        }`,
        450,
        60,
      );

    doc.moveDown(3);

    // ===== CLIENT INFO =====
    doc
      .fillColor("#333")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Informations du client", 50, 130);
    doc.moveTo(50, 145).lineTo(550, 145).strokeColor("#1a73e8").stroke();

    doc
      .font("Helvetica")
      .fontSize(12)
      .text(`Nom du client : ${devis.customerName}`, 50, 160)
      .text(`Téléphone : ${devis.customerPhone || "—"}`, 50, 180);

    doc.moveDown(2);

    // ===== ITEMS TABLE =====
    const tableTop = 220;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1a73e8")
      .text("Article", 50, tableTop)
      .text("Quantité", 250, tableTop)
      .text("Prix Unitaire", 350, tableTop)
      .text("Total", 470, tableTop);

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .strokeColor("#ccc")
      .stroke();

    let yPosition = tableTop + 25;
    doc.font("Helvetica").fontSize(12).fillColor("#000");

    let subTotal = 0;

    devis.items.forEach((item, i) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const total = qty * price;
      subTotal += total;

      doc.text(item.articleName || `Article ${i + 1}`, 50, yPosition);
      doc.text(qty.toString(), 270, yPosition);
      doc.text(`${price.toFixed(2)} DH`, 370, yPosition);
      doc.text(`${total.toFixed(2)} DH`, 470, yPosition);
      yPosition += 20;
    });

    // ===== TOTALS SECTION =====
    yPosition += 20;
    doc
      .moveTo(50, yPosition)
      .lineTo(550, yPosition)
      .strokeColor("#ddd")
      .stroke();
    yPosition += 15;

    doc
      .font("Helvetica")
      .fontSize(12)
      .text("Sous-total:", 350, yPosition)
      .text(`${subTotal.toFixed(2)} DH`, 470, yPosition, { align: "right" });

    // ---- Remise ----
    let remise = 0;
    const discountValue = Number(devis.discountValue) || 0;
    const discountType = devis.discountType || "amount";

    if (discountValue > 0) {
      if (discountType === "percentage") {
        remise = (subTotal * discountValue) / 100;
      } else {
        remise = discountValue;
      }

      yPosition += 20;
      const discountText =
        discountType === "percentage"
          ? `Remise (${discountValue}%):`
          : "Remise:";
      doc
        .text(discountText, 350, yPosition)
        .text(`-${remise.toFixed(2)} DH`, 470, yPosition, {
          align: "right",
        });
    }

    // ---- Total After Remise ----
    const totalAfterRemise = subTotal - remise;
    yPosition += 25;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#1a73e8")
      .text("Total à payer:", 350, yPosition)
      .text(`${totalAfterRemise.toFixed(2)} DH`, 470, yPosition, {
        align: "right",
      });

    // ===== VALIDITY =====
    yPosition += 40;
    doc
      .font("Helvetica-Bold")
      .fillColor("#333")
      .text("Validité du devis :", 50, yPosition);
    doc
      .font("Helvetica")
      .fillColor("#000")
      .text(
        devis.validUntil
          ? `Ce devis est valable jusqu’au ${new Date(
              devis.validUntil,
            ).toLocaleDateString("fr-FR")}.`
          : "Date de validité non spécifiée.",
        50,
        yPosition + 20,
      );

    // ===== NOTES =====
    if (devis.notes) {
      yPosition += 60;
      doc
        .font("Helvetica-Bold")
        .fillColor("#333")
        .text("Notes:", 50, yPosition);
      yPosition += 15;
      doc
        .font("Helvetica")
        .fillColor("#000")
        .text(devis.notes, 50, yPosition, { width: 500 });
    }

    doc.end();
  } catch (err) {
    console.error("Generate Devis PDF error:", err);
    return res.status(500).json({
      message: "Error generating Devis PDF",
      error: err.message,
    });
  }
};

const convertDevisToInvoice = async (req, res) => {
  const transaction = await Devis.sequelize.transaction();

  try {
    const devis = await Devis.findByPk(req.params.id, {
      include: [{ model: DevisItem, as: "lignes" }],
    });

    if (!devis) {
      return res.status(404).json({ message: "Devis not found" });
    }

    if (devis.convertedToInvoice) {
      return res.status(400).json({ message: "Devis already converted to invoice" });
    }

    // Generate invoice number
    const prefix = "FA";
    const lastFacture = await Facture.findOne({
      where: {
        invoiceNumber: { [Op.like]: `${prefix}%` },
      },
      order: [["createdAt", "DESC"]],
    });

    let sequence = 1;
    if (lastFacture) {
      const lastNum = lastFacture.invoiceNumber;
      const lastSeq = parseInt(lastNum.slice(-4)) || 0;
      sequence = lastSeq + 1;
    }
    const invoiceNumber = `${prefix}${sequence.toString().padStart(4, "0")}`;

    // Create invoice from devis
    const invoice = await Facture.create({
      invoiceNumber,
      customerName: devis.customerName,
      customerPhone: devis.customerPhone,
      issueDate: new Date(),
      notes: devis.notes,
      status: "brouillon",
      discountType: devis.discountType,
      discountValue: parseFloat(devis.discountValue) || 0,
      discountAmount: parseFloat(devis.discountAmount) || 0,
      subTotal: parseFloat(devis.subTotal) || 0,
      total: parseFloat(devis.total) || 0,
      client_id: devis.client_id,
      preparedById: devis.preparedById,
      preparedBy: devis.preparedBy,
    }, { transaction });

    // Create invoice items from devis lines
    for (const ligne of devis.lignes) {
      await FactureItem.create({
        quantite: ligne.quantite,
        v1: ligne.v1,
        v2: ligne.v2,
        v3: ligne.v3 || 1,
        prix_unitaire: ligne.prix_unitaire,
        total_ligne: ligne.total_ligne,
        remise_ligne: ligne.remise_ligne || 0,
        designation: ligne.designation || ligne.articleName,
        produit_id: ligne.produit_id,
        facture_id: invoice.id,
      }, { transaction });
    }

    // Update devis to mark as converted
    devis.convertedToInvoice = true;
    devis.convertedInvoiceId = invoice.id;
    devis.status = "transformé_facture";
    await devis.save({ transaction });

    await transaction.commit();

    return res.json({
      message: "Devis converted to invoice successfully",
      devis,
      invoice,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error converting devis to invoice:", error);
    return res.status(500).json({
      message: "Error converting devis to invoice",
      error: error.message,
    });
  }
};

const convertDevisToBonLivraison = async (req, res) => {
  const transaction = await Devis.sequelize.transaction();

  try {
    const devis = await Devis.findByPk(req.params.id, {
      include: [{ model: DevisItem, as: "lignes" }],
    });

    if (!devis) {
      return res.status(404).json({ message: "Devis not found" });
    }

    if (devis.convertedToBonLivraison) {
      return res.status(400).json({ message: "Devis already converted to bon livraison" });
    }

    // Generate bon livraison number
    const prefix = "BL";
    const lastBL = await BonLivraison.findOne({
      where: {
        deliveryNumber: { [Op.like]: `${prefix}%` },
      },
      order: [["createdAt", "DESC"]],
    });

    let sequence = 1;
    if (lastBL) {
      const lastNum = lastBL.deliveryNumber;
      const lastSeq = parseInt(lastNum.slice(-4)) || 0;
      sequence = lastSeq + 1;
    }
    const deliveryNumber = `${prefix}${sequence.toString().padStart(4, "0")}`;

    // Create bon livraison from devis
    const bonLivraison = await BonLivraison.create({
      deliveryNumber,
      customerName: devis.customerName,
      customerPhone: devis.customerPhone,
      issueDate: new Date(),
      notes: devis.notes,
      status: "brouillon",
      discountType: devis.discountType,
      discountValue: parseFloat(devis.discountValue) || 0,
      discountAmount: parseFloat(devis.discountAmount) || 0,
      subTotal: parseFloat(devis.subTotal) || 0,
      total: parseFloat(devis.total) || 0,
      client_id: devis.client_id,
      preparedById: devis.preparedById,
      preparedBy: devis.preparedBy,
    }, { transaction });

    // Create bon livraison items from devis lines
    for (const ligne of devis.lignes) {
      await BonLivraisonProduit.create({
        quantite: ligne.quantite,
        v1: ligne.v1,
        v2: ligne.v2,
        v3: ligne.v3 || 1,
        prix_unitaire: ligne.prix_unitaire,
        total_ligne: ligne.total_ligne,
        remise_ligne: ligne.remise_ligne || 0,
        designation: ligne.designation || ligne.articleName,
        produit_id: ligne.produit_id,
        bon_livraison_id: bonLivraison.id,
      }, { transaction });
    }

    // Update devis to mark as converted
    devis.convertedToBonLivraison = true;
    devis.convertedBonLivraisonId = bonLivraison.id;
    devis.status = "transformé_bon_livraison";
    await devis.save({ transaction });

    await transaction.commit();

    return res.json({
      message: "Devis converted to bon livraison successfully",
      devis,
      bonLivraison,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error converting devis to bon livraison:", error);
    return res.status(500).json({
      message: "Error converting devis to bon livraison",
      error: error.message,
    });
  }
};

module.exports = {
  createDevis,
  getDevis,
  getDevisById,
  updateDevis,
  deleteDevis,
  updateDevisStatus,
  getDevisPDF,
  uploadDevisPDF,
  generateDevisPDF,
  convertDevisToInvoice,
  convertDevisToBonLivraison,
};
