const BonLivraison = require("../models/bonLivraison");
const BonLivraisonProduit = require("../models/BonLivraisonProduit"); // Make sure this model exists
const Advancement = require("../models/Advancement");
const { Op } = require("sequelize");
const { Client, Produit, User } = require("../models");

const generateDeliveryNumber = async () => {
  const prefix = "BL";

  // Order by delivery_number DESC (lexicographic works for zero-padded numbers like BL0001, BL0002…)
  const lastBon = await BonLivraison.findOne({
    where: {
      deliveryNumber: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["deliveryNumber", "DESC"]],
  });

  let sequence = 1;
  if (lastBon) {
    const lastNum = lastBon.deliveryNumber; // e.g. "BL0003"
    const lastSeq = parseInt(lastNum.replace(prefix, ""), 10) || 0;
    sequence = lastSeq + 1;
  }

  // Safety: keep incrementing until we find a number not already taken
  let candidate = `${prefix}${sequence.toString().padStart(4, "0")}`;
  let exists = await BonLivraison.findOne({ where: { deliveryNumber: candidate } });
  while (exists) {
    sequence += 1;
    candidate = `${prefix}${sequence.toString().padStart(4, "0")}`;
    exists = await BonLivraison.findOne({ where: { deliveryNumber: candidate } });
  }

  return candidate;
};

