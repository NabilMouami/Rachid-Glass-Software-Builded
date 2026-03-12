const express = require("express");
const router = express.Router();
const {
  createProduit,
  getAllProduits,
  getProduitById,
  updateProduit,
  deleteProduit,
  updateStock,
  searchProduits,
  getProduitStats,
  getProduitsByFornisseur,
} = require("../controllers/produitController");
// const { authenticateToken } = require("../middleware/authMiddleware");

// // All produit routes require authentication
// router.use(authenticateToken);

// Basic CRUD routes
router.post("/", createProduit);
router.get("/", getAllProduits);
router.get("/search", searchProduits);
router.get("/stats", getProduitStats);
router.get("/:id", getProduitById);
router.put("/:id", updateProduit);
router.delete("/:id", deleteProduit);

// Special routes
router.patch("/:id/stock", updateStock); // Update stock
router.get("/fornisseur/:fornisseurId", getProduitsByFornisseur); // Get produits by fornisseur

module.exports = router;
