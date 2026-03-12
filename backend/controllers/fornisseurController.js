const { Fornisseur, Produit } = require("../models");

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

module.exports = {
  createFornisseur,
  getAllFornisseurs,
  getFornisseurById,
  updateFornisseur,
  deleteFornisseur,
  searchFornisseurs,
  getFornisseurStats,
};
