const express = require("express");

const router = express.Router();

const {
  createDevis,
  getDevis,
  getDevisById,
  updateDevis,
  deleteDevis,
  updateDevisStatus,
  generateDevisPDF,
  convertDevisToInvoice,
  convertDevisToBonLivraison,
} = require("../controllers/devisController");

router.post("/", createDevis);
router.get("/", getDevis);
router.get("/:id", getDevisById);
router.put("/:id", updateDevis);
router.delete("/:id", deleteDevis);
router.patch("/:id/status", updateDevisStatus);
router.get("/:id/pdf", generateDevisPDF);
router.post("/:id/convert-to-invoice", convertDevisToInvoice);
router.post("/:id/convert-to-bon-livraison", convertDevisToBonLivraison);

module.exports = router;
