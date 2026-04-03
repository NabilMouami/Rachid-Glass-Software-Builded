const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/fornisseurController");
// const { authenticateToken } = require("../middleware/authMiddleware");

// // All fornisseur routes require authentication
// router.use(authenticateToken);

// Basic CRUD routes
router.post("/", createFornisseur);
router.get("/", getAllFornisseurs);
router.get("/search", searchFornisseurs);
router.get("/stats", getFornisseurStats);

// Fornisseur detail routes
router.get("/:id/factures-achat/recent", getFornisseurRecentFacturesAchat);
router.get("/:id/products", getFornisseurProducts);
router.get("/:id/product-history", getFornisseurProductHistory);

router.get("/:id", getFornisseurById);
router.put("/:id", updateFornisseur);
router.delete("/:id", deleteFornisseur);

module.exports = router;
