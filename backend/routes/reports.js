const express = require("express");
const router = express.Router();
const {
  getDashboardSummary,
  getRevenueOverTime,
  getPaymentStatusReport,
  getClientStatistics,
  getProductStatistics,
  getPeriodComparison,
  getTVAReport,
  getBLConversionReport,
} = require("../controllers/reportsController");

// GET /api/reports/dashboard          → KPI summary cards
router.get("/dashboard", getDashboardSummary);

// GET /api/reports/revenue-over-time  → time-series chart data
router.get("/revenue-over-time", getRevenueOverTime);

// GET /api/reports/payment-status     → aging + outstanding invoices
router.get("/payment-status", getPaymentStatusReport);

// GET /api/reports/clients            → per-client revenue ranking
router.get("/clients", getClientStatistics);

// GET /api/reports/products           → best-selling products
router.get("/products", getProductStatistics);

// GET /api/reports/comparison         → current vs previous period
router.get("/comparison", getPeriodComparison);

// GET /api/reports/tva                → TVA declaration data
router.get("/tva", getTVAReport);

// GET /api/reports/bl-conversion      → BL → Facture conversion funnel
router.get("/bl-conversion", getBLConversionReport);

module.exports = router;
