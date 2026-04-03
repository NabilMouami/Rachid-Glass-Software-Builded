const { Fornisseur, Produit, FactureAchat, FactureAchatProduit } = require("../models");

const { Op } = require("sequelize");
const sequelize = require("../config/db");

// Create a new fornisseur
const createFornisseur = async (req, res) => {
  try {
    const { nom_complete, ville, address, telephone, reference } = req.body;

    // Validation
    if (!nom_complete || !telephone) {
      return res.status(400).json({
        message: "Nom complet and telephone are required",
      });
    }

    // Check if telephone already exists
    const existingTelephone = await Fornisseur.findOne({
      where: { telephone },
    });
    if (existingTelephone) {
      return res.status(409).json({
        message: "Telephone number already in use",
      });
    }

    // Check if reference already exists (if provided)
    if (reference) {
      const existingReference = await Fornisseur.findOne({
        where: { reference },
      });
      if (existingReference) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Create fornisseur
    const fornisseur = await Fornisseur.create({
      nom_complete,
      ville,
      address,
      telephone,
      reference,
    });

    return res.status(201).json({
      message: "Fornisseur created successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        ville: fornisseur.ville,
        address: fornisseur.address,
        telephone: fornisseur.telephone,
        reference: fornisseur.reference,
        createdAt: fornisseur.createdAt,
        updatedAt: fornisseur.updatedAt,
      },
    });
  } catch (err) {
    console.error(err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      }));
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value. Telephone or reference already exists.",
        field: err.errors[0].path,
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all fornisseurs
const getAllFornisseurs = async (req, res) => {
  try {
    const { search } = req.query;

    // Build where clause for search
    const whereCondition = {};
    if (search) {
      whereCondition[Op.or] = [
        {
          nom_complete: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          telephone: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          reference: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          ville: {
            [Op.like]: `%${search}%`,
          },
        },
      ];
    }

    // Get all fornisseurs
    const fornisseurs = await Fornisseur.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      message: "Fornisseurs retrieved successfully",
      fornisseurs,
      count: fornisseurs.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get fornisseur by ID
const getFornisseurById = async (req, res) => {
  try {
    const { id } = req.params;

    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    return res.json({
      message: "Fornisseur retrieved successfully",
      fornisseur,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update fornisseur
const updateFornisseur = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_complete, ville, address, telephone, reference } = req.body;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Check if telephone is being changed and if it's already in use
    if (telephone && telephone !== fornisseur.telephone) {
      const existingTelephone = await Fornisseur.findOne({
        where: { telephone },
      });
      if (existingTelephone && existingTelephone.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Telephone number already in use",
        });
      }
    }

    // Check if reference is being changed and if it's already in use
    if (reference && reference !== fornisseur.reference) {
      const existingReference = await Fornisseur.findOne({
        where: { reference },
      });
      if (existingReference && existingReference.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (nom_complete) updateData.nom_complete = nom_complete;
    if (ville !== undefined) updateData.ville = ville;
    if (address !== undefined) updateData.address = address;
    if (telephone) updateData.telephone = telephone;
    if (reference !== undefined) updateData.reference = reference;

    // Update fornisseur
    await fornisseur.update(updateData);

    // Refresh to get updated data
    await fornisseur.reload();

    return res.json({
      message: "Fornisseur updated successfully",
      fornisseur,
    });
  } catch (err) {
    console.error(err);

    // Handle Sequelize validation errors
    if (err.name === "SequelizeValidationError") {
      const errors = err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      }));
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    // Handle unique constraint errors
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value. Telephone or reference already exists.",
        field: err.errors[0].path,
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Delete fornisseur
const deleteFornisseur = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    // Delete fornisseur
    await fornisseur.destroy();

    return res.json({
      message: "Fornisseur deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Search fornisseurs
const searchFornisseurs = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const fornisseurs = await Fornisseur.findAll({
      where: {
        [Op.or]: [
          {
            nom_complete: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            telephone: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            reference: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            ville: {
              [Op.like]: `%${q}%`,
            },
          },
        ],
      },
      order: [["nom_complete", "ASC"]],
      limit: 50,
    });

    return res.json({
      message: "Search results",
      fornisseurs,
      count: fornisseurs.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get fornisseur statistics
const getFornisseurStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");

    // Count total fornisseurs
    const totalFornisseurs = await Fornisseur.count();

    // Count fornisseurs by city
    const fornisseursByCity = await Fornisseur.findAll({
      attributes: [
        "ville",
        [sequelize.fn("COUNT", sequelize.col("ville")), "count"],
      ],
      group: ["ville"],
      order: [[sequelize.fn("COUNT", sequelize.col("ville")), "DESC"]],
      where: {
        ville: {
          [Op.ne]: null,
        },
      },
      limit: 10,
    });

    // Count fornisseurs created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newFornisseursThisMonth = await Fornisseur.count({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth,
        },
      },
    });

    // Count fornisseurs with reference
    const withReference = await Fornisseur.count({
      where: {
        reference: {
          [Op.ne]: null,
        },
      },
    });

    return res.json({
      message: "Fornisseur statistics",
      statistics: {
        totalFornisseurs,
        newFornisseursThisMonth,
        withReference,
        withoutReference: totalFornisseurs - withReference,
        fornisseursByCity,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get recent FacturesAchat for a fornisseur
const getFornisseurRecentFacturesAchat = async (req, res) => {
  try {
    const { id } = req.params;

    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({ message: "Fornisseur not found" });
    }

    const recentFactures = await FactureAchat.findAll({
      where: { fornisseurId: id },
      order: [["issueDate", "DESC"]],
      limit: 50,
      attributes: [
        "id",
        "invoiceNumber",
        "issueDate",
        "totalHT",
        "totalTTC",
        "status",
        "paymentType",
        "createdAt",
      ],
    });

    return res.json({
      message: "Recent factures retrieved successfully",
      recentFacturesAchat: recentFactures,
    });
  } catch (err) {
    console.error("Error in getFornisseurRecentFacturesAchat:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all products purchased from a fornisseur with stats
const getFornisseurProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({ message: "Fornisseur not found" });
    }

    // Build date filter on FactureAchat
    const factureWhere = { fornisseurId: id };
    if (startDate || endDate) {
      factureWhere.issueDate = {};
      if (startDate) factureWhere.issueDate[Op.gte] = new Date(startDate);
      if (endDate) factureWhere.issueDate[Op.lte] = new Date(endDate);
    }

    // Get all product lines for this fornisseur
    const lines = await FactureAchatProduit.findAll({
      include: [
        {
          model: FactureAchat,
          as: "factureAchat",
          where: factureWhere,
          attributes: ["id", "invoiceNumber", "issueDate", "status"],
          required: true,
        },
        {
          model: Produit,
          as: "produit",
          attributes: ["id", "designation", "reference", "prix_achat"],
        },
      ],
    });

    // Group by product
    const productMap = {};
    lines.forEach((line) => {
      const produitId = line.produit_id;
      if (!productMap[produitId]) {
        productMap[produitId] = {
          product: line.produit,
          totalQuantity: 0,
          totalAmount: 0,
          firstPurchase: line.factureAchat.issueDate,
          lastPurchase: line.factureAchat.issueDate,
          count: 0,
        };
      }
      const entry = productMap[produitId];
      entry.totalQuantity += parseFloat(line.quantite || 0);
      entry.totalAmount += parseFloat(line.total_ligne || 0);
      entry.count += 1;
      if (new Date(line.factureAchat.issueDate) < new Date(entry.firstPurchase)) {
        entry.firstPurchase = line.factureAchat.issueDate;
      }
      if (new Date(line.factureAchat.issueDate) > new Date(entry.lastPurchase)) {
        entry.lastPurchase = line.factureAchat.issueDate;
      }
    });

    const products = Object.values(productMap).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    const totalAmount = products.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);

    return res.json({
      message: "Products retrieved successfully",
      products,
      statistics: {
        totalProducts: products.length,
        totalQuantity,
        totalAmount,
        averagePerProduct: products.length > 0 ? totalAmount / products.length : 0,
      },
    });
  } catch (err) {
    console.error("Error in getFornisseurProducts:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get product history by reference for a fornisseur
const getFornisseurProductHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { reference, startDate, endDate } = req.query;

    if (!reference) {
      return res.status(400).json({ message: "Product reference is required" });
    }

    const fornisseur = await Fornisseur.findByPk(id);
    if (!fornisseur) {
      return res.status(404).json({ message: "Fornisseur not found" });
    }

    // Build date filter
    const factureWhere = { fornisseurId: id };
    if (startDate || endDate) {
      factureWhere.issueDate = {};
      if (startDate) factureWhere.issueDate[Op.gte] = new Date(startDate);
      if (endDate) factureWhere.issueDate[Op.lte] = new Date(endDate);
    }

    // Product filter
    const produitWhere = {
      reference: { [Op.like]: `%${reference}%` },
    };

    const lines = await FactureAchatProduit.findAll({
      include: [
        {
          model: FactureAchat,
          as: "factureAchat",
          where: factureWhere,
          attributes: ["id", "invoiceNumber", "issueDate", "status", "totalTTC"],
          required: true,
        },
        {
          model: Produit,
          as: "produit",
          where: produitWhere,
          attributes: ["id", "designation", "reference", "prix_achat"],
          required: true,
        },
      ],
      order: [[{ model: FactureAchat, as: "factureAchat" }, "issueDate", "DESC"]],
    });

    // Build history items
    const history = lines.map((line) => ({
      document: {
        id: line.factureAchat.id,
        num: line.factureAchat.invoiceNumber,
        status: line.factureAchat.status,
      },
      issueDate: line.factureAchat.issueDate,
      produit: line.produit,
      quantite: line.quantite,
      prix_unitaire: line.prix_unitaire,
      total_ligne: line.total_ligne,
    }));

    // Group by product for statistics
    const productMap = {};
    history.forEach((item) => {
      const ref = item.produit?.reference;
      if (!productMap[ref]) {
        productMap[ref] = {
          product: item.produit,
          appearances: 0,
          totalQuantity: 0,
          totalAmount: 0,
          prices: [],
          firstSeen: item.issueDate,
          lastSeen: item.issueDate,
        };
      }
      const entry = productMap[ref];
      entry.appearances += 1;
      entry.totalQuantity += parseFloat(item.quantite || 0);
      entry.totalAmount += parseFloat(item.total_ligne || 0);
      entry.prices.push(parseFloat(item.prix_unitaire || 0));
      if (new Date(item.issueDate) < new Date(entry.firstSeen)) entry.firstSeen = item.issueDate;
      if (new Date(item.issueDate) > new Date(entry.lastSeen)) entry.lastSeen = item.issueDate;
    });

    const productStatistics = Object.values(productMap).map((p) => ({
      ...p,
      averageUnitPrice: p.prices.length > 0 ? (p.prices.reduce((a, b) => a + b, 0) / p.prices.length).toFixed(2) : 0,
      minUnitPrice: p.prices.length > 0 ? Math.min(...p.prices).toFixed(2) : 0,
      maxUnitPrice: p.prices.length > 0 ? Math.max(...p.prices).toFixed(2) : 0,
    }));

    const totalQuantity = history.reduce((sum, h) => sum + parseFloat(h.quantite || 0), 0);
    const totalAmount = history.reduce((sum, h) => sum + parseFloat(h.total_ligne || 0), 0);

    return res.json({
      message: "Product history retrieved successfully",
      history,
      productStatistics,
      summary: {
        totalEntries: history.length,
        totalUniqueProducts: productStatistics.length,
        totalQuantity,
        totalAmount,
      },
    });
  } catch (err) {
    console.error("Error in getFornisseurProductHistory:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createFornisseur,
  getAllFornisseurs,
  getFornisseurById,
  updateFornisseur,
  deleteFornisseur,
  searchFornisseurs,
  getFornisseurStats,
  getFornisseurRecentFacturesAchat,
  getFornisseurProducts,
  getFornisseurProductHistory,
};
