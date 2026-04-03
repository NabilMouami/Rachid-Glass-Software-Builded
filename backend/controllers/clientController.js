const {
  Client,
  Devis,
  Advancement,
  BonLivraison,
  Facture,
  Produit,
  DevisItem,
  FactureProduit,
  BonLivraisonProduit,
  sequelize,
} = require("../models");
const { Op } = require("sequelize"); // Import Op explicitly

// Create a new client
const createClient = async (req, res) => {
  console.log("=== CREATE CLIENT START ===");
  console.log("Request Body:", JSON.stringify(req.body, null, 2));

  try {
    const { nom_complete, reference, ville, address, telephone } = req.body;

    // Validation
    if (!nom_complete || !telephone) {
      console.log("Validation failed - missing fields");
      console.log("nom_complete:", nom_complete);
      console.log("telephone:", telephone);
      return res.status(400).json({
        message: "Nom complet and telephone are required",
        received: { nom_complete, telephone },
      });
    }

    console.log("Checking for existing client with telephone:", telephone);

    // Check if telephone already exists
    const existingClient = await Client.findOne({
      where: { telephone },
      logging: console.log, // This will log the SQL query
    });

    console.log("Existing client check result:", existingClient);

    if (existingClient) {
      console.log("Telephone already exists:", telephone);
      return res.status(409).json({
        message: "Telephone number already in use",
      });
    }

    console.log("Creating new client...");

    // Create client
    const client = await Client.create(
      {
        nom_complete,
        reference,
        ville,
        address,
        telephone,
      },
      {
        logging: console.log, // This will log the SQL query
      },
    );

    console.log("Client created successfully:", client.id);
    console.log("Client data:", JSON.stringify(client, null, 2));

    return res.status(201).json({
      message: "Client created successfully",
      client: {
        id: client.id,
        nom_complete: client.nom_complete,
        reference: client.reference,
        ville: client.ville,
        address: client.address,
        telephone: client.telephone,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
    });
  } catch (err) {
    console.error("=== ERROR IN CREATE CLIENT ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);

    if (err.errors) {
      console.error("Sequelize errors:", JSON.stringify(err.errors, null, 2));
    }

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
        message: "Client with this telephone already exists",
      });
    }

    // Handle database connection errors
    if (err.name === "SequelizeConnectionError") {
      return res.status(500).json({
        message: "Database connection error",
        error: "Cannot connect to database",
      });
    }

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  } finally {
    console.log("=== CREATE CLIENT END ===");
  }
};
// Get all clients
const getAllClients = async (req, res) => {
  try {
    const { search } = req.query;

    // Build where clause for search
    const whereCondition = {};
    if (search) {
      whereCondition.nom_complete = {
        [Op.like]: `%${search}%`,
      };
    }

    // Get all clients without pagination
    const clients = await Client.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      message: "Clients retrieved successfully",
      clients,
      count: clients.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get client by ID
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    return res.json({
      message: "Client retrieved successfully",
      client,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Update client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_complete, reference, ville, address, telephone } = req.body;

    // Check if client exists
    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Check if telephone is being changed and if it's already in use
    if (telephone && telephone !== client.telephone) {
      const existingClient = await Client.findOne({ where: { telephone } });
      if (existingClient && existingClient.id !== parseInt(id)) {
        return res.status(409).json({
          message: "Telephone number already in use",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (nom_complete) updateData.nom_complete = nom_complete;
    if (reference) updateData.reference = reference;
    if (ville !== undefined) updateData.ville = ville;
    if (address !== undefined) updateData.address = address;
    if (telephone) updateData.telephone = telephone;

    // Update client
    await client.update(updateData);

    // Refresh to get updated data
    await client.reload();

    return res.json({
      message: "Client updated successfully",
      client,
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

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Delete client
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Delete client
    await client.destroy();

    return res.json({
      message: "Client deleted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Search clients (by name or telephone)
const searchClients = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const clients = await Client.findAll({
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
        ],
      },
      order: [["nom_complete", "ASC"]],
      limit: 50,
    });

    return res.json({
      message: "Search results",
      clients,
      count: clients.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get client statistics
const getClientStats = async (req, res) => {
  try {
    // Count total clients
    const totalClients = await Client.count();

    // Count clients by city (if ville field is populated)
    const clientsByCity = await Client.findAll({
      attributes: [
        "ville",
        [sequelize.fn("COUNT", sequelize.col("ville")), "count"],
      ],
      group: ["ville"],
      order: [[sequelize.fn("COUNT", sequelize.col("ville")), "DESC"]],
      limit: 10,
    });

    // Count clients created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newClientsThisMonth = await Client.count({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth,
        },
      },
    });

    return res.json({
      message: "Client statistics",
      statistics: {
        totalClients,
        newClientsThisMonth,
        clientsByCity,
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

// Get complete client history with all documents
const getClientHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      documentType,
      status,
      sortBy = "issueDate",
      sortOrder = "DESC",
      limit = 50,
      page = 1,
    } = req.query;

    // Check if client exists
    const client = await Client.findByPk(id, {
      attributes: [
        "id",
        "nom_complete",
        "reference",
        "telephone",
        "ville",
        "address",
      ],
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
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

    // Initialize arrays for different document types
    let devis = [];
    let bonLivraisons = [];
    let factures = [];
    let totalCount = 0;

    // Fetch devis if requested or if no specific type is specified
    if (!documentType || documentType === "devis") {
      const devisWhere = {
        client_id: id,
        ...(dateFilter && Object.keys(dateFilter).length > 0
          ? { issueDate: dateFilter }
          : {}),
        ...(status ? { status } : {}),
      };

      devis = await Devis.findAll({
        where: devisWhere,
        attributes: [
          "id",
          "devisNumber",
          "issueDate",
          "subTotal",
          "total",
          "status",
          "discountValue",
          "notes",
          [sequelize.literal(`'devis'`), "document_type"],
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      totalCount += await Devis.count({ where: devisWhere });
    }

    // Fetch bon-livraisons if requested or if no specific type is specified
    if (!documentType || documentType === "bon-livraison") {
      const bonLivraisonWhere = {
        client_id: id,
        ...(dateFilter && Object.keys(dateFilter).length > 0
          ? { issueDate: dateFilter }
          : {}),
        ...(status ? { status } : {}),
      };

      bonLivraisons = await BonLivraison.findAll({
        where: bonLivraisonWhere,
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
          [sequelize.literal(`'bon-livraison'`), "document_type"],
        ],
        include: [
          {
            model: Facture,
            as: "facture",
            attributes: ["id", "invoiceNumber", "status"],
            required: false,
          },
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      totalCount += await BonLivraison.count({ where: bonLivraisonWhere });
    }

    // Fetch factures if requested or if no specific type is specified
    if (!documentType || documentType === "facture") {
      const factureWhere = {
        client_id: id,
        ...(dateFilter && Object.keys(dateFilter).length > 0
          ? { issueDate: dateFilter }
          : {}),
        ...(status ? { status } : {}),
      };

      factures = await Facture.findAll({
        where: factureWhere,
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
          [sequelize.literal(`'facture'`), "document_type"],
        ],
        include: [
          {
            model: BonLivraison,
            as: "bonLivraison",
            attributes: ["id", "deliveryNumber", "status"],
            required: false,
          },
        ],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      totalCount += await Facture.count({ where: factureWhere });
    }

    // Combine all documents
    const allDocuments = [...devis, ...bonLivraisons, ...factures];

    // Sort combined results by date if not already sorted in individual queries
    if (documentType) {
      allDocuments.sort((a, b) => {
        const dateA = new Date(a[sortBy]);
        const dateB = new Date(b[sortBy]);
        return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
      });
    }

    // Calculate statistics
    const stats = {
      totalDevis: await Devis.count({ where: { client_id: id } }),
      totalBonLivraisons: await BonLivraison.count({
        where: { client_id: id },
      }),
      totalFactures: await Facture.count({ where: { client_id: id } }),
      totalAmount: {
        devis:
          (await Devis.sum("total", { where: { client_id: id } })) || 0,
        bonLivraisons:
          (await BonLivraison.sum("total", {
            where: { client_id: id },
          })) || 0,
        factures:
          (await Facture.sum("totalTTC", { where: { client_id: id } })) || 0,
      },
      outstandingAmount:
        (await Facture.sum("remainingAmount", {
          where: {
            client_id: id,
            status: { [Op.ne]: "payée" },
          },
        })) || 0,
    };

    return res.json({
      message: "Client history retrieved successfully",
      client: {
        ...client.toJSON(),
        statistics: stats,
      },
      documents: {
        all: allDocuments,
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
        status,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getClientHistory:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Get client summary with quick stats
const getClientSummary = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const client = await Client.findByPk(id, {
      attributes: [
        "id",
        "nom_complete",
        "reference",
        "telephone",
        "ville",
        "address",
      ],
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Get latest documents
    const latestDevis = await Devis.findOne({
      where: { client_id: id },
      order: [["issueDate", "DESC"]],
      attributes: ["id", "devisNumber", "issueDate", "total", "status"],
    });

    const latestBonLivraison = await BonLivraison.findOne({
      where: { client_id: id },
      order: [["issueDate", "DESC"]],
      attributes: [
        "id",
        "deliveryNumber",
        "issueDate",
        "total",
        "status",
        "advancement",
      ],
    });

    const latestFacture = await Facture.findOne({
      where: { client_id: id },
      order: [["issueDate", "DESC"]],
      attributes: [
        "id",
        "invoiceNumber",
        "issueDate",
        "totalTTC",
        "remainingAmount",
        "status",
      ],
    });

    // Get status counts
    const devisStatusCount = await Devis.findAll({
      where: { client_id: id },
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("status")), "count"],
      ],
      group: ["status"],
    });

    const bonLivraisonStatusCount = await BonLivraison.findAll({
      where: { client_id: id },
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("status")), "count"],
      ],
      group: ["status"],
    });

    const factureStatusCount = await Facture.findAll({
      where: { client_id: id },
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("status")), "count"],
      ],
      group: ["status"],
    });

    // Calculate financial summary
    const totalOutstanding =
      (await Facture.sum("remainingAmount", {
        where: {
          client_id: id,
          status: { [Op.ne]: "payée" },
        },
      })) || 0;

    const totalPaid =
      (await Facture.sum("advancement", {
        where: { client_id: id },
      })) || 0;

    const totalSales =
      (await Facture.sum("totalTTC", {
        where: { client_id: id },
      })) || 0;

    return res.json({
      message: "Client summary retrieved successfully",
      client: client.toJSON(),
      summary: {
        latestDocuments: {
          devis: latestDevis,
          bonLivraison: latestBonLivraison,
          facture: latestFacture,
        },
        counts: {
          devis: await Devis.count({ where: { client_id: id } }),
          bonLivraisons: await BonLivraison.count({ where: { client_id: id } }),
          factures: await Facture.count({ where: { client_id: id } }),
        },
        statusCounts: {
          devis: devisStatusCount,
          bonLivraisons: bonLivraisonStatusCount,
          factures: factureStatusCount,
        },
        financial: {
          totalSales,
          totalPaid,
          totalOutstanding,
          paymentPercentage:
            totalSales > 0 ? (totalPaid / totalSales) * 100 : 0,
        },
      },
    });
  } catch (err) {
    console.error("Error in getClientSummary:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Add this function to your clientController.js

// Get product history by client
const getClientProductHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      productId,
      sortBy = "issueDate",
      sortOrder = "DESC",
      limit = 100,
      page = 1,
    } = req.query;

    // Check if client exists
    const client = await Client.findByPk(id, {
      attributes: ["id", "nom_complete", "reference", "telephone"],
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    // Get all devis products for this client
    const devisProducts = await DevisItem.findAll({
      include: [
        {
          model: Devis,
          as: "devis",
          where: { client_id: id },
          attributes: ["id", "devisNumber", "issueDate", "status"],
          required: true,
        },
        {
          model: Produit,
          as: "produit",
          attributes: ["id", "designation", "reference", "prix_vente"],
        },
      ],
      where:
        dateFilter && Object.keys(dateFilter).length > 0
          ? {
              "$devis.issueDate$": dateFilter,
            }
          : {},
      ...(productId
        ? {
            include: [
              {
                model: Produit,
                as: "produit",
                where: { id: productId },
              },
            ],
          }
        : {}),
      attributes: [
        "quantite",
        "prix_unitaire",
        "total_ligne",
        [sequelize.literal(`'devis'`), "document_type"],
        [sequelize.literal(`devis_id`), "document_id"],
        [
          sequelize.literal(
            `(SELECT devis_number FROM devis WHERE id = devis_id)`,
          ),
          "document_num",
        ],
      ],
    });

    // Get all bon-livraison products for this client
    const bonLivraisonProducts = await BonLivraisonProduit.findAll({
      include: [
        {
          model: BonLivraison,
          as: "bonLivraison",
          where: { client_id: id },
          attributes: ["id", "deliveryNumber", "issueDate", "status"],
          required: true,
        },
        {
          model: Produit,
          as: "produit",
          attributes: ["id", "designation", "reference", "prix_vente"],
        },
      ],
      where:
        dateFilter && Object.keys(dateFilter).length > 0
          ? {
              "$bonLivraison.issueDate$": dateFilter,
            }
          : {},
      ...(productId
        ? {
            include: [
              {
                model: Produit,
                as: "produit",
                where: { id: productId },
              },
            ],
          }
        : {}),
      attributes: [
        "quantite",
        "prix_unitaire",
        "total_ligne",
        [sequelize.literal(`'bon-livraison'`), "document_type"],
        [sequelize.literal(`bon_livraison_id`), "document_id"],
        [
          sequelize.literal(
            `(SELECT delivery_number FROM bon_livraisons WHERE id = bon_livraison_id)`,
          ),
          "document_num",
        ],
      ],
    });

    // Get all facture products for this client
    const factureProducts = await FactureProduit.findAll({
      include: [
        {
          model: Facture,
          as: "facture",
          where: { client_id: id },
          attributes: ["id", "invoiceNumber", "issueDate", "status"],
          required: true,
        },
        {
          model: Produit,
          as: "produit",
          attributes: ["id", "designation", "reference", "prix_vente"],
        },
      ],
      where:
        dateFilter && Object.keys(dateFilter).length > 0
          ? {
              "$facture.issueDate$": dateFilter,
            }
          : {},
      ...(productId
        ? {
            include: [
              {
                model: Produit,
                as: "produit",
                where: { id: productId },
              },
            ],
          }
        : {}),
      attributes: [
        "quantite",
        "prix_unitaire",
        "total_ligne",

        [sequelize.literal(`'facture'`), "document_type"],
        [sequelize.literal(`facture_id`), "document_id"],
        [
          sequelize.literal(
            `(SELECT invoice_number FROM factures WHERE id = facture_id)`,
          ),
          "document_num",
        ],
      ],
    });

    // Combine all product entries
    let allProducts = [
      ...devisProducts.map((p) => ({
        ...p.toJSON(),
        source: "devis",
      })),
      ...bonLivraisonProducts.map((p) => ({
        ...p.toJSON(),
        source: "bon-livraison",
      })),
      ...factureProducts.map((p) => ({
        ...p.toJSON(),
        source: "facture",
      })),
    ];

    // Sort results
    allProducts.sort((a, b) => {
      const aDate = new Date(
        a.document_date ||
          a.devis?.issueDate ||
          a.bonLivraison?.issueDate ||
          a.facture?.issueDate,
      );
      const bDate = new Date(
        b.document_date ||
          b.devis?.issueDate ||
          b.bonLivraison?.issueDate ||
          b.facture?.issueDate,
      );
      return sortOrder === "DESC" ? bDate - aDate : aDate - bDate;
    });

    // Calculate statistics
    const productStats = {};
    allProducts.forEach((item) => {
      const productId = item.produit?.id;
      if (!productId) return;

      if (!productStats[productId]) {
        productStats[productId] = {
          product: item.produit,
          totalQuantity: 0,
          totalAmount: 0,
          documents: [],
          firstPurchase: null,
          lastPurchase: null,
        };
      }

      const stats = productStats[productId];
      stats.totalQuantity += parseFloat(item.quantite || 0);
      stats.totalAmount += parseFloat(item.total_ligne || 0);

      if (
        !stats.firstPurchase ||
        new Date(item.document_date) < new Date(stats.firstPurchase)
      ) {
        stats.firstPurchase = item.document_date;
      }
      if (
        !stats.lastPurchase ||
        new Date(item.document_date) > new Date(stats.lastPurchase)
      ) {
        stats.lastPurchase = item.document_date;
      }

      stats.documents.push({
        type: item.document_type,
        id: item.document_id,
        num: item.document_num,
        date: item.document_date,
        quantity: item.quantite,
        amount: item.total_ligne,
      });
    });

    // Get unique products
    const uniqueProducts = Object.values(productStats);

    // Get product summary
    const totalProducts = uniqueProducts.length;
    const totalQuantity = uniqueProducts.reduce(
      (sum, p) => sum + p.totalQuantity,
      0,
    );
    const totalAmount = uniqueProducts.reduce(
      (sum, p) => sum + p.totalAmount,
      0,
    );

    // Paginate results
    const paginatedProducts = allProducts.slice(
      offset,
      offset + parseInt(limit),
    );

    return res.json({
      message: "Client product history retrieved successfully",
      client: client.toJSON(),
      summary: {
        totalProducts,
        totalQuantity,
        totalAmount,
        averagePerProduct: totalProducts > 0 ? totalAmount / totalProducts : 0,
      },
      products: {
        all: paginatedProducts,
        grouped: uniqueProducts,
      },
      pagination: {
        total: allProducts.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allProducts.length / limit),
      },
      filters: {
        startDate,
        endDate,
        productId,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getClientProductHistory:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getClientProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, documentType, startDate, endDate } = req.query;

    console.log("=== getClientProducts called for client:", id, "startDate:", startDate, "endDate:", endDate);

    const client = await Client.findByPk(id, {
      attributes: ["id", "nom_complete", "telephone", "ville"],
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Use raw date strings for SQL queries
    const dateFilter = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const productMap = {};

    // Process raw SQL query results
    const processRawItems = (items, type) => {
      console.log(`Processing ${items.length} items for type: ${type}`);
      let skipped = 0;
      let processed = 0;
      
      items.forEach((item) => {
        // Skip items without produit_id
        if (!item.produit_id) {
          skipped++;
          return;
        }

        const productId = item.produit_id;
        const docDate = item.issue_date;
        const docNum = item.devis_number || item.delivery_number || item.invoice_number;
        const docId = item.devis_id || item.bon_livraison_id || item.facture_id;

        // Create produit object from raw results
        const produit = {
          id: item.produit_id,
          designation: item.designation,
          reference: item.reference,
          prix_vente: item.prix_vente,
        };

        if (!productMap[productId]) {
          productMap[productId] = {
            product: produit,
            totalQuantity: 0,
            totalAmount: 0,
            firstPurchase: docDate,
            lastPurchase: docDate,
            documents: [],
          };
        }

        const p = productMap[productId];

        p.totalQuantity += Number(item.quantite || 0);
        p.totalAmount += Number(item.total_ligne || 0);

        if (docDate && (!p.firstPurchase || docDate < p.firstPurchase)) p.firstPurchase = docDate;
        if (docDate && (!p.lastPurchase || docDate > p.lastPurchase)) p.lastPurchase = docDate;

        p.documents.push({
          type,
          id: docId,
          num: docNum,
          date: docDate,
          quantity: item.quantite,
          unitPrice: item.prix_unitaire,
          amount: item.total_ligne,
        });
        processed++;
      });
      console.log(`Processed: ${processed}, Skipped: ${skipped}`);
    };

    /* ===================== DEVIS ===================== */
    if (!documentType || documentType === "devis") {
      // Build where clause for Devis using raw query to ensure correct date filtering
      let devisQuery = `
        SELECT di.*, d.devis_number, d.issue_date, 
               p.id as produit_id, p.designation, p.reference, p.prix_vente
        FROM devis_items di
        INNER JOIN devis d ON di.devis_id = d.id
        LEFT JOIN produits p ON di.produit_id = p.id
        WHERE d.client_id = ?
      `;
      const devisParams = [id];
      
      if (Object.keys(dateFilter).length > 0) {
        if (dateFilter.gte) {
          devisQuery += ` AND d.issue_date >= ?`;
          devisParams.push(dateFilter.gte);
        }
        if (dateFilter.lte) {
          devisQuery += ` AND d.issue_date <= ?`;
          devisParams.push(dateFilter.lte);
        }
      }
      
      const devisProducts = await sequelize.query(devisQuery, {
        replacements: devisParams,
        type: sequelize.QueryTypes.SELECT,
        mapToModel: true,
      });

      console.log("Devis products found:", devisProducts.length);
      processRawItems(devisProducts, "devis");
    }

    /* ===================== BON LIVRAISON ===================== */
    if (!documentType || documentType === "bon-livraison") {
      let blQuery = `
        SELECT blp.*, bl.delivery_number, bl.issue_date,
               p.id as produit_id, p.designation, p.reference, p.prix_vente
        FROM bon_livraison_produits blp
        INNER JOIN bon_livraisons bl ON blp.bon_livraison_id = bl.id
        LEFT JOIN produits p ON blp.produit_id = p.id
        WHERE bl.client_id = ?
      `;
      const blParams = [id];
      
      if (Object.keys(dateFilter).length > 0) {
        if (dateFilter.gte) {
          blQuery += ` AND bl.issue_date >= ?`;
          blParams.push(dateFilter.gte);
        }
        if (dateFilter.lte) {
          blQuery += ` AND bl.issue_date <= ?`;
          blParams.push(dateFilter.lte);
        }
      }
      
      const blProducts = await sequelize.query(blQuery, {
        replacements: blParams,
        type: sequelize.QueryTypes.SELECT,
      });

      console.log("BL products found:", blProducts.length);
      processRawItems(blProducts, "bon-livraison");
    }

    /* ===================== FACTURE ===================== */
    if (!documentType || documentType === "facture") {
      let factureQuery = `
        SELECT fp.*, f.invoice_number, f.issue_date,
               p.id as produit_id, p.designation, p.reference, p.prix_vente
        FROM facture_produits fp
        INNER JOIN factures f ON fp.facture_id = f.id
        LEFT JOIN produits p ON fp.produit_id = p.id
        WHERE f.client_id = ?
      `;
      const factureParams = [id];
      
      if (Object.keys(dateFilter).length > 0) {
        if (dateFilter.gte) {
          factureQuery += ` AND f.issue_date >= ?`;
          factureParams.push(dateFilter.gte);
        }
        if (dateFilter.lte) {
          factureQuery += ` AND f.issue_date <= ?`;
          factureParams.push(dateFilter.lte);
        }
      }
      
      const factureProducts = await sequelize.query(factureQuery, {
        replacements: factureParams,
        type: sequelize.QueryTypes.SELECT,
      });

      console.log("Facture products found:", factureProducts.length);
      processRawItems(factureProducts, "facture");
    }

    const products = Object.values(productMap).sort(
      (a, b) => b.totalQuantity - a.totalQuantity,
    );

    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantity, 0);
    const totalAmount = products.reduce((sum, p) => sum + p.totalAmount, 0);

    console.log("=== Final Products Result ===");
    console.log("Total products:", totalProducts);
    console.log("Products:", JSON.stringify(products, null, 2));

    return res.json({
      message: "Client products retrieved successfully",
      client: client.toJSON(),
      statistics: {
        totalProducts,
        totalQuantity,
        totalAmount,
        averagePerProduct: totalProducts > 0 ? totalAmount / totalProducts : 0,
      },
      products,
      filters: { search, documentType, startDate, endDate },
    });
  } catch (err) {
    console.error("Error in getClientProducts:", err);
    console.error("Stack:", err.stack);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getClientProductHistoryByReference = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference,
      exactMatch = false,
      documentType,
      startDate,
      endDate,
      sortBy = "issueDate",
      sortOrder = "DESC",
      limit = 50,
      page = 1,
    } = req.query;

    // Validation
    if (!reference) {
      return res.status(400).json({
        message: "Reference search term is required",
      });
    }

    // Check if client exists
    const client = await Client.findByPk(id, {
      attributes: [
        "id",
        "nom_complete",
        "reference",
        "telephone",
        "ville",
        "address",
      ],
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    console.log("=== getClientProductHistoryByReference START ===");
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter[Op.gte] = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter[Op.lte] = end;
    }

    console.log("=== DATE FILTER DEBUG ===");
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);
    console.log("dateFilter:", dateFilter);

    // Parse exactMatch - handle string "true"/"false" from URL
    const isExactMatch = exactMatch === true || exactMatch === "true";

    // IMPORTANT FIX: Handle case sensitivity
    // For MySQL: Use Op.like (case-insensitive by default)
    // For PostgreSQL: Use Op.iLike for case-insensitive
    const referenceCondition = isExactMatch
      ? { reference: reference }
      : { reference: { [Op.like]: `%${reference}%` } };

    // Initialize arrays for results
    let devisProducts = [];
    let bonLivraisonProducts = [];
    let factureProducts = [];
    let totalCount = 0;

    // Helper function to build date where clause
    const buildDateWhere = (baseWhere) => {
      const hasDateFilter = dateFilter[Op.gte] || dateFilter[Op.lte];
      
      if (hasDateFilter) {
        // Use model attribute name (issueDate), not database field (issue_date)
        const where = { ...baseWhere };
        
        if (dateFilter[Op.gte]) {
          where.issueDate = { [Op.gte]: dateFilter[Op.gte] };
        }
        if (dateFilter[Op.lte]) {
          where.issueDate = { 
            ...where.issueDate,
            [Op.lte]: dateFilter[Op.lte] 
          };
        }
        
        console.log("Built where clause:", JSON.stringify(where, (key, value) => {
          if (typeof value === 'symbol') return value.toString();
          return value;
        }, 2));
        
        return where;
      }
      return baseWhere;
    };

    // Build common include for Produit
    const produitInclude = {
      model: Produit,
      as: "produit",
      where: referenceCondition,
      attributes: ["id", "designation", "reference", "prix_vente"],
      required: true,
    };

    /* ===================== DEVIS ===================== */
    if (!documentType || documentType === "devis") {
      const devisWhereClause = buildDateWhere({ client_id: id });
      console.log("Devis where clause:", JSON.stringify(devisWhereClause, (k, v) => {
        if (typeof v === 'symbol') return v.toString();
        return v;
      }, 2));
      
      devisProducts = await DevisItem.findAll({
        include: [
          {
            model: Devis,
            as: "devis",
            where: devisWhereClause,
            attributes: ["devisNumber", "issueDate", "status", "total"],
            required: true,
          },
          produitInclude,
        ],
        attributes: [
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'devis'`), "document_type"],
        ],
        order: [[sequelize.col("devis.issue_date"), sortOrder]],
      });

      totalCount += devisProducts.length;
      console.log("Devis products found:", devisProducts.length);
      if (devisProducts.length > 0) {
        console.log("First Devis item date:", JSON.stringify(devisProducts[0].devis?.issueDate));
      }
    }

    /* ===================== BON LIVRAISON ===================== */
    if (!documentType || documentType === "bon-livraison") {
      bonLivraisonProducts = await BonLivraisonProduit.findAll({
        include: [
          {
            model: BonLivraison,
            as: "bonLivraison",
            where: buildDateWhere({ client_id: id }),
            attributes: [
              "deliveryNumber",
              "issueDate",
              "status",
              "total",
            ],
            required: true,
          },
          produitInclude,
        ],
        attributes: [
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'bon-livraison'`), "document_type"],
        ],
        order: [[sequelize.col("bonLivraison.issue_date"), sortOrder]],
      });

      totalCount += bonLivraisonProducts.length;
    }

    /* ===================== FACTURE ===================== */
    if (!documentType || documentType === "facture") {
      factureProducts = await FactureProduit.findAll({
        include: [
          {
            model: Facture,
            as: "facture",
            where: buildDateWhere({ client_id: id }),
            attributes: [
              "id",
              "invoiceNumber",
              "issueDate",
              "status",
              "totalTTC",
            ],
            required: true,
          },
          produitInclude,
        ],
        attributes: [
          "id",
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'facture'`), "document_type"],
        ],
        order: [[sequelize.col("facture.issue_date"), sortOrder]],
      });

      totalCount += factureProducts.length;
    }

    // Combine and format all results
    const formatProduct = (item, type) => {
      const base = {
        id: item.id,
        document_type: type,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        total_ligne: item.total_ligne,
        produit: item.produit,
      };

    if (type === "devis") {
        return {
          ...base,
          document: {
            id: item.devis.id,
            num: item.devis.devisNumber,
            date: item.devis.issueDate,
            status: item.devis.status,
            montant_ttc: item.devis.total,
          },
          issueDate: item.devis.issueDate,
        };
      } else if (type === "bon-livraison") {
        return {
          ...base,
          document: {
            id: item.bonLivraison.id,
            num: item.bonLivraison.deliveryNumber,
            date: item.bonLivraison.issueDate,
            status: item.bonLivraison.status,
            montant_ttc: item.bonLivraison.total,
          },
          issueDate: item.bonLivraison.issueDate,
        };
      } else if (type === "facture") {
        return {
          ...base,
          document: {
            id: item.facture.id,
            num: item.facture.invoiceNumber,
            date: item.facture.issueDate,
            status: item.facture.status,
            montant_ttc: item.facture.totalTTC,
          },
          issueDate: item.facture.issueDate,
        };
      }
    };

    // Combine all results
    let allHistory = [
      ...devisProducts.map((item) => formatProduct(item, "devis")),
      ...bonLivraisonProducts.map((item) =>
        formatProduct(item, "bon-livraison"),
      ),
      ...factureProducts.map((item) => formatProduct(item, "facture")),
    ];

    // Sort combined results
    allHistory.sort((a, b) => {
      const dateA = new Date(a.issueDate);
      const dateB = new Date(b.issueDate);
      return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
    });

    // Calculate statistics
    const productStats = {};
    allHistory.forEach((item) => {
      const productId = item.produit.id;
      if (!productStats[productId]) {
        productStats[productId] = {
          product: item.produit,
          totalQuantity: 0,
          totalAmount: 0,
          appearances: 0,
          firstSeen: item.issueDate,
          lastSeen: item.issueDate,
          byDocumentType: {
            devis: { count: 0, totalQuantity: 0, totalAmount: 0 },
            "bon-livraison": { count: 0, totalQuantity: 0, totalAmount: 0 },
            facture: { count: 0, totalQuantity: 0, totalAmount: 0 },
          },
        };
      }

      const stats = productStats[productId];
      stats.totalQuantity += parseFloat(item.quantite || 0);
      stats.totalAmount += parseFloat(item.total_ligne || 0);
      stats.appearances += 1;

      const docType = item.document_type;
      stats.byDocumentType[docType].count += 1;
      stats.byDocumentType[docType].totalQuantity += parseFloat(
        item.quantite || 0,
      );
      stats.byDocumentType[docType].totalAmount += parseFloat(
        item.total_ligne || 0,
      );

      if (new Date(item.issueDate) < new Date(stats.firstSeen)) {
        stats.firstSeen = item.issueDate;
      }
      if (new Date(item.issueDate) > new Date(stats.lastSeen)) {
        stats.lastSeen = item.issueDate;
      }
    });

    // Paginate results
    const paginatedHistory = allHistory.slice(offset, offset + parseInt(limit));

    // Calculate summary statistics
    const uniqueProducts = Object.values(productStats);
    const summary = {
      totalEntries: allHistory.length,
      totalUniqueProducts: uniqueProducts.length,
      totalQuantity: uniqueProducts.reduce(
        (sum, p) => sum + p.totalQuantity,
        0,
      ),
      totalAmount: uniqueProducts.reduce((sum, p) => sum + p.totalAmount, 0),
      byDocumentType: {
        devis: devisProducts.length,
        "bon-livraison": bonLivraisonProducts.length,
        facture: factureProducts.length,
      },
    };

    return res.json({
      message: "Client product history by reference retrieved successfully",
      client: client.toJSON(),
      searchCriteria: {
        reference,
        exactMatch: isExactMatch,
        documentType: documentType || "all",
      },
      summary,
      productStatistics: uniqueProducts,
      history: paginatedHistory,
      pagination: {
        total: allHistory.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allHistory.length / limit),
      },
      filters: {
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getClientProductHistoryByReference:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

const getClientPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeDetails = false } = req.query;

    console.log(`=== PAYMENT STATUS for client ${id} ===`);

    const UNPAID_STATUSES = ["brouillon", "partiellement_payée"];

    // ------------------ BonLivraison (UNPAID ONLY)
    const bonLivraisons = await BonLivraison.findAll({
      where: {
        client_id: id,
        status: { [Op.in]: UNPAID_STATUSES },
      },
      include: [
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
          ],
          required: false,
        },
      ],
      attributes: [
        "id",
        "deliveryNumber",
        "issueDate",
        "status",
        "total",
        "subTotal",
        "advancement",
        "remainingAmount",
      ],
      order: [["issueDate", "DESC"]],
    });

    console.log(`Found ${bonLivraisons.length} BonLivraison`);

    // Debug: Check advancements for each BL
    bonLivraisons.forEach((bl, index) => {
      console.log(
        `BL ${index + 1}: ${bl.deliveryNumber} - Status: ${bl.status}`,
      );
      console.log(`  Advancements count: ${bl.advancements?.length || 0}`);
      if (bl.advancements && bl.advancements.length > 0) {
        bl.advancements.forEach((adv, i) => {
          console.log(
            `  Advancement ${i + 1}: ${adv.amount} - bonLivraisonId: ${adv.bonLivraisonId}, bon_livraison_id: ${adv.bon_livraison_id}`,
          );
        });
      }
    });

    // ------------------ Facture (UNPAID ONLY)
    const factures = await Facture.findAll({
      where: {
        client_id: id,
        status: { [Op.in]: UNPAID_STATUSES },
      },
      include: [
        {
          model: Advancement,
          as: "advancements",
          attributes: [
            "id",
            "amount",
            "paymentDate",
            "paymentMethod",
            "reference",
          ],
          required: false,
        },
      ],
      attributes: [
        "id",
        "invoiceNumber",
        "issueDate",
        "status",
        "totalTTC",
        "advancement",
        "remainingAmount",
        "totalHT",
        "tvaRate",
      ],
      order: [["issueDate", "DESC"]],
    });

    console.log(`Found ${factures.length} Factures`);

    // Debug: Check advancements for each Facture
    factures.forEach((f, index) => {
      console.log(
        `Facture ${index + 1}: ${f.invoiceNumber} - Status: ${f.status}`,
      );
      console.log(`  Advancements count: ${f.advancements?.length || 0}`);
      if (f.advancements && f.advancements.length > 0) {
        f.advancements.forEach((adv, i) => {
          console.log(
            `  Advancement ${i + 1}: ${adv.amount} - factureId: ${adv.factureId}, facture_id: ${adv.facture_id}`,
          );
        });
      }
    });

    // ------------------ Status calculator
    const calculateDocumentStatus = (doc, type) => {
      const montantTTC = parseFloat(doc.total || doc.totalTTC) || 0;

      let totalPaid = 0;
      let totalRemaining = 0;

      console.log(
        `\nCalculating status for ${type} ${doc.deliveryNumber || doc.invoiceNumber}:`,
      );
      console.log(`  Montant TTC: ${montantTTC}`);
      console.log(`  Original status: ${doc.status}`);

      if (type === "bon-livraison") {
        totalPaid = parseFloat(doc.advancement) || 0;
        totalRemaining = parseFloat(doc.remainingAmount) || (montantTTC - totalPaid);
        console.log(`  From BL: advancement=${doc.advancement}, remainingAmount=${doc.remainingAmount}`);
      }

      if (type === "facture") {
        totalPaid = parseFloat(doc.advancement) || 0;
        totalRemaining = parseFloat(doc.remainingAmount) || (montantTTC - totalPaid);
        console.log(
          `  From Facture: advancement=${doc.advancement}, remainingAmount=${doc.remainingAmount}`,
        );
      }

      const paymentStatus = totalPaid > 0 ? "partiellement_payée" : "brouillon";

      console.log(
        `  Result: totalPaid=${totalPaid}, totalRemaining=${totalRemaining}, paymentStatus=${paymentStatus}`,
      );

      return {
        documentId: doc.id,
        numero:
          type === "bon-livraison" ? doc.deliveryNumber : doc.invoiceNumber,
        date: doc.issueDate,
        paymentStatus,
        montantTTC,
        totalPaid,
        totalRemaining,
        isPartiallyPaid: totalPaid > 0,
        isUnpaid: totalPaid === 0,
        type,
        advancements: includeDetails === "true" ? doc.advancements : undefined,
      };
    };

    const processedBL = bonLivraisons.map((bl) =>
      calculateDocumentStatus(bl, "bon-livraison"),
    );

    const processedFactures = factures.map((f) =>
      calculateDocumentStatus(f, "facture"),
    );

    const allDocuments = [...processedBL, ...processedFactures];

    // ------------------ Totals (UNPAID ONLY)
    const totals = allDocuments.reduce(
      (acc, doc) => ({
        totalAmount: acc.totalAmount + doc.montantTTC,
        totalPaid: acc.totalPaid + doc.totalPaid,
        totalRemaining: acc.totalRemaining + doc.totalRemaining,
        count: acc.count + 1,
      }),
      { totalAmount: 0, totalPaid: 0, totalRemaining: 0, count: 0 },
    );

    const overallStatus =
      totals.totalPaid > 0 ? "partiellement_payée" : "brouillon";

    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total documents: ${totals.count}`);
    console.log(`Total amount: ${totals.totalAmount}`);
    console.log(`Total paid: ${totals.totalPaid}`);
    console.log(`Total remaining: ${totals.totalRemaining}`);
    console.log(`Overall status: ${overallStatus}`);

    return res.json({
      message: "Statut de paiement (documents non payés)",
      summary: {
        overallStatus,
        totals,
        counts: {
          total: totals.count,
          brouillon: allDocuments.filter((d) => d.paymentStatus === "brouillon")
            .length,
          partiellement_payée: allDocuments.filter(
            (d) => d.paymentStatus === "partiellement_payée",
          ).length,
        },
      },
      documents: allDocuments.sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      ),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error in getClientPaymentStatus:", err);
    console.error("Error stack:", err.stack);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};
const getClientProductsByDateRange = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      documentType,
      sortBy = "issueDate",
      sortOrder = "DESC",
      page = 1,
      limit = 100,
    } = req.query;

    console.log("=== GET CLIENT PRODUCTS BY DATE RANGE ===");
    console.log("Client ID:", id);
    console.log("Raw Date Range:", { startDate, endDate });
    console.log("Document Type:", documentType);

    // Check if client exists
    const client = await Client.findByPk(id, {
      attributes: ["id", "nom_complete", "reference", "telephone", "ville"],
    });

    if (!client) {
      return res.status(404).json({
        message: "Client not found",
      });
    }

    // Build date filter
    const buildDateFilter = () => {
      // If no dates provided, return empty filter
      if (!startDate && !endDate) {
        console.log("No date filters provided");
        return {};
      }

      const filter = {};

      if (startDate) {
        // Create date at start of day in local time
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter[Op.gte] = start;
        console.log("Start date:", start.toString());
      }

      if (endDate) {
        // Create date at end of day in local time
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter[Op.lte] = end;
        console.log("End date:", end.toString());
      }

      console.log("Date Filter built:", filter);
      return filter;
    };

    const dateFilter = buildDateFilter();

    // Check if dateFilter has any properties (including Symbol keys)
    const hasDateFilter = Object.getOwnPropertySymbols(dateFilter).length > 0;
    console.log("Has date filter:", hasDateFilter);
    console.log(
      "Date filter symbols:",
      Object.getOwnPropertySymbols(dateFilter).map((sym) => sym.toString()),
    );

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Initialize arrays for different document types
    let devisProducts = [];
    let bonLivraisonProducts = [];
    let factureProducts = [];

    /* ===================== FETCH DEVIS PRODUCTS ===================== */
    if (!documentType || documentType === "devis") {
      const devisWhere = { client_id: id };

      // Apply date filter if it has values - FIXED: use Object.getOwnPropertySymbols
      if (hasDateFilter) {
        devisWhere.issueDate = dateFilter;
        console.log("Applying date filter to Devis");
      }

      console.log(
        "Devis WHERE clause:",
        JSON.stringify(
          devisWhere,
          (key, value) => {
            if (value instanceof Date) {
              return value.toISOString();
            }
            return value;
          },
          2,
        ),
      );

      devisProducts = await DevisItem.findAll({
        include: [
          {
            model: Devis,
            as: "devis",
            where: devisWhere,
            attributes: ["devisNumber", "issueDate", "status", "total"],
            required: true,
          },
          {
            model: Produit,
            as: "produit",
            attributes: ["id", "designation", "reference", "prix_vente"],
            required: true,
          },
        ],
        attributes: [
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'devis'`), "document_type"],
        ],
      });

      console.log(`Found ${devisProducts.length} devis products`);

      // Log the first few devis dates for debugging
      if (devisProducts.length > 0) {
        console.log(
          "Sample devis dates:",
          devisProducts.slice(0, 3).map((p) => ({
            date: p.devis.issueDate,
            formattedDate: new Date(p.devis.issueDate).toLocaleString(),
            num: p.devis.devisNumber,
          })),
        );
      }
    }

    /* ===================== FETCH BON LIVRAISON PRODUCTS ===================== */
    if (!documentType || documentType === "bon-livraison") {
      const blWhere = { client_id: id };

      // Apply date filter if it has values - FIXED: use hasDateFilter
      if (hasDateFilter) {
        blWhere.issueDate = dateFilter;
        console.log("Applying date filter to Bon Livraison");
      }

      console.log(
        "Bon Livraison WHERE clause:",
        JSON.stringify(
          blWhere,
          (key, value) => {
            if (value instanceof Date) {
              return value.toISOString();
            }
            return value;
          },
          2,
        ),
      );

      bonLivraisonProducts = await BonLivraisonProduit.findAll({
        include: [
          {
            model: BonLivraison,
            as: "bonLivraison",
            where: blWhere,
            attributes: [
              "id",
              "deliveryNumber",
              "issueDate",
              "status",
              "total",
            ],
            required: true,
          },
          {
            model: Produit,
            as: "produit",
            attributes: ["id", "designation", "reference", "prix_vente"],
            required: true,
          },
        ],
        attributes: [
          "id",
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'bon-livraison'`), "document_type"],
        ],
      });

      console.log(
        `Found ${bonLivraisonProducts.length} bon livraison products`,
      );

      if (bonLivraisonProducts.length > 0) {
        console.log(
          "Sample BL dates:",
          bonLivraisonProducts.slice(0, 3).map((p) => ({
            date: p.bonLivraison.issueDate,
            formattedDate: new Date(p.bonLivraison.issueDate).toLocaleString(),
            num: p.bonLivraison.deliveryNumber,
          })),
        );
      }
    }

    /* ===================== FETCH FACTURE PRODUCTS ===================== */
    if (!documentType || documentType === "facture") {
      const factureWhere = { client_id: id };

      // Apply date filter if it has values - FIXED: use hasDateFilter
      if (hasDateFilter) {
        factureWhere.issueDate = dateFilter;
        console.log("Applying date filter to Facture");
      }

      console.log(
        "Facture WHERE clause:",
        JSON.stringify(
          factureWhere,
          (key, value) => {
            if (value instanceof Date) {
              return value.toISOString();
            }
            return value;
          },
          2,
        ),
      );

      factureProducts = await FactureProduit.findAll({
        include: [
          {
            model: Facture,
            as: "facture",
            where: factureWhere,
            attributes: [
              "id",
              "invoiceNumber",
              "issueDate",
              "status",
              "totalTTC",
            ],
            required: true,
          },
          {
            model: Produit,
            as: "produit",
            attributes: ["id", "designation", "reference", "prix_vente"],
            required: true,
          },
        ],
        attributes: [
          "id",
          "quantite",
          "prix_unitaire",
          "total_ligne",
          [sequelize.literal(`'facture'`), "document_type"],
        ],
      });

      console.log(`Found ${factureProducts.length} facture products`);

      if (factureProducts.length > 0) {
        console.log(
          "Sample facture dates:",
          factureProducts.slice(0, 3).map((p) => ({
            date: p.facture.issueDate,
            formattedDate: new Date(p.facture.issueDate).toLocaleString(),
            num: p.facture.invoiceNumber,
          })),
        );
      }
    }

    /* ===================== FORMAT AND COMBINE RESULTS ===================== */
    const formatProduct = (item, type) => {
      const base = {
        id: item.id,
        document_type: type,
        quantite: parseFloat(item.quantite || 0),
        prix_unitaire: parseFloat(item.prix_unitaire || 0),
        total_ligne: parseFloat(item.total_ligne || 0),
        produit: item.produit,
      };

    if (type === "devis") {
        return {
          ...base,
          document: {
            num: item.devis.devisNumber,
            status: item.devis.status,
            montant_ttc: item.devis.total,
          },
          issueDate: item.devis.issueDate,
        };
      } else if (type === "bon-livraison") {
        return {
          ...base,
          document: {
            id: item.bonLivraison.id,
            num: item.bonLivraison.deliveryNumber,
            status: item.bonLivraison.status,
            montant_ttc: item.bonLivraison.total,
          },
          issueDate: item.bonLivraison.issueDate,
        };
      } else if (type === "facture") {
        return {
          ...base,
          document: {
            id: item.facture.id,
            num: item.facture.invoiceNumber,
            status: item.facture.status,
            montant_ttc: item.facture.totalTTC,
          },
          issueDate: item.facture.issueDate,
        };
      }
    };

    // Combine all results
    let allProducts = [
      ...devisProducts.map((item) => formatProduct(item, "devis")),
      ...bonLivraisonProducts.map((item) =>
        formatProduct(item, "bon-livraison"),
      ),
      ...factureProducts.map((item) => formatProduct(item, "facture")),
    ];

    console.log(`Total combined products: ${allProducts.length}`);

    // Sort combined results by date
    allProducts.sort((a, b) => {
      const dateA = new Date(a.issueDate);
      const dateB = new Date(b.issueDate);
      return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
    });

    /* ===================== CALCULATE STATISTICS ===================== */
    const productMap = {};

    allProducts.forEach((item) => {
      const productId = item.produit.id;

      if (!productMap[productId]) {
        productMap[productId] = {
          product: item.produit,
          totalQuantity: 0,
          totalAmount: 0,
          appearances: 0,
          firstSeen: item.issueDate,
          lastSeen: item.issueDate,
          byDocumentType: {
            devis: { count: 0, totalQuantity: 0, totalAmount: 0 },
            "bon-livraison": { count: 0, totalQuantity: 0, totalAmount: 0 },
            facture: { count: 0, totalQuantity: 0, totalAmount: 0 },
          },
        };
      }

      const stats = productMap[productId];
      stats.totalQuantity += item.quantite;
      stats.totalAmount += item.total_ligne;
      stats.appearances += 1;

      const docType = item.document_type;
      stats.byDocumentType[docType].count += 1;
      stats.byDocumentType[docType].totalQuantity += item.quantite;
      stats.byDocumentType[docType].totalAmount += item.total_ligne;

      if (new Date(item.issueDate) < new Date(stats.firstSeen)) {
        stats.firstSeen = item.issueDate;
      }
      if (new Date(item.issueDate) > new Date(stats.lastSeen)) {
        stats.lastSeen = item.issueDate;
      }
    });

    const uniqueProducts = Object.values(productMap);

    // Paginate the detail results
    const paginatedProducts = allProducts.slice(
      offset,
      offset + parseInt(limit),
    );

    /* ===================== CALCULATE SUMMARY ===================== */
    const summary = {
      totalEntries: allProducts.length,
      totalUniqueProducts: uniqueProducts.length,
      totalQuantity: uniqueProducts.reduce(
        (sum, p) => sum + p.totalQuantity,
        0,
      ),
      totalAmount: uniqueProducts.reduce((sum, p) => sum + p.totalAmount, 0),
      byDocumentType: {
        devis: devisProducts.length,
        "bon-livraison": bonLivraisonProducts.length,
        facture: factureProducts.length,
      },
      dateRange: {
        from: startDate || "Tous",
        to: endDate || "Aujourd'hui",
      },
    };

    console.log("Summary:", summary);
    console.log("=== END OF REQUEST ===");

    return res.json({
      message: "Client products retrieved successfully",
      client: client.toJSON(),
      summary,
      productStatistics: uniqueProducts,
      products: paginatedProducts,
      pagination: {
        total: allProducts.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allProducts.length / limit),
      },
      filters: {
        documentType: documentType || "all",
        startDate,
        endDate,
        sortBy,
        sortOrder,
      },
    });
  } catch (err) {
    console.error("Error in getClientProductsByDateRange:", err);
    console.error("Stack:", err.stack);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Export the new function
module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  searchClients,
  getClientStats,
  getClientHistory,
  getClientSummary,
  getClientProductHistory,
  getClientProducts,
  getClientProductHistoryByReference,
  getClientPaymentStatus,
  getClientProductsByDateRange, // ADD THIS NEW EXPORT
};
