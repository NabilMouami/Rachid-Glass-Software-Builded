const express = require("express");
const router = express.Router();
const {
  createFactureAchat,
  getFacturesAchat,
  getFacturesAchatByFournisseur,
  getFactureAchatStats,
  getFactureAchatById,
  updateFactureAchat,
  updateFactureAchatStatus,
  deleteFactureAchat,
} = require("../controllers/factureAchatController");

router.post("/", createFactureAchat);
router.get("/", getFacturesAchat);
router.get("/stats", getFactureAchatStats);
router.get("/fournisseur/:fornisseurId", getFacturesAchatByFournisseur);
router.get("/:id", getFactureAchatById);
router.put("/:id", updateFactureAchat);
router.patch("/:id/status", updateFactureAchatStatus);
router.delete("/:id", deleteFactureAchat);

module.exports = router;
