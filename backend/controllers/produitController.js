const {
  Produit,
  Fornisseur,
  Client,
  Devis,
  DevisItem,
  BonLivraison,
  BonLivraisonProduit,
  Facture,
  FactureProduit,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

// Create a new produit
const createProduit = async (req, res) => {
  try {
    const {
      reference,
      designation,
      observation,
      qty,
      prix_achat,
      prix_vente,
      L1,
      L2,
      surface,
      prix_total,
      prix_vente_min,
      prix_vente_max,
      fornisseurId,
    } = req.body;

    // Validation
    if (
      !reference ||
      !designation ||
      prix_achat === undefined ||
      prix_vente === undefined
    ) {
      return res.status(400).json({
        message:
          "Reference, designation, prix_achat and prix_vente are required",
      });
    }

    // Check if reference already exists
    const existingReference = await Produit.findOne({ where: { reference } });
    if (existingReference) {
      return res.status(409).json({
        message: "Reference already in use",
      });
    }

    // Check if fornisseur exists if provided
    if (fornisseurId) {
      const fornisseur = await Fornisseur.findByPk(fornisseurId);
      if (!fornisseur) {
        return res.status(404).json({
          message: "Fornisseur not found",
        });
      }
    }

    // Calculate prix_total if not provided but we have surface, prix_vente and qty
    let calculatedPrixTotal = prix_total;
    if (!calculatedPrixTotal && surface && prix_vente && qty) {
      calculatedPrixTotal =
        parseFloat(surface) * parseFloat(prix_vente) * parseInt(qty || 0);
    }

    // Create produit - surface is set directly by user
    const produit = await Produit.create({
      reference,
      designation,
      observation,
      qty: qty || 0,
      prix_achat: parseFloat(prix_achat),
      prix_vente: parseFloat(prix_vente),
      L1: L1 ? parseInt(L1) : null,
      L2: L2 ? parseInt(L2) : null,
      surface: surface ? parseFloat(surface) : 0,
      prix_total: calculatedPrixTotal ? parseFloat(calculatedPrixTotal) : null,
      prix_vente_min: prix_vente_min ? parseFloat(prix_vente_min) : null,
      prix_vente_max: prix_vente_max ? parseFloat(prix_vente_max) : null,
      fornisseurId: fornisseurId ? parseInt(fornisseurId) : null,
    });

    // Load with fornisseur info
    const createdProduit = await Produit.findByPk(produit.id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville"],
        },
      ],
    });

    return res.status(201).json({
      message: "Produit created successfully",
      produit: createdProduit,
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
        message: "Duplicate reference. This reference already exists.",
        field: "reference",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get all produits with optional filters
// Get all produits with optional filters
const getAllProduits = async (req, res) => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      minStock,
      fornisseurId,
      minSurface,
      maxSurface,
    } = req.query;

    // Build where clause
    const whereCondition = {};

    // Search in reference and designation
    if (search) {
      whereCondition[Op.or] = [
        {
          reference: {
            [Op.like]: `%${search}%`,
          },
        },
        {
          designation: {
            [Op.like]: `%${search}%`,
          },
        },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      whereCondition.prix_vente = {};
      if (minPrice) whereCondition.prix_vente[Op.gte] = parseFloat(minPrice);
      if (maxPrice) whereCondition.prix_vente[Op.lte] = parseFloat(maxPrice);
    }

    // Surface range filter
    if (minSurface || maxSurface) {
      whereCondition.surface = {};
      if (minSurface) whereCondition.surface[Op.gte] = parseFloat(minSurface);
      if (maxSurface) whereCondition.surface[Op.lte] = parseFloat(maxSurface);
    }

    // Stock filter
    if (minStock !== undefined) {
      whereCondition.qty = {
        [Op.gte]: parseInt(minStock),
      };
    }

    // Fornisseur filter
    if (fornisseurId) {
      whereCondition.fornisseurId = parseInt(fornisseurId);
    }

    // Get all produits with fornisseur info
    const produits = await Produit.findAll({
      where: whereCondition,
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate total value
    const totalValue = produits.reduce((sum, produit) => {
      return sum + produit.qty * produit.prix_achat;
    }, 0);

    // Calculate total sales value (based on prix_vente) - FIXED
    const totalSalesValue = produits.reduce((sum, produit) => {
      // Calculate product value: either prix_total, or surface * prix_vente * qty, or 0
      let productValue = 0;

      if (produit.prix_total) {
        productValue = parseFloat(produit.prix_total) || 0;
      } else if (produit.surface && produit.prix_vente && produit.qty) {
        productValue =
          (parseFloat(produit.surface) || 0) *
          (parseFloat(produit.prix_vente) || 0) *
          (parseInt(produit.qty) || 0);
      }

      return sum + productValue;
    }, 0);

    return res.json({
      message: "Produits retrieved successfully",
      produits,
      count: produits.length,
      totalValue: totalValue ? parseFloat(totalValue.toFixed(2)) : 0,
      totalSalesValue: totalSalesValue
        ? parseFloat(totalSalesValue.toFixed(2))
        : 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
// Get produit by ID
const getProduitById = async (req, res) => {
  try {
    const { id } = req.params;

    const produit = await Produit.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville", "address"],
        },
      ],
    });

    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    return res.json({
      message: "Produit retrieved successfully",
      produit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update produit
const updateProduit = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference,
      designation,
      observation,
      qty,
      prix_achat,
      prix_vente,
      fornisseurId,
      L1,
      L2,
      surface,
      prix_total,
      prix_vente_min,
      prix_vente_max,
    } = req.body;

    // Check if produit exists
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    // Check if reference is being changed and if it's already in use
    if (reference && reference !== produit.reference) {
      const existingReference = await Produit.findOne({ where: { reference } });
      if (existingReference && existingReference.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Reference already in use",
        });
      }
    }

    // Check if fornisseur exists (if fornisseurId is provided)
    if (fornisseurId !== undefined && fornisseurId) {
      const fornisseur = await Fornisseur.findByPk(fornisseurId);
      if (!fornisseur) {
        return res.status(404).json({
          message: "Fornisseur not found",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (reference !== undefined) updateData.reference = reference;
    if (designation !== undefined) updateData.designation = designation;
    if (observation !== undefined) updateData.observation = observation;
    if (qty !== undefined) updateData.qty = parseInt(qty);
    if (prix_achat !== undefined)
      updateData.prix_achat = parseFloat(prix_achat);
    if (prix_vente !== undefined)
      updateData.prix_vente = parseFloat(prix_vente);
    if (L1 !== undefined) updateData.L1 = L1 ? parseInt(L1) : null;
    if (L2 !== undefined) updateData.L2 = L2 ? parseInt(L2) : null;
    if (surface !== undefined)
      updateData.surface = surface ? parseFloat(surface) : 0;
    if (prix_total !== undefined)
      updateData.prix_total = prix_total ? parseFloat(prix_total) : null;
    if (prix_vente_min !== undefined)
      updateData.prix_vente_min = prix_vente_min
        ? parseFloat(prix_vente_min)
        : null;
    if (prix_vente_max !== undefined)
      updateData.prix_vente_max = prix_vente_max
        ? parseFloat(prix_vente_max)
        : null;
    if (fornisseurId !== undefined)
      updateData.fornisseurId = fornisseurId || null;

    // Update produit - surface is set directly by user
    await produit.update(updateData);

    // Load updated produit with fornisseur info
    const updatedProduit = await Produit.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville"],
        },
      ],
    });

    return res.json({
      message: "Produit updated successfully",
      produit: updatedProduit,
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
        message: "Duplicate reference. This reference already exists.",
        field: "reference",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Delete produit
const deleteProduit = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if produit exists
    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    // Check if produit has stock
    if (produit.qty > 0) {
      return res.status(400).json({
        message:
          "Cannot delete produit with existing stock. Please clear stock first.",
      });
    }

    // Delete produit
    await produit.destroy();

    return res.json({
      message: "Produit deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update stock quantity
// Update stock quantity
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { qty, operation } = req.body; // operation: 'add', 'subtract', 'set'

    if (qty === undefined || qty < 0) {
      return res.status(400).json({
        message: "Valid quantity is required",
      });
    }

    const produit = await Produit.findByPk(id);
    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    let newQty;
    switch (operation) {
      case "add":
        newQty = produit.qty + parseInt(qty);
        break;
      case "subtract":
        newQty = produit.qty - parseInt(qty);
        if (newQty < 0) {
          return res.status(400).json({
            message: "Insufficient stock",
          });
        }
        break;
      case "set":
        newQty = parseInt(qty);
        break;
      default:
        return res.status(400).json({
          message: "Invalid operation. Use 'add', 'subtract', or 'set'",
        });
    }

    await produit.update({ qty: newQty });

    // Recalculate prix_total if surface and prix_vente exist - FIXED
    let newPrixTotal = produit.prix_total;
    if (produit.surface && produit.prix_vente) {
      newPrixTotal =
        (parseFloat(produit.surface) || 0) *
        (parseFloat(produit.prix_vente) || 0) *
        newQty;
      await produit.update({ prix_total: newPrixTotal });
    }

    // Get updated produit
    const updatedProduit = await Produit.findByPk(id);

    return res.json({
      message: "Stock updated successfully",
      produit: {
        id: updatedProduit.id,
        reference: updatedProduit.reference,
        oldQty: produit.qty,
        newQty: updatedProduit.qty,
        prix_total: updatedProduit.prix_total,
        operation,
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
// Search produits
const searchProduits = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const produits = await Produit.findAll({
      where: {
        [Op.or]: [
          {
            reference: {
              [Op.like]: `%${q}%`,
            },
          },
          {
            designation: {
              [Op.like]: `%${q}%`,
            },
          },
        ],
      },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete"],
        },
      ],
      order: [["reference", "ASC"]],
      limit: 50,
    });

    return res.json({
      message: "Search results",
      produits,
      count: produits.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get produit statistics
const getProduitStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");

    // Count total produits
    const totalProduits = await Produit.count();

    // Count low stock (less than 10)
    const lowStock = await Produit.count({
      where: {
        qty: {
          [Op.lt]: 10,
        },
      },
    });

    // Count out of stock
    const outOfStock = await Produit.count({
      where: {
        qty: 0,
      },
    });

    // Calculate total inventory value
    const result = await Produit.findAll({
      attributes: [
        [
          sequelize.fn("SUM", sequelize.literal("qty * prix_achat")),
          "totalValue",
        ],
      ],
      raw: true,
    });

    const totalValue = result[0]?.totalValue || 0;

    // Calculate total sales value
    const salesResult = await Produit.findAll({
      attributes: [
        [sequelize.fn("SUM", sequelize.col("prix_total")), "totalSalesValue"],
      ],
      where: {
        prix_total: {
          [Op.ne]: null,
        },
      },
      raw: true,
    });

    const totalSalesValue = salesResult[0]?.totalSalesValue || 0;

    // Products by fornisseur
    const produitsByFornisseur = await Produit.findAll({
      attributes: [
        "fornisseurId",
        [sequelize.fn("COUNT", sequelize.col("fornisseurId")), "count"],
      ],
      group: ["fornisseurId"],
      order: [[sequelize.fn("COUNT", sequelize.col("fornisseurId")), "DESC"]],
      where: {
        fornisseurId: {
          [Op.ne]: null,
        },
      },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["nom_complete"],
        },
      ],
      limit: 10,
    });

    // Average margin
    const marginResult = await Produit.findAll({
      attributes: [
        [
          sequelize.fn("AVG", sequelize.literal("prix_vente - prix_achat")),
          "avgMargin",
        ],
        [
          sequelize.fn(
            "AVG",
            sequelize.literal("(prix_vente - prix_achat) / prix_achat * 100"),
          ),
          "avgMarginPercentage",
        ],
      ],
      raw: true,
    });

    // Average surface
    const surfaceResult = await Produit.findAll({
      attributes: [
        [sequelize.fn("AVG", sequelize.col("surface")), "avgSurface"],
      ],
      where: {
        surface: {
          [Op.gt]: 0,
        },
      },
      raw: true,
    });

    return res.json({
      message: "Produit statistics",
      statistics: {
        totalProduits,
        lowStock,
        outOfStock,
        inStock: totalProduits - outOfStock,
        totalValue: parseFloat(totalValue).toFixed(2),
        totalSalesValue: parseFloat(totalSalesValue).toFixed(2),
        avgMargin: parseFloat(marginResult[0]?.avgMargin || 0).toFixed(2),
        avgMarginPercentage: parseFloat(
          marginResult[0]?.avgMarginPercentage || 0,
        ).toFixed(2),
        avgSurface: parseFloat(surfaceResult[0]?.avgSurface || 0).toFixed(4),
        produitsByFornisseur,
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

// Get produits by fornisseur
// Get produits by fornisseur
const getProduitsByFornisseur = async (req, res) => {
  try {
    const { fornisseurId } = req.params;

    // Check if fornisseur exists
    const fornisseur = await Fornisseur.findByPk(fornisseurId);
    if (!fornisseur) {
      return res.status(404).json({
        message: "Fornisseur not found",
      });
    }

    const produits = await Produit.findAll({
      where: { fornisseurId },
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete"],
        },
      ],
      order: [["reference", "ASC"]],
    });

    // Calculate total value for this fornisseur
    const totalValue = produits.reduce((sum, produit) => {
      return sum + produit.qty * produit.prix_achat;
    }, 0);

    // Calculate total sales value - FIXED
    const totalSalesValue = produits.reduce((sum, produit) => {
      // Calculate product value: either prix_total, or surface * prix_vente * qty, or 0
      let productValue = 0;

      if (produit.prix_total) {
        productValue = parseFloat(produit.prix_total) || 0;
      } else if (produit.surface && produit.prix_vente && produit.qty) {
        productValue =
          (parseFloat(produit.surface) || 0) *
          (parseFloat(produit.prix_vente) || 0) *
          (parseInt(produit.qty) || 0);
      }

      return sum + productValue;
    }, 0);

    return res.json({
      message: "Produits retrieved successfully",
      fornisseur: {
        id: fornisseur.id,
        nom_complete: fornisseur.nom_complete,
        telephone: fornisseur.telephone,
      },
      produits,
      count: produits.length,
      totalValue: totalValue ? parseFloat(totalValue.toFixed(2)) : 0,
      totalSalesValue: totalSalesValue
        ? parseFloat(totalSalesValue.toFixed(2))
        : 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
// Keep the existing getFornisseurStats function as is
const getFornisseurStats = async (req, res) => {
  try {
    const sequelize = require("../config/db");

    // Count total fornisseurs
    const totalFornisseurs = await Fornisseur.count();

    // Count fornisseurs with reference
    const withReference = await Fornisseur.count({
      where: {
        reference: {
          [Op.ne]: null,
        },
      },
    });

    // Count fornisseurs with address
    const withAddress = await Fornisseur.count({
      where: {
        address: {
          [Op.ne]: null,
          [Op.ne]: "",
        },
      },
    });

    // Count products per fornisseur
    const produitsByFornisseur = await Produit.findAll({
      attributes: [
        "fornisseurId",
        [sequelize.fn("COUNT", sequelize.col("fornisseurId")), "produitCount"],
      ],
      group: ["fornisseurId"],
      raw: true,
    });

    const totalProducts = produitsByFornisseur.reduce(
      (sum, item) => sum + parseInt(item.produitCount),
      0,
    );

    // Fornisseurs with most products
    const topFornisseurs = await Fornisseur.findAll({
      attributes: [
        "id",
        "nom_complete",
        "reference",
        [
          sequelize.literal(`(
          SELECT COUNT(*) 
          FROM produits 
          WHERE produits.fornisseurId = Fornisseur.id
        )`),
          "produitCount",
        ],
      ],
      order: [[sequelize.literal("produitCount"), "DESC"]],
      limit: 5,
    });

    return res.json({
      message: "Fornisseur statistics",
      statistics: {
        totalFornisseurs,
        withReference,
        withAddress,
        totalProducts,
        topFornisseurs,
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

// Get complete product history with all documents (Devis, BL, Factures)
const getProductHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      documentType,
      sortBy = "issueDate",
      sortOrder = "DESC",
      limit = 50,
      page = 1,
    } = req.query;

    // Check if product exists
    const produit = await Produit.findByPk(id, {
      include: [
        {
          model: Fornisseur,
          as: "fornisseur",
          attributes: ["id", "nom_complete", "telephone", "ville"],
        },
      ],
    });

    if (!produit) {
      return res.status(404).json({
        message: "Produit not found",
      });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter[Op.gte] = new Date(startDate);
    }
    if (endDate) {
      dateFilter[Op.lte] = new Date(endDate);
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Initialize arrays for different document types
    let devis = [];
    let bonLivraisons = [];
    let factures = [];
    let totalCount = 0;

    // ---- DEVIS ----
    if (!documentType || documentType === "devis") {
      const devisItemWhere = { produit_id: id };

      devis = await DevisItem.findAll({
        where: devisItemWhere,
        attributes: [
          "id",
          "quantite",
          "v1",
          "v2",
          "prix_unitaire",
          "remise_ligne",
          "total_ligne",
          "articleName",
        ],
        include: [
          {
            model: Devis,
            as: "devis",
            attributes: [
              "id",
              "devisNumber",
              "issueDate",
              "subTotal",
              "total",
              "status",
              "discountValue",
              "notes",
            ],
            where: hasDateFilter ? { issueDate: dateFilter } : undefined,
            required: true,
            include: [
              {
                model: Client,
                as: "client",
                attributes: ["id", "nom_complete", "telephone", "ville"],
              },
            ],
          },
        ],
        order: [[{ model: Devis, as: "devis" }, sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Count total devis items for this product
      const devisCountWhere = { produit_id: id };
      if (hasDateFilter) {
        const devisCountResult = await DevisItem.count({
          where: devisCountWhere,
          include: [
            {
              model: Devis,
              as: "devis",
              where: { issueDate: dateFilter },
              required: true,
            },
          ],
        });
        totalCount += devisCountResult;
      } else {
        totalCount += await DevisItem.count({ where: devisCountWhere });
      }
    }

    // ---- BON LIVRAISONS ----
    if (!documentType || documentType === "bon-livraison") {
      const blProduitWhere = { produit_id: id };

      bonLivraisons = await BonLivraisonProduit.findAll({
        where: blProduitWhere,
        attributes: [
          "id",
          "quantite",
          "v1",
          "v2",
          "prix_unitaire",
          "remise_ligne",
          "total_ligne",
          "deliveredQuantity",
        ],
        include: [
          {
            model: BonLivraison,
            as: "bonLivraison",
            attributes: [
              "id",
              "deliveryNumber",
              "issueDate",
              "subTotal",
              "total",
              "status",
              "discountValue",
              "paymentType",
              "advancement",
              "remainingAmount",
              "notes",
            ],
            where: hasDateFilter ? { issueDate: dateFilter } : undefined,
            required: true,
            include: [
              {
                model: Client,
                as: "client",
                attributes: ["id", "nom_complete", "telephone", "ville"],
              },
              {
                model: Facture,
                as: "facture",
                attributes: ["id", "invoiceNumber", "status"],
                required: false,
              },
            ],
          },
        ],
        order: [
          [{ model: BonLivraison, as: "bonLivraison" }, sortBy, sortOrder],
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Count total BL items for this product
      const blCountWhere = { produit_id: id };
      if (hasDateFilter) {
        const blCountResult = await BonLivraisonProduit.count({
          where: blCountWhere,
          include: [
            {
              model: BonLivraison,
              as: "bonLivraison",
              where: { issueDate: dateFilter },
              required: true,
            },
          ],
        });
        totalCount += blCountResult;
      } else {
        totalCount += await BonLivraisonProduit.count({ where: blCountWhere });
      }
    }

    // ---- FACTURES ----
    if (!documentType || documentType === "facture") {
      const factureProduitWhere = { produit_id: id };

      factures = await FactureProduit.findAll({
        where: factureProduitWhere,
        attributes: [
          "id",
          "quantite",
          "v1",
          "v2",
          "prix_unitaire",
          "remise_ligne",
          "total_ligne",
          "tva_ligne",
        ],
        include: [
          {
            model: Facture,
            as: "facture",
            attributes: [
              "id",
              "invoiceNumber",
              "issueDate",
              "totalHT",
              "totalTTC",
              "advancement",
              "remainingAmount",
              "status",
              "discountValue",
              "paymentType",
              "notes",
            ],
            where: hasDateFilter ? { issueDate: dateFilter } : undefined,
            required: true,
            include: [
              {
                model: Client,
                as: "client",
                attributes: ["id", "nom_complete", "telephone", "ville"],
              },
              {
                model: BonLivraison,
                as: "bonLivraison",
                attributes: ["id", "deliveryNumber", "status"],
                required: false,
              },
            ],
          },
        ],
        order: [[{ model: Facture, as: "facture" }, sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Count total facture items for this product
      const factureCountWhere = { produit_id: id };
      if (hasDateFilter) {
        const factureCountResult = await FactureProduit.count({
          where: factureCountWhere,
          include: [
            {
              model: Facture,
              as: "facture",
              where: { issueDate: dateFilter },
              required: true,
            },
          ],
        });
        totalCount += factureCountResult;
      } else {
        totalCount += await FactureProduit.count({ where: factureCountWhere });
      }
    }

    // ---- STATISTICS ----
    const totalDevisItems = await DevisItem.count({
      where: { produit_id: id },
    });
    const totalBLItems = await BonLivraisonProduit.count({
      where: { produit_id: id },
    });
    const totalFactureItems = await FactureProduit.count({
      where: { produit_id: id },
    });

    // Total quantity sold across all document types
    const devisQtyResult = await DevisItem.sum("quantite", {
      where: { produit_id: id },
    });
    const blQtyResult = await BonLivraisonProduit.sum("quantite", {
      where: { produit_id: id },
    });
    const factureQtyResult = await FactureProduit.sum("quantite", {
      where: { produit_id: id },
    });

    // Total revenue across document types
    const devisTotalResult = await DevisItem.sum("total_ligne", {
      where: { produit_id: id },
    });
    const blTotalResult = await BonLivraisonProduit.sum("total_ligne", {
      where: { produit_id: id },
    });
    const factureTotalResult = await FactureProduit.sum("total_ligne", {
      where: { produit_id: id },
    });

    // Unique clients who purchased this product
    const uniqueClients = await sequelize.query(
      `SELECT DISTINCT c.id, c.nom_complete, c.telephone, c.ville
       FROM clients c
       WHERE c.id IN (
         SELECT DISTINCT d.client_id FROM devis d
         INNER JOIN devis_items di ON di.devis_id = d.id
         WHERE di.produit_id = :productId AND d.client_id IS NOT NULL
         UNION
         SELECT DISTINCT bl.client_id FROM bon_livraisons bl
         INNER JOIN bon_livraison_produits blp ON blp.bon_livraison_id = bl.id
         WHERE blp.produit_id = :productId AND bl.client_id IS NOT NULL
         UNION
         SELECT DISTINCT f.client_id FROM factures f
         INNER JOIN facture_produits fp ON fp.facture_id = f.id
         WHERE fp.produit_id = :productId AND f.client_id IS NOT NULL
       )
       ORDER BY c.nom_complete ASC`,
      {
        replacements: { productId: id },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    const stats = {
      totalDevisItems,
      totalBLItems,
      totalFactureItems,
      totalDocuments: totalDevisItems + totalBLItems + totalFactureItems,
      totalQuantity: {
        devis: devisQtyResult || 0,
        bonLivraisons: blQtyResult || 0,
        factures: factureQtyResult || 0,
        total: (devisQtyResult || 0) + (blQtyResult || 0) + (factureQtyResult || 0),
      },
      totalRevenue: {
        devis: parseFloat(devisTotalResult || 0),
        bonLivraisons: parseFloat(blTotalResult || 0),
        factures: parseFloat(factureTotalResult || 0),
        total:
          parseFloat(devisTotalResult || 0) +
          parseFloat(blTotalResult || 0) +
          parseFloat(factureTotalResult || 0),
      },
      uniqueClientsCount: uniqueClients.length,
    };

    return res.json({
      message: "Product history retrieved successfully",
      produit: {
        ...produit.toJSON(),
        statistics: stats,
      },
      clients: uniqueClients,
      documents: {
        byType: {
          devis,
          bonLivraisons,
          factures,
        },
      },
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        documentType,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getProductHistory:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

module.exports = {
  createProduit,
  getAllProduits,
  getFornisseurStats,
  getProduitById,
  updateProduit,
  deleteProduit,
  updateStock,
  searchProduits,
  getProduitStats,
  getProduitsByFornisseur,
  getProductHistory,
};
