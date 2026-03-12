// routes/analytics.js
const express = require("express");
const router = express.Router();

const {
  getDashboardSummary,
  getRevenueAnalytics,
  getPaymentTypeAnalytics,
  getCustomerAnalytics,
  getStatusAnalytics,
  getRecentInvoices,
  getOverdueInvoices,
  getYearlyComparison,
  getInvoiceStatistics,
} = require("../controllers/analyticsController");

// Dashboard routes
router.get("/dashboard/summary", getDashboardSummary);
router.get("/dashboard/revenue", getRevenueAnalytics);
router.get("/dashboard/payment-types", getPaymentTypeAnalytics);
router.get("/dashboard/customers", getCustomerAnalytics);
router.get("/dashboard/status", getStatusAnalytics);
router.get("/dashboard/recent-invoices", getRecentInvoices);
router.get("/dashboard/overdue-invoices", getOverdueInvoices);
router.get("/dashboard/yearly-comparison", getYearlyComparison);
router.get("/dashboard/statistics", getInvoiceStatistics);

module.exports = router;
