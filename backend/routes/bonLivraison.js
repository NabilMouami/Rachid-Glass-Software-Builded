const express = require("express");
const router = express.Router();
const {
  createBonLivraison,
  getBonLivraisons,
  getBonLivraisonById,
  updateBonLivraison,
  deleteBonLivraison,
  addAdvancementToBonLivraison,
  generateBonLivraisonPDF,
} = require("../controllers/bonLivraisonController");

// Create a new delivery note
router.post("/", createBonLivraison);

// Get all delivery notes
router.get("/", getBonLivraisons);

// Get a specific delivery note by ID
router.get("/:id", getBonLivraisonById);

// Update a delivery note
router.put("/:id", updateBonLivraison);

// Delete a delivery note
router.delete("/:id", deleteBonLivraison);

// Add advancement to a delivery note
router.post("/:bonLivraisonId/advancements", addAdvancementToBonLivraison);

// Generate PDF for a delivery note
router.get("/:id/pdf", generateBonLivraisonPDF);

module.exports = router;
