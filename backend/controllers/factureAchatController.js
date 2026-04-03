const FactureAchat = require("../models/FactureAchat");
const FactureAchatProduit = require("../models/FactureAchatProduit");
const { Op } = require("sequelize");
const { Fornisseur, Produit } = require("../models");

const generatePurchaseInvoiceNumber = async () => {
  const prefix = "FAC-A";
  const prefixWithYear = `${prefix}`;

  const lastFacture = await FactureAchat.findOne({
    where: {
      invoiceNumber: {
        [Op.like]: `${prefixWithYear}%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastFacture) {
    const lastNum = lastFacture.invoiceNumber;
    const lastSeq = parseInt(lastNum.slice(-4)) || 0;
    sequence = lastSeq + 1;
  }

  // Format: FAC-A-0001 (FAC-A + tiret + séquence sur 4 chiffres)
  return `${prefixWithYear}-${sequence.toString().padStart(4, "0")}`;
};

const createFactureAchat = async (req, res) => {
  console.log("🚀 CREATE PURCHASE INVOICE - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await FactureAchat.sequelize.transaction();

  try {
    const {
      fornisseurId,
      supplierName,
      supplierPhone,
      supplierEmail,
      issueDate,
      dueDate,
      notes,
      items,
      status,
      discountType,
      discountValue,
      paymentType,
      preparedById,

      tvaRate,
      tvaAmount,
      includeTvaInPrice,
      discountAmount,
      subTotal,
      totalHT,
      totalTTC,
      remainingAmount,
      bonReceptionId,
      ice,
      ste,
    } = req.body;

    console.log("📋 Received fornisseurId:", fornisseurId);

    // Validate required fields
    if (!fornisseurId) {
      console.log("❌ Validation failed: Supplier is required");
      return res.status(400).json({ message: "Le fournisseur est requis" });
    }

    if (!supplierName || supplierName.trim() === "") {
      console.log("❌ Validation failed: Supplier name is required");
      return res
        .status(400)
        .json({ message: "Le nom du fournisseur est requis" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed: Items are required");
      return res
        .status(400)
        .json({ message: "La facture d'achat doit avoir au moins un article" });
    }

    console.log("✅ All validations passed");

    // Generate invoice number
    console.log("🔢 Generating purchase invoice number...");
    const invoiceNumber = await generatePurchaseInvoiceNumber();
    console.log("📋 Generated invoice number:", invoiceNumber);

    // Prepare items for FactureAchatProduit (no v1, v2 fields)
    console.log("🧮 Preparing items...");
    const preparedItems = items.map((item, index) => {
      const quantite = parseFloat(item.quantity) || 1;
      const prixUnitaire = parseFloat(item.unitPrice) || 0;
      const remiseLigne = parseFloat(item.lineDiscount) || 0;

      // Calculate line total after discount
      const totalLigne = prixUnitaire * quantite - remiseLigne;

      console.log(`📦 Item ${index + 1}:`, {
        productId: item.productId,
        quantity: quantite,
        unitPrice: prixUnitaire,
        lineDiscount: remiseLigne,
        totalPrice: totalLigne,
      });

      return {
        produit_id: item.productId,
        quantite: quantite,
        prix_unitaire: prixUnitaire,
        remise_ligne: remiseLigne,
        total_ligne: totalLigne,
        tva_ligne: item.tva_ligne || null,
      };
    });

    // Calculate totals
    console.log("💰 Calculating totals...");
    const calculatedSubTotal =
      subTotal ||
      preparedItems.reduce((sum, item) => sum + (item.total_ligne || 0), 0);

    const calculatedDiscount =
      discountAmount ||
      (discountType === "percentage"
        ? (calculatedSubTotal * (discountValue || 0)) / 100
        : discountValue || 0);

    const calculatedTotalHT =
      totalHT || Math.max(0, calculatedSubTotal - calculatedDiscount);

    const calculatedTvaRate = tvaRate || 20;
    const calculatedTvaAmount =
      tvaAmount || (calculatedTotalHT * calculatedTvaRate) / 100;

    const calculatedTotalTTC =
      totalTTC || calculatedTotalHT + calculatedTvaAmount;

    const calculatedRemainingAmount = remainingAmount || calculatedTotalTTC;

    console.log("📊 Final calculated values:", {
      subTotal: calculatedSubTotal,
      discount: calculatedDiscount,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
    });

    // Prepare the data for creating FactureAchat
    const createData = {
      invoiceNumber,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone || null,
      supplierEmail: supplierEmail || null,
      issueDate: issueDate || new Date(),
      dueDate: dueDate || null,
      notes,
      status: status || "brouillon",
      discountType: discountType || "fixed",
      discountValue: discountValue || 0,
      paymentType: paymentType || "non_paye",
      tvaRate: calculatedTvaRate,
      tvaAmount: calculatedTvaAmount,
      includeTvaInPrice:
        includeTvaInPrice !== undefined ? includeTvaInPrice : true,
      advancement: 0, // Purchase invoices don't typically have advancements from supplier
      remainingAmount: calculatedRemainingAmount,
      subTotal: calculatedSubTotal,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
      discountAmount: calculatedDiscount,
      fornisseurId: fornisseurId,
      bon_reception_id: bonReceptionId || null,
      preparedById: preparedById || 1,

      ice: ice || null,
      ste: ste || null,
    };

    console.log("=== CREATE DATA ===");
    console.log("preparedById:", createData.preparedById);
    console.log("fornisseurId:", createData.fornisseurId);

    // Create the purchase invoice
    console.log("🔄 Creating FactureAchat...");
    const factureAchat = await FactureAchat.create(createData, { transaction });

    console.log("✅ FactureAchat created! ID:", factureAchat.id);

    // Create FactureAchatProduit items
    console.log("📝 Creating FactureAchatProduit items...");
    const factureItems = await Promise.all(
      preparedItems.map(async (item) => {
        const itemToCreate = {
          ...item,
          facture_achat_id: factureAchat.id,
        };

        const createdItem = await FactureAchatProduit.create(itemToCreate, {
          transaction,
        });
        return createdItem;
      }),
    );

    console.log(`✅ Created ${factureItems.length} FactureAchatProduit items`);

    // Update product stock/inventory and prix_achat (increase quantity for purchase)
    console.log("📈 Updating product inventory and purchase price...");
    for (const item of items) {
      const produit = await Produit.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!produit) {
        throw new Error(
          `Produit avec ID ${item.productId} non trouvé pour la mise à jour du stock`,
        );
      }

      const quantite = parseFloat(item.quantity) || 1;
      const prixAchat = parseFloat(item.unitPrice) || 0;
      const currentStock = parseFloat(produit.surface) || 0;
      const newStock = currentStock + quantite;

      await Produit.update(
        {
          surface: newStock,
          prix_achat: prixAchat,
        },
        {
          where: { id: item.productId },
          transaction,
          hooks: false,
        },
      );

      console.log(
        `✅ Produit ${produit.reference} mis à jour - stock: ${currentStock} -> ${newStock}, prix_achat: ${prixAchat}`,
      );
    }

    console.log("✅ All product stocks have been updated");

    // Commit transaction
    await transaction.commit();
    console.log("🎉 Transaction committed successfully!");

    // Fetch the complete purchase invoice with associations
    const completeFacture = await FactureAchat.findByPk(factureAchat.id, {
      include: [
        {
          model: FactureAchatProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        {
          model: Fornisseur,
          as: "fornisseur",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      factureAchat: {
        id: completeFacture.id,
        num_facture: completeFacture.invoiceNumber,
        date_creation: completeFacture.issueDate,
        date_echeance: completeFacture.dueDate,
        montant_ht: completeFacture.totalHT,
        tva: completeFacture.tvaAmount,
        montant_ttc: completeFacture.totalTTC,
        montant_restant: completeFacture.remainingAmount,
        status: completeFacture.status,
        fournisseur:
          completeFacture.fornisseur?.name || completeFacture.supplierName,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("❌ CREATE PURCHASE INVOICE - ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Le numéro de facture d'achat existe déjà",
      });
    }

    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => error.message);
      return res.status(400).json({
        message: "Erreur de validation",
        errors,
      });
    }

    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFacturesAchat = async (req, res) => {
  try {
    const facturesAchat = await FactureAchat.findAll({
      include: [
        {
          model: FactureAchatProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Fornisseur, as: "fornisseur" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      facturesAchat,
    });
  } catch (err) {
    console.error("Get purchase invoices error:", err);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFactureAchatById = async (req, res) => {
  try {
    const factureAchat = await FactureAchat.findByPk(req.params.id, {
      include: [
        {
          model: FactureAchatProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Fornisseur, as: "fornisseur" },
      ],
    });

    if (!factureAchat) {
      return res.status(404).json({
        success: false,
        message: "Facture d'achat non trouvée",
      });
    }

    return res.json({
      success: true,
      factureAchat,
    });
  } catch (err) {
    console.error("Get purchase invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const updateFactureAchat = async (req, res) => {
  console.log("🚀 UPDATE PURCHASE INVOICE - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await FactureAchat.sequelize.transaction();

  try {
    const factureAchat = await FactureAchat.findByPk(req.params.id, {
      include: [{ model: FactureAchatProduit, as: "lignes" }],
    });

    if (!factureAchat) {
      return res.status(404).json({
        success: false,
        message: "Facture d'achat non trouvée",
      });
    }

    const {
      supplierName,
      supplierPhone,
      supplierEmail,
      issueDate,
      dueDate,
      notes,
      status,
      discountType,
      discountValue,
      paymentType,
      tvaRate,
      tvaAmount,
      includeTvaInPrice,
      discountAmount,
      subTotal,
      totalHT,
      totalTTC,
      remainingAmount,
      bonReceptionId,
      preparedBy,
      validatedBy,
      ice,
      ste,
      items,
      lignes,
    } = req.body;

    // Calculate totals
    const itemsToProcess =
      items && Array.isArray(items) && items.length > 0
        ? items
        : lignes && Array.isArray(lignes) && lignes.length > 0
          ? lignes
          : null;

    let calculatedSubTotal = subTotal;
    if (!calculatedSubTotal && itemsToProcess) {
      calculatedSubTotal = itemsToProcess.reduce((sum, item) => {
        const quantite = parseFloat(item.quantity || item.quantite || 1);
        const prixUnitaire = parseFloat(
          item.unitPrice || item.prix_unitaire || 0,
        );
        const remiseLigne = parseFloat(
          item.lineDiscount || item.remise_ligne || 0,
        );
        const totalLigne = prixUnitaire * quantite - remiseLigne;
        return sum + totalLigne;
      }, 0);
    }

    const calculatedDiscount =
      discountAmount ||
      (discountType === "percentage"
        ? (calculatedSubTotal * (discountValue || 0)) / 100
        : discountValue || 0);

    const calculatedTotalHT = Math.max(
      0,
      calculatedSubTotal - calculatedDiscount,
    );

    const calculatedTvaRate = tvaRate || 20;
    const calculatedTvaAmount = (calculatedTotalHT * calculatedTvaRate) / 100;

    const calculatedTotalTTC =
      includeTvaInPrice !== false
        ? calculatedTotalHT + calculatedTvaAmount
        : calculatedTotalHT;

    const calculatedRemainingAmount = remainingAmount || calculatedTotalTTC;

    // Build update object
    const updateFields = {
      supplierName: supplierName || factureAchat.supplierName,
      supplierPhone:
        supplierPhone !== undefined
          ? supplierPhone
          : factureAchat.supplierPhone,
      supplierEmail:
        supplierEmail !== undefined
          ? supplierEmail
          : factureAchat.supplierEmail,
      issueDate: issueDate ? new Date(issueDate) : factureAchat.issueDate,
      dueDate: dueDate ? new Date(dueDate) : factureAchat.dueDate,
      notes: notes !== undefined ? notes : factureAchat.notes,
      status: status || factureAchat.status,
      discountType: discountType || factureAchat.discountType,
      discountValue:
        discountValue !== undefined
          ? discountValue
          : factureAchat.discountValue,
      paymentType: paymentType || factureAchat.paymentType,
      tvaRate: calculatedTvaRate,
      tvaAmount: calculatedTvaAmount,
      includeTvaInPrice:
        includeTvaInPrice !== undefined
          ? includeTvaInPrice
          : factureAchat.includeTvaInPrice,
      remainingAmount: calculatedRemainingAmount,
      subTotal: calculatedSubTotal,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
      discountAmount: calculatedDiscount,
      bon_reception_id:
        bonReceptionId !== undefined
          ? bonReceptionId
          : factureAchat.bonReceptionId,
      preparedBy:
        preparedBy !== undefined ? preparedBy : factureAchat.preparedBy,
      validatedBy:
        validatedBy !== undefined ? validatedBy : factureAchat.validatedBy,
      ice: ice !== undefined ? ice : factureAchat.ice,
      ste: ste !== undefined ? ste : factureAchat.ste,
    };

    // Apply updates
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        factureAchat[key] = updateFields[key];
      }
    });

    // Save the invoice
    await factureAchat.save({ transaction });
    console.log("✅ FactureAchat updated! ID:", factureAchat.id);

    // Update items if provided
    if (itemsToProcess) {
      console.log("📝 Updating FactureAchatProduit items...");

      // First, revert stock changes from old items
      const oldItems = await FactureAchatProduit.findAll({
        where: { facture_achat_id: factureAchat.id },
        transaction,
      });

      for (const oldItem of oldItems) {
        const produit = await Produit.findByPk(oldItem.produit_id, {
          transaction,
        });
        if (produit) {
          const newStock =
            parseFloat(produit.surface) - parseFloat(oldItem.quantite);
          await Produit.update(
            { stock: Math.max(0, newStock) },
            {
              where: { id: oldItem.produit_id },
              transaction,
              hooks: false,
            },
          );
        }
      }

      // Delete existing items
      await FactureAchatProduit.destroy({
        where: { facture_achat_id: factureAchat.id },
        transaction,
      });

      // Create new items and update stock
      const preparedItems = itemsToProcess.map((item) => {
        const quantite = parseFloat(item.quantity || item.quantite || 1);
        const prixUnitaire = parseFloat(
          item.unitPrice || item.prix_unitaire || 0,
        );
        const remiseLigne = parseFloat(
          item.lineDiscount || item.remise_ligne || 0,
        );
        const totalLigne = prixUnitaire * quantite - remiseLigne;

        return {
          produit_id: item.produit_id || item.productId || null,
          quantite: quantite,
          prix_unitaire: prixUnitaire,
          remise_ligne: remiseLigne,
          total_ligne: totalLigne,
          tva_ligne: item.tva_ligne || null,
          facture_achat_id: factureAchat.id,
        };
      });

      await FactureAchatProduit.bulkCreate(preparedItems, { transaction });

      // Update stock and prix_achat with new items
      for (const item of preparedItems) {
        const produit = await Produit.findByPk(item.produit_id, {
          transaction,
        });
        if (produit) {
          const newStock =
            parseFloat(produit.surface) + parseFloat(item.quantite);
          await Produit.update(
            { stock: newStock, prix_achat: item.prix_unitaire },
            {
              where: { id: item.produit_id },
              transaction,
              hooks: false,
            },
          );
          console.log(
            `✅ Produit ${produit.reference} mis à jour - stock: ${newStock}, prix_achat: ${item.prix_unitaire}`,
          );
        }
      }

      console.log(
        "Created " + preparedItems.length + " FactureAchatProduit items",
      );
    }

    await transaction.commit();

    // Fetch updated purchase invoice with associations
    const updatedFacture = await FactureAchat.findByPk(factureAchat.id, {
      include: [
        {
          model: FactureAchatProduit,
          as: "lignes",
          include: [{ model: Produit, as: "produit" }],
        },
        { model: Fornisseur, as: "fornisseur" },
      ],
    });

    console.log("✅ Purchase invoice update completed!");

    return res.json({
      success: true,
      factureAchat: updatedFacture,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Update purchase invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de la facture d'achat",
      error: err.message,
    });
  }
};

const updateFactureAchatStatus = async (req, res) => {
  const transaction = await FactureAchat.sequelize.transaction();

  try {
    const { id } = req.params;
    const { status } = req.body;

    const factureAchat = await FactureAchat.findByPk(id, { transaction });

    if (!factureAchat) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture d'achat non trouvée",
      });
    }

    await factureAchat.update({ status }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Statut mis à jour avec succès",
      factureAchat,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Update purchase invoice status error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const deleteFactureAchat = async (req, res) => {
  const transaction = await FactureAchat.sequelize.transaction();

  try {
    const { id } = req.params;

    const factureAchat = await FactureAchat.findByPk(id, {
      include: [{ model: FactureAchatProduit, as: "lignes" }],
      transaction,
    });

    if (!factureAchat) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture d'achat non trouvée",
      });
    }

    // Revert stock changes
    for (const item of factureAchat.lignes) {
      const produit = await Produit.findByPk(item.produit_id, {
        transaction,
      });
      if (produit) {
        const newStock = Math.max(
          0,
          parseFloat(produit.surface) - parseFloat(item.quantite),
        );
        await Produit.update(
          { surface: newStock },
          {
            where: { id: item.produit_id },
            transaction,
            hooks: false,
          },
        );
        console.log(
          `✅ Stock reverted for product ${produit.reference}: ${newStock}`,
        );
      }
    }

    // Delete associated items
    await FactureAchatProduit.destroy({
      where: { facture_achat_id: id },
      transaction,
    });

    // Delete purchase invoice
    await factureAchat.destroy({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Facture d'achat supprimée avec succès",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Delete purchase invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFacturesAchatByFournisseur = async (req, res) => {
  try {
    const { fornisseurId } = req.params;

    const facturesAchat = await FactureAchat.findAll({
      where: { fornisseurId: fornisseurId },
      include: [
        {
          model: FactureAchatProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Fornisseur, as: "fornisseur" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      facturesAchat,
    });
  } catch (err) {
    console.error("Get supplier invoices error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFactureAchatStats = async (req, res) => {
  try {
    const totalFactures = await FactureAchat.count();

    const totalPaid = await FactureAchat.sum("totalTTC", {
      where: { status: "payée" },
    });

    const totalPending = await FactureAchat.sum("remainingAmount", {
      where: {
        remainingAmount: {
          [Op.gt]: 0,
        },
      },
    });

    const totalTVA = await FactureAchat.sum("tvaAmount");

    const totalOverdue = await FactureAchat.count({
      where: {
        dueDate: {
          [Op.lt]: new Date(),
        },
        status: {
          [Op.notIn]: ["payée", "annulée"],
        },
      },
    });

    return res.json({
      success: true,
      stats: {
        total: totalFactures,
        totalPaid: totalPaid || 0,
        totalPending: totalPending || 0,
        totalTVA: totalTVA || 0,
        totalOverdue: totalOverdue || 0,
      },
    });
  } catch (err) {
    console.error("Get purchase invoice stats error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

module.exports = {
  createFactureAchat,
  getFacturesAchat,
  getFactureAchatById,
  updateFactureAchat,
  updateFactureAchatStatus,
  deleteFactureAchat,
  getFacturesAchatByFournisseur,
  getFactureAchatStats,
};
