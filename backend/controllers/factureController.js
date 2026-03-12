// controllers/factureController.js
const Facture = require("../models/Facture");
const FactureProduit = require("../models/FactureProduit");
const Advancement = require("../models/Advancement");
const { Op } = require("sequelize");
const { Client, Produit, BonLivraison, User } = require("../models");

const generateInvoiceNumber = async () => {
  const prefix = "FAC";
  const prefixWithYear = `${prefix}`;

  const lastFacture = await Facture.findOne({
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

  // Format: FAC23-000001 (FAC + année + tiret + séquence sur 6 chiffres)
  return `${prefixWithYear}-${sequence.toString().padStart(4, "0")}`;
};

const createFacture = async (req, res) => {
  console.log("🚀 CREATE FACTURE - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await Facture.sequelize.transaction();

  try {
    const {
      clientId,
      customerName,
      customerPhone,
      issueDate,
      notes,
      items,
      status,
      discountType,
      discountValue,
      paymentType,
      advancements,
      advancement,
      preparedBy,
      preparedById,
      validatedBy,
      validatedById,
      tvaRate,
      tvaAmount,
      includeTvaInPrice,
      discountAmount,
      subTotal,
      totalHT,
      totalTTC,
      remainingAmount,
      bonLivraisonId,
      ice,
      ste,
    } = req.body;

    console.log("📋 Received clientId:", clientId);

    // Validate required fields
    if (!customerName || customerName.trim() === "") {
      console.log("❌ Validation failed: Customer name is required");
      return res.status(400).json({ message: "Le nom du client est requis" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed: Items are required");
      return res
        .status(400)
        .json({ message: "La facture doit avoir au moins un article" });
    }

    console.log("✅ All validations passed");

    // VÉRIFICATION DES STOCKS (SURFACES)
    console.log("🔍 Vérification des surfaces disponibles...");
    for (const item of items) {
      const produit = await Produit.findByPk(item.productId);

      if (!produit) {
        throw new Error(`Produit avec ID ${item.productId} non trouvé`);
      }

      // Récupérer L1 et L2 du payload (déjà en mm)
      const l1Value = parseFloat(item.L1 || item.v1 || 1);
      const l2Value = parseFloat(item.L2 || item.v2 || 1);
      const quantite = parseFloat(item.quantity) || 1;

      // Calcul exact en mm²
      const surfaceMM2ParUnite = Math.round(l1Value * l2Value);
      const surfaceMM2Totale = surfaceMM2ParUnite * quantite;
      const surfaceM2Totale = surfaceMM2Totale / 10000;

      console.log(`📐 Produit ${produit.reference}:`, {
        L1_mm: l1Value,
        L2_mm: l2Value,
        quantite: quantite,
        surface_par_unite_mm2: surfaceMM2ParUnite.toLocaleString("fr-FR"),
        surface_totale_mm2: surfaceMM2Totale.toLocaleString("fr-FR"),
        surface_necessaire_m2: surfaceM2Totale.toFixed(6),
        surface_disponible_m2: parseFloat(produit.surface).toFixed(4),
      });

      if (parseFloat(produit.surface) < surfaceM2Totale) {
        throw new Error(
          `Surface insuffisante pour ${produit.designation || produit.reference}. ` +
            `Disponible: ${parseFloat(produit.surface).toFixed(4)} m², ` +
            `Nécessaire: ${surfaceM2Totale.toFixed(4)} m² ` +
            `(${surfaceMM2Totale.toLocaleString("fr-FR")} mm²)`,
        );
      }
    }
    console.log("✅ Surfaces disponibles suffisantes");

    // Generate invoice number
    console.log("🔢 Generating invoice number...");
    const invoiceNumber = await generateInvoiceNumber();
    console.log("📋 Generated invoice number:", invoiceNumber);

    // Prepare items with correct field names for FactureProduit
    console.log("🧮 Preparing items...");
    const preparedItems = items.map((item, index) => {
      const l1Value = parseFloat(item.L1 || item.v1 || 1);
      const l2Value = parseFloat(item.L2 || item.v2 || 1);
      const quantite = parseFloat(item.quantity) || 1;
      const prixUnitaire = parseFloat(item.unitPrice) || 0;

      const totalLigne = parseFloat(item.totalPrice) || prixUnitaire * quantite;

      console.log(`📦 Item ${index + 1}:`, {
        productId: item.productId,
        quantity: quantite,
        L1_mm: l1Value,
        L2_mm: l2Value,
        unitPrice: prixUnitaire,
        totalPrice: totalLigne,
      });

      return {
        produit_id: item.productId,
        quantite: quantite,
        v1: l1Value,
        v2: l2Value,
        prix_unitaire: prixUnitaire,
        total_ligne: totalLigne,
        remise_ligne: 0,
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

    let totalAdvancement = 0;
    if (advancements && Array.isArray(advancements)) {
      totalAdvancement = advancements.reduce(
        (sum, adv) => sum + parseFloat(adv.amount || 0),
        0,
      );
    }
    if (advancement && Number(advancement) > 0) {
      totalAdvancement += Number(advancement);
    }

    const calculatedRemainingAmount =
      remainingAmount || Math.max(0, calculatedTotalTTC - totalAdvancement);

    console.log("📊 Final calculated values:", {
      subTotal: calculatedSubTotal,
      discount: calculatedDiscount,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
    });

    // Prepare the data for creating Facture
    const createData = {
      invoiceNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone || null,
      issueDate: issueDate || new Date(),
      notes,
      status: status || "brouillon",
      discountType: discountType || "fixed",
      discountValue: discountValue || 0,
      paymentType: paymentType || "non_paye",
      tvaRate: calculatedTvaRate,
      tvaAmount: calculatedTvaAmount,
      includeTvaInPrice: includeTvaInPrice !== undefined ? includeTvaInPrice : true,
      advancement: totalAdvancement,
      remainingAmount: calculatedRemainingAmount,
      subTotal: calculatedSubTotal,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
      discountAmount: calculatedDiscount,
      client_id: clientId || null,
      bon_livraison_id: bonLivraisonId || null,
      preparedById: preparedById || 1,
      preparedBy: preparedBy || "User",
      validatedById: validatedById || 1,
      validatedBy: validatedBy || "Validator",
      ice: ice || null,
      ste: ste || null,
    };

    console.log("=== CREATE DATA ===");
    console.log("preparedById:", createData.preparedById);
    console.log("preparedBy:", createData.preparedBy);
    console.log("validatedById:", createData.validatedById);
    console.log("validatedBy:", createData.validatedBy);

    // Create the invoice
    console.log("🔄 Creating Facture...");
    const facture = await Facture.create(createData, { transaction });

    console.log("✅ Facture created! ID:", facture.id);

    // Create FactureProduit items
    console.log("📝 Creating FactureProduit items...");
    const factureItems = await Promise.all(
      preparedItems.map(async (item) => {
        const itemToCreate = {
          ...item,
          facture_id: facture.id,
        };

        const createdItem = await FactureProduit.create(itemToCreate, {
          transaction,
        });
        return createdItem;
      }),
    );

    console.log(`✅ Created ${factureItems.length} FactureProduit items`);

    // =============================================
    // DÉCRÉMENTER LA SURFACE DES PRODUITS (AVEC VALEUR EXACTE EN MM²)
    // =============================================
    console.log("📉 Décrémentation des surfaces...");

    for (const item of items) {
      const produit = await Produit.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!produit) {
        throw new Error(
          `Produit avec ID ${item.productId} non trouvé pour la décrémentation`,
        );
      }

      // Récupérer L1 et L2 du payload (déjà en mm)
      const l1Value = parseFloat(item.L1 || item.v1 || produit.L1 || 1);
      const l2Value = parseFloat(item.L2 || item.v2 || produit.L2 || 1);
      const quantite = parseFloat(item.quantity) || 1;

      // ===== CALCUL EXACT EN MM² =====
      // 1. Surface en mm² par unité (arrondi à l'entier)
      const surfaceMM2ParUnite = Math.round(l1Value * l2Value);

      // 2. Surface totale en mm² (la valeur QUE VOUS VOULEZ décrémenter)
      const surfaceMM2Totale = surfaceMM2ParUnite * quantite; // ← 54 002

      // 3. Conversion en m² pour la base de données (conversion exacte)
      const surfaceM2Totale = surfaceMM2Totale / 10000; // = 0.054002

      // 4. Surface actuelle en m²
      const surfaceActuelleM2 = parseFloat(produit.surface) || 0;

      // 5. Nouvelle surface en m² (calculée avec précision)
      const nouvelleSurfaceM2 = surfaceActuelleM2 - surfaceM2Totale;

      // 6. Arrondir à 4 décimales pour correspondre au type DECIMAL(10,4)
      const nouvelleSurfaceM2Arrondie = parseFloat(
        nouvelleSurfaceM2.toFixed(4),
      );

      console.log(`📊 Produit ${produit.reference}:`, {
        // Dimensions en mm
        L1_mm: l1Value,
        L2_mm: l2Value,
        quantite: quantite,

        // Surfaces en mm² (ce que vous voulez décrémenter)
        surface_par_unite_mm2: surfaceMM2ParUnite.toLocaleString("fr-FR"),
        surface_totale_mm2: surfaceMM2Totale.toLocaleString("fr-FR"), // ← 54 002

        // Surfaces en m² (avec précision)
        surface_a_decrementer_m2_exact: surfaceM2Totale.toFixed(6), // 0.054002
        surface_a_decrementer_m2_arrondi: surfaceM2Totale.toFixed(4), // 0.0540

        // Surfaces en m² (stockées en DB)
        surface_actuelle_m2: surfaceActuelleM2.toFixed(4),
        nouvelle_surface_m2_calculee: nouvelleSurfaceM2.toFixed(6),
        nouvelle_surface_m2_arrondie: nouvelleSurfaceM2Arrondie.toFixed(4),

        // Vérification
        verification: `${surfaceMM2Totale.toLocaleString("fr-FR")} mm² = ${surfaceM2Totale.toFixed(6)} m²`,
      });

      // Mise à jour avec hooks désactivés
      await Produit.update(
        {
          surface: nouvelleSurfaceM2Arrondie,
        },
        {
          where: { id: item.productId },
          transaction,
          hooks: false,
        },
      );

      // Vérifier la mise à jour
      const produitVerif = await Produit.findByPk(item.productId, {
        transaction,
      });

      console.log(
        `✅ Produit ${produit.reference} mis à jour: ${produitVerif.surface} m²`,
      );
      console.log(
        `   Décrémenté: ${surfaceMM2Totale.toLocaleString("fr-FR")} mm² (${surfaceM2Totale.toFixed(6)} m²)`,
      );
      console.log(
        `   Vérification: ${surfaceActuelleM2.toFixed(4)} - ${surfaceM2Totale.toFixed(4)} = ${(surfaceActuelleM2 - surfaceM2Totale).toFixed(4)} m²`,
      );
    }

    console.log("✅ Toutes les surfaces ont été décrémentées");

    // Create advancements if any
    if (
      advancements &&
      Array.isArray(advancements) &&
      advancements.length > 0
    ) {
      console.log("💳 Creating advancements...");
      await Promise.all(
        advancements.map((adv) =>
          Advancement.create(
            {
              amount: adv.amount,
              paymentDate: adv.paymentDate || new Date(),
              paymentMethod: adv.paymentMethod || "espece",
              reference: adv.reference || "",
              notes: adv.notes || "",
              facture_id: facture.id,
            },
            { transaction },
          ),
        ),
      );
      console.log(`✅ Advancements créés`);
    }

    // Commit transaction
    await transaction.commit();
    console.log("🎉 Transaction committed successfully!");

    // Fetch the complete facture with associations
    const completeFacture = await Facture.findByPk(facture.id, {
      include: [
        {
          model: FactureProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        {
          model: Advancement,
          as: "advancements",
        },
        {
          model: Client,
          as: "client",
        },
        {
          model: BonLivraison,
          as: "bonLivraison",
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      facture: {
        id: completeFacture.id,
        num_facture: completeFacture.invoiceNumber,
        date_creation: completeFacture.issueDate,
        montant_ht: completeFacture.totalHT,
        tva: completeFacture.tvaAmount,
        montant_ttc: completeFacture.totalTTC,
        montant_restant: completeFacture.remainingAmount,
        status: completeFacture.status,
      },
    });
  } catch (err) {
    await transaction.rollback();
    console.error("❌ CREATE FACTURE - ERROR:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Le numéro de facture existe déjà",
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

const getFactures = async (req, res) => {
  try {
    const factures = await Facture.findAll({
      include: [
        {
          model: FactureProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Client, as: "client" },
        { model: Advancement, as: "advancements" },
        {
          model: BonLivraison,
          as: "bonLivraison",
          required: false,
        },
        { model: User, as: "preparator", attributes: ["id", "name", "email"] },
        { model: User, as: "validator", attributes: ["id", "name", "email"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      factures,
    });
  } catch (err) {
    console.error("Get invoices error:", err);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFactureById = async (req, res) => {
  try {
    const facture = await Facture.findByPk(req.params.id, {
      include: [
        {
          model: FactureProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Client, as: "client" },
        { model: Advancement, as: "advancements" },
        {
          model: BonLivraison,
          as: "bonLivraison",
          required: false,
        },
        { model: User, as: "preparator", attributes: ["id", "name", "email"] },
        { model: User, as: "validator", attributes: ["id", "name", "email"] },
      ],
    });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    return res.json({
      success: true,
      facture,
    });
  } catch (err) {
    console.error("Get invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const updateFactureStatus = async (req, res) => {
  const transaction = await Facture.sequelize.transaction();

  try {
    const { id } = req.params;
    const { status } = req.body;

    const facture = await Facture.findByPk(id, { transaction });

    if (!facture) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    await facture.update({ status }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Statut mis à jour avec succès",
      facture,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Update invoice status error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const addAdvancement = async (req, res) => {
  const transaction = await Facture.sequelize.transaction();

  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

    const facture = await Facture.findByPk(id, { transaction });

    if (!facture) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Create advancement
    const advancement = await Advancement.create(
      {
        amount,
        paymentDate: paymentDate || new Date(),
        paymentMethod,
        reference: reference || "",
        notes: notes || "",
        facture_id: facture.id,
      },
      { transaction },
    );

    // Update facture advancement and remaining amount
    const newTotalAdvancement =
      parseFloat(facture.advancement) + parseFloat(amount);
    const newRemainingAmount = Math.max(
      0,
      facture.totalTTC - newTotalAdvancement,
    );

    await facture.update(
      {
        advancement: newTotalAdvancement,
        remainingAmount: newRemainingAmount,
        status: newRemainingAmount === 0 ? "payée" : "partiellement_payée",
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: "Acompte ajouté avec succès",
      advancement,
      remainingAmount: newRemainingAmount,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Add advancement error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const deleteFacture = async (req, res) => {
  const transaction = await Facture.sequelize.transaction();

  try {
    const { id } = req.params;

    const facture = await Facture.findByPk(id, { transaction });

    if (!facture) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    // Delete associated items (cascade should handle this, but we'll do it explicitly)
    await FactureProduit.destroy({
      where: { facture_id: id },
      transaction,
    });

    // Delete advancements
    await Advancement.destroy({
      where: { facture_id: id },
      transaction,
    });

    // Delete facture
    await facture.destroy({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: "Facture supprimée avec succès",
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Delete invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFacturesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const factures = await Facture.findAll({
      where: { client_id: clientId },
      include: [
        {
          model: FactureProduit,
          as: "lignes",
          include: [
            {
              model: Produit,
              as: "produit",
            },
          ],
        },
        { model: Advancement, as: "advancements" },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      factures,
    });
  } catch (err) {
    console.error("Get client invoices error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const getFactureStats = async (req, res) => {
  try {
    const totalFactures = await Facture.count();

    const totalPaid = await Facture.sum("totalTTC", {
      where: { status: "payée" },
    });

    const totalPending = await Facture.sum("remainingAmount", {
      where: {
        remainingAmount: {
          [Op.gt]: 0,
        },
      },
    });

    const totalTVA = await Facture.sum("tvaAmount");

    return res.json({
      success: true,
      stats: {
        total: totalFactures,
        totalPaid: totalPaid || 0,
        totalPending: totalPending || 0,
        totalTVA: totalTVA || 0,
      },
    });
  } catch (err) {
    console.error("Get invoice stats error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};

const updateFacture = async (req, res) => {
  console.log("🚀 UPDATE FACTURE - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await Facture.sequelize.transaction();

  try {
    const facture = await Facture.findByPk(req.params.id, {
      include: [
        { model: FactureProduit, as: "lignes" },
        { model: Advancement, as: "advancements" },
      ],
    });

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: "Facture non trouvée",
      });
    }

    const {
      customerName,
      customerPhone,
      issueDate,
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
      advancement,
      remainingAmount,
      bonLivraisonId,
      preparedBy,
      validatedBy,
      ice,
      ste,
      items,
      lignes,
      advancements,
    } = req.body;

    // Calculate totals
    const calculatedSubTotal =
      subTotal ||
      (items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0);

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

    const totalAdvancement =
      advancement ||
      (advancements || []).reduce((sum, adv) => sum + (adv.amount || 0), 0);

    const calculatedRemainingAmount = Math.max(
      0,
      calculatedTotalTTC - totalAdvancement,
    );

    // Build update object
    const updateFields = {
      customerName: customerName || facture.customerName,
      customerPhone:
        customerPhone !== undefined ? customerPhone : facture.customerPhone,
      issueDate: issueDate ? new Date(issueDate) : facture.issueDate,
      notes: notes !== undefined ? notes : facture.notes,
      status: status || facture.status,
      discountType: discountType || facture.discountType,
      discountValue:
        discountValue !== undefined ? discountValue : facture.discountValue,
      paymentType: paymentType || facture.paymentType,
      tvaRate: calculatedTvaRate,
      tvaAmount: calculatedTvaAmount,
      includeTvaInPrice:
        includeTvaInPrice !== undefined
          ? includeTvaInPrice
          : facture.includeTvaInPrice,
      advancement: totalAdvancement,
      remainingAmount: calculatedRemainingAmount,
      subTotal: calculatedSubTotal,
      totalHT: calculatedTotalHT,
      totalTTC: calculatedTotalTTC,
      discountAmount: calculatedDiscount,
      bon_livraison_id:
        bonLivraisonId !== undefined ? bonLivraisonId : facture.bonLivraisonId,
      preparedBy: preparedBy !== undefined ? preparedBy : facture.preparedBy,
      validatedBy:
        validatedBy !== undefined ? validatedBy : facture.validatedBy,
      ice: ice !== undefined ? ice : facture.ice,
      ste: ste !== undefined ? ste : facture.ste,
    };

    // Apply updates
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        facture[key] = updateFields[key];
      }
    });

    // Save the invoice
    await facture.save({ transaction });
    console.log("✅ Facture updated! ID:", facture.id);

    // Update items ONLY if they were provided (accept both 'items' and 'lignes' keys)
    const itemsToProcess = (items && Array.isArray(items) && items.length > 0)
      ? items
      : (lignes && Array.isArray(lignes) && lignes.length > 0)
        ? lignes
        : null;

    if (itemsToProcess) {
      console.log("📝 Updating FactureProduit items...");

      // Delete existing items
      await FactureProduit.destroy({
        where: { facture_id: facture.id },
        transaction,
      });

      // Create new items
      const preparedItems = itemsToProcess.map((item) => ({
        produit_id: item.produit_id || item.productId || null,
        quantite: item.quantite || item.quantity || 1,
        v1: item.v1 || 1,
        v2: item.v2 || 1,
        prix_unitaire: item.prix_unitaire || item.unitPrice || 0,
        total_ligne: item.total_ligne || item.totalPrice || 0,
        remise_ligne: item.remise_ligne || 0,
        designation: item.designation || null,
        facture_id: facture.id,
      }));

      await FactureProduit.bulkCreate(preparedItems, { transaction });
      console.log("Created " + preparedItems.length + " FactureProduit items");
    }

    // Update advancements if provided
    if (advancements !== undefined) {
      console.log("💳 Updating advancements...");

      // Delete existing advancements
      await Advancement.destroy({
        where: { facture_id: facture.id },
        transaction,
      });

      // Create new advancements
      if (advancements.length > 0) {
        const preparedAdvancements = advancements.map((adv) => ({
          amount: adv.amount,
          paymentDate: adv.paymentDate ? new Date(adv.paymentDate) : new Date(),
          paymentMethod: adv.paymentMethod || "espece",
          reference: adv.reference || "",
          notes: adv.notes || "",
          facture_id: facture.id,
        }));

        await Advancement.bulkCreate(preparedAdvancements, { transaction });
      }
    }

    await transaction.commit();

    // Fetch updated facture with associations
    const updatedFacture = await Facture.findByPk(facture.id, {
      include: [
        { model: FactureProduit, as: "lignes" },
        { model: Client, as: "client" },
        { model: Advancement, as: "advancements" },
      ],
    });

    console.log("✅ Facture update completed!");

    return res.json({
      success: true,
      facture: updatedFacture,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Update invoice error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de la facture",
      error: err.message,
    });
  }
};

module.exports = {
  createFacture,
  getFactures,
  getFactureById,
  updateFacture,
  updateFactureStatus,
  addAdvancement,
  deleteFacture,
  getFacturesByClient,
  getFactureStats,
};
