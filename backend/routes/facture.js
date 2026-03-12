// routes/factureRoutes.js
const express = require("express");
const router = express.Router();
const {
  createFacture,
  getFactures,
  getFacturesByClient,
  getFactureStats,
  getFactureById,
  updateFacture,
  updateFactureStatus,
  addAdvancement,
  deleteFacture,
} = require("../controllers/factureController");

router.post("/", createFacture);
router.get("/", getFactures);
router.get("/stats", getFactureStats);
router.get("/client/:clientId", getFacturesByClient);
router.get("/:id", getFactureById);
router.put("/:id", updateFacture);
router.patch("/:id/status", updateFactureStatus);
router.post("/:id/advancements", addAdvancement);
router.delete("/:id", deleteFacture);

module.exports = router;
