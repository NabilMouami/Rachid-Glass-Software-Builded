const { Produit, Fornisseur } = require("../models");
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
};