const createBonLivraison = async (req, res) => {
  console.log("🚀 CREATE BON LIVRAISON - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await BonLivraison.sequelize.transaction();

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
      deliveredBy,
      receiverName,
      receiverSignature,
      discountAmount,
      subTotal,
      total,
      remainingAmount,
    } = req.body;

    console.log("📋 Received clientId:", clientId);

    // Validate required fields
    if (!customerName || customerName.trim() === "") {
      console.log("❌ Validation failed: Customer name is required");
      return res.status(400).json({ message: "Customer name is required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ Validation failed: Items are required");
      return res
        .status(400)
        .json({ message: "Delivery note must have at least one item" });
    }

    console.log("✅ All validations passed");

    // Generate delivery number
    console.log("🔢 Generating delivery number...");
    const deliveryNumber = await generateDeliveryNumber();
    console.log("📋 Generated delivery number:", deliveryNumber);

    // Prepare items with correct field names
    console.log("🧮 Preparing items...");
    const preparedItems = items.map((item, index) => {
      console.log(`📦 Item ${index + 1}:`, {
        productId: item.productId,
        quantity: item.quantity,
        v1: item.v1,
        v2: item.v2,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      });

      // Use field names that match your BonLivraisonProduit model
      return {
        produit_id: item.productId, // This must match the foreign key name in BonLivraisonProduit
        quantite: item.quantity,
        v1: item.v1 || 1,
        v2: item.v2 || 1,
        prix_unitaire: item.unitPrice,
        total_ligne: item.totalPrice || 0,
        remise_ligne: 0,
        deliveredQuantity: item.deliveredQuantity || 0,
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

    const calculatedTotal =
      total || Math.max(0, calculatedSubTotal - calculatedDiscount);

    // Calculate advancement
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
      remainingAmount || Math.max(0, calculatedTotal - totalAdvancement);

    console.log("📊 Final calculated values:", {
      subTotal: calculatedSubTotal,
      discount: calculatedDiscount,
      total: calculatedTotal,
      advancement: totalAdvancement,
      remainingAmount: calculatedRemainingAmount,
    });

    // Create the delivery note
    console.log("🔄 Creating BonLivraison...");
    const bonLivraison = await BonLivraison.create(
      {
        deliveryNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone || null,
        issueDate,
        notes,
        status: status || "brouillon",
        discountType: discountType || "fixed",
        discountValue: discountValue || 0,
        paymentType: paymentType || "non_paye",
        advancement: totalAdvancement,
        remainingAmount: calculatedRemainingAmount,
        subTotal: calculatedSubTotal,
        total: calculatedTotal,
        discountAmount: calculatedDiscount,
        client_id: clientId || null,
        preparedById: preparedById || 1,
        preparedBy: preparedBy || "User",
        validatedById: validatedById || 1,
        validatedBy: validatedBy || "Validator",
        deliveredBy: deliveredBy || null,
        receiverName: receiverName || null,
        receiverSignature: receiverSignature || null,
        paymentDate: status === "payée" ? new Date() : null,
      },
      { transaction },
    );

    console.log("✅ BonLivraison created! ID:", bonLivraison.id);

    // Create BonLivraisonProduit items
    console.log("📝 Creating BonLivraisonProduit items...");
    const bonLivraisonItems = await Promise.all(
      preparedItems.map(async (item) => {
        // Add bon_livraison_id to each item
        const itemToCreate = {
          ...item,
          bon_livraison_id: bonLivraison.id, // This must match the foreign key name in BonLivraisonProduit
        };

        console.log(
          "Creating item with data:",
          JSON.stringify(itemToCreate, null, 2),
        );

        const createdItem = await BonLivraisonProduit.create(itemToCreate, {
          transaction,
        });
        return createdItem;
      }),
    );

    console.log(
      `✅ Created ${bonLivraisonItems.length} BonLivraisonProduit items`,
    );

    // Create advancements if any
    if (
      advancements &&
      Array.isArray(advancements) &&
      advancements.length > 0
    ) {
      console.log("💳 Creating advancements...");
      const createdAdvancements = await Promise.all(
        advancements.map((adv) =>
          Advancement.create(
            {
              amount: adv.amount,
              paymentDate: adv.paymentDate || new Date(),
              paymentMethod: adv.paymentMethod || "espece",
              reference: adv.reference || "",
              notes: adv.notes || "",
              bon_livraison_id: bonLivraison.id,
            },
            { transaction },
          ),
        ),
      );
      console.log(`✅ Created ${createdAdvancements.length} advancements`);
    }

    // Commit transaction
    await transaction.commit();

    console.log("🎉 Transaction committed successfully!");

    // Fetch the complete bonLivraison with associations
    const completeBonLivraison = await BonLivraison.findByPk(bonLivraison.id, {
      include: [
        {
          model: BonLivraisonProduit,
          as: "lignes",
          include: [
            {
              model: require("../models/Produit"),
              as: "produit",
            },
          ],
        },
        {
          model: Advancement,
          as: "advancements",
        },
        {
          model: require("../models/client"),
          as: "client",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      bon: {
        id: completeBonLivraison.id,
        num_bon_livraison: completeBonLivraison.deliveryNumber,
        montant_ttc: completeBonLivraison.total,
        montant_restant: completeBonLivraison.remainingAmount,
        status: completeBonLivraison.status,
      },
      totalAdvancements: completeBonLivraison.advancement || 0,
    });
  } catch (err) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error("❌ CREATE BON LIVRAISON - ERROR:");
    console.error("❌ Error name:", err.name);
    console.error("❌ Error message:", err.message);

    if (err.errors) {
      console.error(
        "❌ Validation errors:",
        err.errors.map((e) => ({
          field: e.path,
          message: e.message,
          value: e.value,
        })),
      );
    }

    // Handle specific error types
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Delivery number already exists",
      });
    }

    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => error.message);
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Invalid foreign key reference",
        error: "The product or client referenced does not exist",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getBonLivraisons = async (req, res) => {
  try {
    const bonLivraisons = await BonLivraison.findAll({
      attributes: [
        "id",
        "deliveryNumber",
        "customerName",
        "customerPhone",
        "total",
        "advancement",
        "remainingAmount",
        "status",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json(bonLivraisons);
  } catch (err) {
    console.error("Get delivery notes error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getBonLivraisonsByDate = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let whereCondition = {};
    let advancementWhereCondition = {};

    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        dateFilter[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        dateFilter[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
      }

      // Step 1: Find all bon_livraison_id from advancements in the date range
      const advancementMatches = await Advancement.findAll({
        where: {
          paymentDate: dateFilter,
          bon_livraison_id: { [Op.not]: null },
        },
        attributes: ["bon_livraison_id"],
        group: ["bon_livraison_id"],
        raw: true,
      });

      const matchedIds = advancementMatches.map((a) => a.bon_livraison_id);

      console.log("🔍 Advancement matched IDs:", matchedIds);

      // Step 2: Build OR condition for BonLivraison
      whereCondition = {
        [Op.or]: [
          { createdAt: dateFilter },
          { paymentDate: dateFilter },
          ...(matchedIds.length > 0
            ? [{ id: { [Op.in]: matchedIds } }]
            : []),
        ],
      };

      // Step 3: Only include advancements that match the date range
      advancementWhereCondition = {
        paymentDate: dateFilter,
      };
    }

    const bonLivraisons = await BonLivraison.findAll({
      where: whereCondition,
      attributes: [
        "id",
        "deliveryNumber",
        "customerName",
        "customerPhone",
        "total",
        "advancement",
        "remainingAmount",
        "status",
        "paymentDate",
        "paymentType",
        "createdAt",
      ],
      include: [
        {
          model: Advancement,
          as: "advancements",
          required: false,
          where: Object.keys(advancementWhereCondition).length > 0
            ? advancementWhereCondition
            : undefined,  // ✅ only filter advancements when date range is provided
          attributes: ["id", "amount", "paymentDate", "paymentMethod"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Step 4: Calculate the actual amount paid on the filtered date range per BonLivraison
    const result = bonLivraisons.map((bon) => {
      const bonJson = bon.toJSON();

      // Sum only the advancements that matched the date filter
      const filteredAdvancementTotal = bonJson.advancements.reduce(
        (sum, adv) => sum + parseFloat(adv.amount || 0),
        0
      );

      // If the bon itself was fully paid in the date range (paymentDate matches),
      // and has no advancements, use the total directly
      const paidOnDate =
        bonJson.advancements.length > 0
          ? filteredAdvancementTotal  // partial payments → sum of matched advancements
          : bonJson.paymentDate       // fully paid → use total
          ? bonJson.total
          : 0;

      return {
        ...bonJson,
        paidOnDate, // ✅ amount actually paid in the requested date range
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("Get delivery notes by date error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
const getBonLivraisonById = async (req, res) => {
  try {
    const bonLivraison = await BonLivraison.findByPk(req.params.id, {
      include: [
        {
          model: BonLivraisonProduit,
          as: "lignes",
          include: [
            {
              model: Produit, // Make sure Produit is imported
              as: "produit", // This should match the association name in your BonLivraisonProduit model
            },
          ],
        },
        { model: Client, as: "client" },
        { model: Advancement, as: "advancements" },
        { model: User, as: "preparator", attributes: ["id", "name", "email"] },
        { model: User, as: "validator", attributes: ["id", "name", "email"] },
      ],
    });

    if (!bonLivraison) {
      return res.status(404).json({ message: "Delivery note not found" });
    }

    return res.json(bonLivraison);
  } catch (err) {
    console.error("Get delivery note error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const updateBonLivraison = async (req, res) => {
  console.log("🚀 UPDATE BON LIVRAISON - START");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  const transaction = await BonLivraison.sequelize.transaction();

  try {
    const bonLivraison = await BonLivraison.findByPk(req.params.id, {
      include: [
        { model: BonLivraisonProduit, as: "lignes" },
        { model: Advancement, as: "advancements" },
      ],
    });

    if (!bonLivraison) {
      return res.status(404).json({ message: "Delivery note not found" });
    }

    const {
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
      validatedBy,
      deliveredBy,
      receiverName,
      receiverSignature,
      discountAmount,
      subTotal,
      total,
      remainingAmount,
      clientId,
    } = req.body;

    console.log("📋 Updating delivery note ID:", bonLivraison.id);
    console.log("📋 Current status:", bonLivraison.status);
    console.log("📋 New status:", status);

    if (!customerName || customerName.trim() === "") {
      console.log("❌ Validation failed: Customer name is required");
      await transaction.rollback();
      return res.status(400).json({ message: "Customer name is required" });
    }

    console.log("✅ Basic validations passed");

    let preparedItems = [];
    let calculatedSubTotal = subTotal || bonLivraison.subTotal || 0;

    if (items && Array.isArray(items) && items.length > 0) {
      console.log("🧮 Preparing items for update...");

      for (const item of items) {
        if (!item.quantite || parseFloat(item.quantite) <= 0) {
          console.log("❌ Validation failed: Quantity must be positive");
          await transaction.rollback();
          return res.status(400).json({
            message: "Quantity must be positive for all items",
          });
        }
      }

      preparedItems = items.map((item, index) => {
        console.log(`📦 Item ${index + 1}:`, {
          id: item.id,
          produit_id: item.produit_id,
          quantite: item.quantite,
          v1: item.v1,
          v2: item.v2,
          v3: item.v3,
          prix_unitaire: item.prix_unitaire,
          designation: item.designation,
        });

        return {
          id: item.id || null,
          produit_id: item.produit_id || null,
          quantite: parseFloat(item.quantite) || 1,
          v1: parseFloat(item.v1) || 1,
          v2: parseFloat(item.v2) || 1,
          v3: parseFloat(item.v3) || 1,
          prix_unitaire: parseFloat(item.prix_unitaire) || 0,
          total_ligne: parseFloat(item.total_ligne) || 0,
          remise_ligne: parseFloat(item.remise_ligne) || 0,
          deliveredQuantity:
            parseFloat(item.deliveredQuantity) ||
            parseFloat(item.quantite) ||
            0,
          designation: item.designation || null,
        };
      });

      calculatedSubTotal = preparedItems.reduce(
        (sum, item) => sum + (item.total_ligne || 0),
        0,
      );
    } else {
      console.log("ℹ️ No items provided for update, keeping existing items");
    }

    console.log("💰 Calculating totals...");

    const calculatedDiscount =
      discountAmount !== undefined
        ? discountAmount
        : discountType === "percentage"
          ? (calculatedSubTotal * (discountValue || 0)) / 100
          : discountValue !== undefined
            ? discountValue
            : bonLivraison.discountValue || 0;

    const calculatedTotal =
      total !== undefined
        ? total
        : Math.max(0, calculatedSubTotal - calculatedDiscount);

    let totalAdvancement = bonLivraison.advancement || 0;
    if (advancements && Array.isArray(advancements)) {
      totalAdvancement = advancements.reduce(
        (sum, adv) => sum + parseFloat(adv.amount || 0),
        0,
      );
    } else if (advancement !== undefined) {
      totalAdvancement = Number(advancement);
    }

    const calculatedRemainingAmount =
      remainingAmount !== undefined
        ? remainingAmount
        : Math.max(0, calculatedTotal - totalAdvancement);

    console.log("📊 Final calculated values:", {
      subTotal: calculatedSubTotal,
      discount: calculatedDiscount,
      total: calculatedTotal,
      advancement: totalAdvancement,
      remainingAmount: calculatedRemainingAmount,
    });

    console.log("🔄 Updating BonLivraison...");

    const updateFields = {
      customerName: customerName?.trim() || bonLivraison.customerName,
      customerPhone:
        customerPhone !== undefined
          ? customerPhone
          : bonLivraison.customerPhone,
      issueDate: issueDate || bonLivraison.issueDate,
      notes: notes !== undefined ? notes : bonLivraison.notes,
      discountType: discountType || bonLivraison.discountType || "fixed",
      discountValue:
        discountValue !== undefined
          ? discountValue
          : bonLivraison.discountValue || 0,
      paymentType: paymentType || bonLivraison.paymentType || "non_paye",
      advancement: totalAdvancement,
      remainingAmount: calculatedRemainingAmount,
      subTotal: calculatedSubTotal,
      total: calculatedTotal,
      discountAmount: calculatedDiscount,
      client_id: clientId || bonLivraison.client_id,
      preparedById: bonLivraison.preparedById || 1,
      preparedBy:
        preparedBy !== undefined
          ? preparedBy
          : bonLivraison.preparedBy || "User",
      validatedById: bonLivraison.validatedById || 1,
      validatedBy:
        validatedBy !== undefined
          ? validatedBy
          : bonLivraison.validatedBy || "Validator",
      deliveredBy:
        deliveredBy !== undefined ? deliveredBy : bonLivraison.deliveredBy,
      receiverName:
        receiverName !== undefined ? receiverName : bonLivraison.receiverName,
      receiverSignature:
        receiverSignature !== undefined
          ? receiverSignature
          : bonLivraison.receiverSignature,
    };

    // ✅ FIX: Handle status + paymentDate together
    if (status !== undefined) {
      console.log("Setting status from:", bonLivraison.status, "to:", status);
      updateFields.status = status;

      if (status === "payée") {
        // Only set paymentDate on FIRST transition to "payée"
        // If already "payée", preserve the original payment date
        updateFields.paymentDate = bonLivraison.paymentDate ?? new Date();
        console.log("💳 paymentDate:", updateFields.paymentDate);
      } else {
        updateFields.paymentDate = null;
        console.log("🔄 paymentDate cleared");
      }
    }

    // ✅ FIX: Apply all fields including null values (for paymentDate reset)
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        bonLivraison[key] = updateFields[key];
      }
    });

    // ✅ FIX: Explicitly apply paymentDate since null must pass through the undefined check
    if (updateFields.hasOwnProperty("paymentDate")) {
      bonLivraison.paymentDate = updateFields.paymentDate;
    }

    await bonLivraison.save({ transaction });
    console.log("✅ BonLivraison updated! ID:", bonLivraison.id);

    if (items && Array.isArray(items) && items.length > 0) {
      console.log("📝 Updating BonLivraisonProduit items...");

      const receivedIds = items
        .filter((item) => item.id && !String(item.id).startsWith("temp-"))
        .map((item) => parseInt(item.id));

      const existingIds = bonLivraison.lignes.map((l) => l.id);

      const toDelete = existingIds.filter((id) => !receivedIds.includes(id));
      if (toDelete.length > 0) {
        const deletedCount = await BonLivraisonProduit.destroy({
          where: { id: toDelete },
          transaction,
        });
        console.log(`✅ Deleted ${deletedCount} items`);
      }

      for (const item of preparedItems) {
        const itemData = {
          produit_id: item.produit_id,
          quantite: item.quantite,
          v1: item.v1,
          v2: item.v2,
          v3: item.v3,
          prix_unitaire: item.prix_unitaire,
          total_ligne: item.total_ligne,
          remise_ligne: item.remise_ligne,
          deliveredQuantity: item.deliveredQuantity,
          designation: item.designation,
          bon_livraison_id: bonLivraison.id,
        };

        if (item.id && !String(item.id).toString().startsWith("temp-")) {
          await BonLivraisonProduit.update(itemData, {
            where: { id: item.id },
            transaction,
          });
          console.log(`✅ Updated item ${item.id}`);
        } else {
          await BonLivraisonProduit.create(itemData, { transaction });
          console.log(`✅ Created new item`);
        }
      }
    } else {
      console.log("ℹ️ No items to update, keeping existing items");
    }

    console.log("💳 Updating advancements...");

    const deletedAdvancements = await Advancement.destroy({
      where: { bon_livraison_id: bonLivraison.id },
      transaction,
    });
    console.log(`✅ Deleted ${deletedAdvancements} existing advancements`);

    if (
      advancements &&
      Array.isArray(advancements) &&
      advancements.length > 0
    ) {
      const advancementsToCreate = advancements.map((adv) => ({
        amount: adv.amount,
        paymentDate: adv.paymentDate || new Date(),
        paymentMethod: adv.paymentMethod || "espece",
        reference: adv.reference || "",
        notes: adv.notes || "",
        bon_livraison_id: bonLivraison.id,
      }));

      const createdAdvancements = await Advancement.bulkCreate(
        advancementsToCreate,
        { transaction, returning: true },
      );
      console.log(`✅ Created ${createdAdvancements.length} advancements`);
    }

    await transaction.commit();
    console.log("🎉 Transaction committed successfully!");

    const completeBonLivraison = await BonLivraison.findByPk(bonLivraison.id, {
      include: [
        {
          model: BonLivraisonProduit,
          as: "lignes",
          include: [
            {
              model: require("../models/Produit"),
              as: "produit",
            },
          ],
        },
        {
          model: Advancement,
          as: "advancements",
        },
        {
          model: require("../models/client"),
          as: "client",
        },
      ],
    });

    return res.json({
      success: true,
      message: "Delivery note updated successfully",
      bon: {
        id: completeBonLivraison.id,
        num_bon_livraison: completeBonLivraison.deliveryNumber,
        montant_ttc: completeBonLivraison.total,
        montant_restant: completeBonLivraison.remainingAmount,
        status: completeBonLivraison.status,
      },
      totalAdvancements: completeBonLivraison.advancement || 0,
      bonLivraison: completeBonLivraison,
    });
  } catch (err) {
    await transaction.rollback();

    console.error("❌ UPDATE BON LIVRAISON - ERROR:");
    console.error("❌ Error name:", err.name);
    console.error("❌ Error message:", err.message);
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

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Delivery number already exists",
        error: err.message,
      });
    }

    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => error.message);
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Invalid foreign key reference",
        error: "The product or client referenced does not exist",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const deleteBonLivraison = async (req, res) => {
  try {
    const bonLivraison = await BonLivraison.findByPk(req.params.id);
    if (!bonLivraison) {
      return res.status(404).json({ message: "Delivery note not found" });
    }

    await bonLivraison.destroy();
    return res.json({ message: "Delivery note deleted successfully" });
  } catch (err) {
    console.error("Delete delivery note error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const addAdvancementToBonLivraison = async (req, res) => {
  try {
    const { bonLivraisonId } = req.params;
    const { amount, paymentDate, paymentMethod, reference, notes } = req.body;

    const bonLivraison = await BonLivraison.findByPk(bonLivraisonId);
    if (!bonLivraison) {
      return res.status(404).json({ message: "Delivery note not found" });
    }

    const advancement = await Advancement.create({
      amount,
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || "espece",
      reference: reference || "",
      notes: notes || "",
      bonLivraisonId: bonLivraison.id,
    });

    // Recalculate totals
    await bonLivraison.reload({
      include: [
        { model: BonLivraisonItem, as: "items" },
        { model: Advancement, as: "advancements" },
      ],
    });
    bonLivraison.calculateTotals();
    await bonLivraison.save();

    return res.json({
      message: "Advancement added successfully to delivery note",
      advancement,
      bonLivraison,
    });
  } catch (err) {
    console.error("Add advancement to delivery note error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const generateBonLivraisonPDF = async (req, res) => {
  try {
    const bonLivraison = await BonLivraison.findByPk(req.params.id, {
      include: [
        { model: BonLivraisonItem, as: "items" },
        { model: Advancement, as: "advancements" },
      ],
    });

    if (!bonLivraison) {
      return res.status(404).json({ message: "Delivery note not found" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=bon-livraison-${bonLivraison.deliveryNumber}.pdf`,
    );

    doc.pipe(res);

    // ===== HEADER =====
    doc.rect(0, 0, doc.page.width, 100).fill("#28a745"); // green header for delivery note
    doc
      .fillColor("white")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("BON DE LIVRAISON", 50, 40);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`N°: ${bonLivraison.deliveryNumber}`, 450, 40)
      .text(
        `Date d'émission: ${new Date(bonLivraison.issueDate).toLocaleDateString(
          "fr-FR",
        )}`,
        450,
        60,
      )
      .text(
        `Date de livraison: ${new Date(
          bonLivraison.deliveryDate,
        ).toLocaleDateString("fr-FR")}`,
        450,
        80,
      );

    doc.moveDown(3);

    // ===== CLIENT INFO =====
    doc
      .fillColor("#333")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Informations du client", 50, 130);
    doc.moveTo(50, 145).lineTo(550, 145).strokeColor("#28a745").stroke();

    doc
      .font("Helvetica")
      .fontSize(12)
      .text(`Nom du client : ${bonLivraison.customerName}`, 50, 160)
      .text(`Téléphone : ${bonLivraison.customerPhone || "—"}`, 50, 180);

    doc.moveDown(2);

    // ===== ITEMS TABLE =====
    const tableTop = bonLivraison.deliveryAddress ? 280 : 220;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#28a745")
      .text("Article", 50, tableTop)
      .text("Quantité", 200, tableTop)
      .text("Livrée", 280, tableTop)
      .text("Prix Unitaire", 350, tableTop)
      .text("Total", 470, tableTop);
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .strokeColor("#ccc")
      .stroke();

    let yPosition = tableTop + 25;
    doc.font("Helvetica").fontSize(12).fillColor("#000");

    bonLivraison.items.forEach((item, i) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      doc.text(item.articleName || `Article ${i + 1}`, 50, yPosition);
      doc.text(item.quantity.toString(), 220, yPosition);
      doc.text(
        (item.deliveredQuantity || item.quantity).toString(),
        300,
        yPosition,
      );
      doc.text(`${item.unitPrice} DH`, 370, yPosition);
      doc.text(`${item.totalPrice} DH`, 470, yPosition);
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
      .text(`Sous-total:`, 350, yPosition)
      .text(`${bonLivraison.subTotal} DH`, 470, yPosition, { align: "right" });

    if (bonLivraison.discountValue > 0) {
      yPosition += 20;
      const discountText =
        bonLivraison.discountType === "percentage"
          ? `Remise (${bonLivraison.discountValue}%):`
          : "Remise:";
      doc
        .text(discountText, 350, yPosition)
        .text(`-${bonLivraison.discountAmount} DH`, 470, yPosition, {
          align: "right",
        });
    }

    yPosition += 25;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#28a745")
      .text(`Total TTC:`, 350, yPosition)
      .text(`${bonLivraison.total} DH`, 470, yPosition, { align: "right" });

    // ===== ADVANCEMENTS =====
    if (bonLivraison.advancements && bonLivraison.advancements.length > 0) {
      yPosition += 40;
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor("#333")
        .text("Acomptes:", 50, yPosition);
      yPosition += 20;

      doc.font("Helvetica").fontSize(12);
      bonLivraison.advancements.forEach((a) => {
        doc.text(
          `- ${a.amount} DH (${a.paymentMethod}) - ${new Date(
            a.paymentDate,
          ).toLocaleDateString("fr-FR")}`,
          60,
          yPosition,
        );
        yPosition += 15;
      });

      yPosition += 10;
      doc
        .font("Helvetica-Bold")
        .text(
          `Montant restant: ${bonLivraison.remainingAmount} DH`,
          50,
          yPosition,
        );
    }

    // ===== DELIVERY INFORMATION =====
    yPosition += 40;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#333")
      .text("Informations de livraison:", 50, yPosition);

    yPosition += 20;
    doc.font("Helvetica").fontSize(12);

    // ===== NOTES =====
    if (bonLivraison.notes) {
      yPosition += 30;
      doc
        .font("Helvetica-Bold")
        .fillColor("#333")
        .text("Notes:", 50, yPosition);
      yPosition += 15;
      doc
        .font("Helvetica")
        .fillColor("#000")
        .text(bonLivraison.notes, 50, yPosition, { width: 500 });
    }

    // ===== SIGNATURE =====
    if (bonLivraison.receiverSignature) {
      yPosition += 50;
      doc.font("Helvetica-Bold").text("Signature du client:", 50, yPosition);

      // You could add signature image handling here if needed
      doc
        .font("Helvetica")
        .fontSize(10)
        .text("(Signature ci-dessus)", 50, yPosition + 40);
    }

    doc.end();
  } catch (err) {
    console.error("Generate delivery note PDF error:", err);
    return res.status(500).json({
      message: "Error generating PDF",
      error: err.message,
    });
  }
};

module.exports = {
  createBonLivraison,
  getBonLivraisons,
  getBonLivraisonsByDate,
  getBonLivraisonById,
  updateBonLivraison,
  deleteBonLivraison,
  addAdvancementToBonLivraison,
  generateBonLivraisonPDF,
};
