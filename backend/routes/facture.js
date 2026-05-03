// routes/factureRoutes.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
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
  uploadFacturePDF,
} = require("../controllers/factureController");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const facturePdfDir = path.join(__dirname, "..", "uploads", "factures");
ensureDir(facturePdfDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, facturePdfDir),
  filename: (req, file, cb) => {
    const safeOriginal = (file.originalname || "facture.pdf").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    cb(null, `facture-${req.params.id}-${Date.now()}-${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

router.post("/", createFacture);
router.get("/", getFactures);
router.get("/stats", getFactureStats);
router.get("/client/:clientId", getFacturesByClient);
router.get("/:id", getFactureById);
router.put("/:id", updateFacture);
router.patch("/:id/status", updateFactureStatus);
router.post("/:id/advancements", addAdvancement);
router.post("/:id/pdf", upload.single("pdf"), uploadFacturePDF);
router.delete("/:id", deleteFacture);

module.exports = router;
