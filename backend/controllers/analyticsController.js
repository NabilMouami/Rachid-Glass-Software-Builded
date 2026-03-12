// controllers/analyticsController.js
const { Invoice, InvoiceItem, Advancement, Sequelize } = require("../models");
const { Op, fn, col } = require("sequelize");

const analyticsController = {
  // Get dashboard summary statistics
  getDashboardSummary: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Build date filter
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      // Get total invoices count
      const totalInvoices = await Invoice.count({ where: dateFilter });

      // Get total revenue and amounts
      const revenueResult = await Invoice.findOne({
        where: dateFilter,
        attributes: [
          [fn("SUM", col("total")), "totalRevenue"],
          [fn("SUM", col("advancement")), "totalAdvancement"],
          [fn("SUM", col("remainingAmount")), "totalRemaining"],
          [fn("SUM", col("subTotal")), "totalSubTotal"],
          [fn("SUM", col("discountAmount")), "totalDiscount"],
        ],
        raw: true,
      });

      // Get invoices by status
      const statusCounts = await Invoice.findAll({
        where: dateFilter,
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total")), "totalAmount"],
        ],
        group: ["status"],
        raw: true,
      });

      // Get monthly revenue (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyRevenue = await Invoice.findAll({
        where: {
          issueDate: {
            [Op.gte]: sixMonthsAgo,
          },
        },
        attributes: [
          [fn("DATE_FORMAT", col("issueDate"), "%Y-%m"), "month"],
          [fn("SUM", col("total")), "revenue"],
          [fn("COUNT", col("id")), "invoiceCount"],
        ],
        group: [fn("DATE_FORMAT", col("issueDate"), "%Y-%m")],
        order: [[fn("DATE_FORMAT", col("issueDate"), "%Y-%m"), "ASC"]],
        raw: true,
      });

      // Get today's stats
      const today = new Date().toISOString().split("T")[0];
      const todayStats = await Invoice.findOne({
        where: {
          issueDate: today,
        },
        attributes: [
          [fn("COUNT", col("id")), "invoiceCount"],
          [fn("SUM", col("total")), "revenue"],
        ],
        raw: true,
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalInvoices,
            totalRevenue: parseFloat(revenueResult?.totalRevenue) || 0,
            totalAdvancement: parseFloat(revenueResult?.totalAdvancement) || 0,
            totalRemaining: parseFloat(revenueResult?.totalRemaining) || 0,
            totalSubTotal: parseFloat(revenueResult?.totalSubTotal) || 0,
            totalDiscount: parseFloat(revenueResult?.totalDiscount) || 0,
            todayInvoices: parseInt(todayStats?.invoiceCount) || 0,
            todayRevenue: parseFloat(todayStats?.revenue) || 0,
          },
          statusDistribution: statusCounts,
          monthlyRevenue,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Dashboard summary error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching dashboard summary",
        error: error.message,
      });
    }
  },

  // Get revenue analytics with filters
  getRevenueAnalytics: async (req, res) => {
    try {
      const { period = "monthly", startDate, endDate } = req.query;

      let groupByFormat;
      switch (period) {
        case "daily":
          groupByFormat = "%Y-%m-%d";
          break;
        case "monthly":
          groupByFormat = "%Y-%m";
          break;
        case "yearly":
          groupByFormat = "%Y";
          break;
        default:
          groupByFormat = "%Y-%m";
      }

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      const revenueAnalytics = await Invoice.findAll({
        where: dateFilter,
        attributes: [
          [fn("DATE_FORMAT", col("issueDate"), groupByFormat), "period"],
          [fn("SUM", col("total")), "revenue"],
          [fn("SUM", col("subTotal")), "subTotal"],
          [fn("SUM", col("discountAmount")), "totalDiscount"],
          [fn("SUM", col("advancement")), "totalAdvancement"],
          [fn("SUM", col("remainingAmount")), "totalRemaining"],
          [fn("COUNT", col("id")), "invoiceCount"],
        ],
        group: [fn("DATE_FORMAT", col("issueDate"), groupByFormat)],
        order: [[fn("DATE_FORMAT", col("issueDate"), groupByFormat), "ASC"]],
        raw: true,
      });

      res.json({
        success: true,
        data: revenueAnalytics,
      });
    } catch (error) {
      console.error("Revenue analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching revenue analytics",
        error: error.message,
      });
    }
  },

  // Get payment type distribution
  getPaymentTypeAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      const paymentAnalytics = await Invoice.findAll({
        where: dateFilter,
        attributes: [
          "paymentType",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total")), "totalAmount"],
          [fn("SUM", col("advancement")), "totalAdvancement"],
          [fn("AVG", col("total")), "averageAmount"],
        ],
        group: ["paymentType"],
        order: [[fn("COUNT", col("id")), "DESC"]],
        raw: true,
      });

      res.json({
        success: true,
        data: paymentAnalytics,
      });
    } catch (error) {
      console.error("Payment analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching payment analytics",
        error: error.message,
      });
    }
  },

  // Get customer analytics
  getCustomerAnalytics: async (req, res) => {
    try {
      const { startDate, endDate, limit = 10 } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      const topCustomers = await Invoice.findAll({
        where: dateFilter,
        attributes: [
          "customerName",
          [fn("COUNT", col("id")), "invoiceCount"],
          [fn("SUM", col("total")), "totalSpent"],
          [fn("AVG", col("total")), "averageInvoice"],
          [fn("MAX", col("createdAt")), "lastPurchase"],
        ],
        group: ["customerName"],
        order: [[fn("SUM", col("total")), "DESC"]],
        limit: parseInt(limit),
        raw: true,
      });

      res.json({
        success: true,
        data: topCustomers,
      });
    } catch (error) {
      console.error("Customer analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching customer analytics",
        error: error.message,
      });
    }
  },

  // Get status-wise analytics
  getStatusAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      const statusAnalytics = await Invoice.findAll({
        where: dateFilter,
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total")), "totalAmount"],
          [fn("SUM", col("remainingAmount")), "totalRemaining"],
          [fn("AVG", col("total")), "averageAmount"],
        ],
        group: ["status"],
        order: [[fn("COUNT", col("id")), "DESC"]],
        raw: true,
      });

      res.json({
        success: true,
        data: statusAnalytics,
      });
    } catch (error) {
      console.error("Status analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching status analytics",
        error: error.message,
      });
    }
  },

  // Get recent invoices with details
  getRecentInvoices: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const recentInvoices = await Invoice.findAll({
        include: [
          {
            model: InvoiceItem,
            as: "items",
            attributes: ["id", "articleName", "quantity", "totalPrice"],
          },
          {
            model: Advancement,
            as: "advancements",
            attributes: ["id", "amount", "paymentDate"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: recentInvoices,
      });
    } catch (error) {
      console.error("Recent invoices error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching recent invoices",
        error: error.message,
      });
    }
  },

  // Get overdue invoices
  getOverdueInvoices: async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const overdueInvoices = await Invoice.findAll({
        where: {
          status: "en_retard",
          remainingAmount: {
            [Op.gt]: 0,
          },
        },
        include: [
          {
            model: InvoiceItem,
            as: "items",
            attributes: ["id", "articleName", "totalPrice"],
          },
        ],
        order: [["issueDate", "ASC"]],
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        data: overdueInvoices,
      });
    } catch (error) {
      console.error("Overdue invoices error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching overdue invoices",
        error: error.message,
      });
    }
  },

  // Get yearly comparison
  getYearlyComparison: async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const yearlyComparison = await Invoice.findAll({
        where: {
          issueDate: {
            [Op.between]: [`${previousYear}-01-01`, `${currentYear}-12-31`],
          },
        },
        attributes: [
          [fn("YEAR", col("issueDate")), "year"],
          [fn("MONTH", col("issueDate")), "month"],
          [fn("SUM", col("total")), "revenue"],
          [fn("COUNT", col("id")), "invoiceCount"],
        ],
        group: ["year", "month"],
        order: [
          ["year", "ASC"],
          ["month", "ASC"],
        ],
        raw: true,
      });

      res.json({
        success: true,
        data: yearlyComparison,
      });
    } catch (error) {
      console.error("Yearly comparison error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching yearly comparison",
        error: error.message,
      });
    }
  },

  // Get invoice statistics
  getInvoiceStatistics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.issueDate = {
          [Op.between]: [startDate, endDate],
        };
      }

      const statistics = await Invoice.findOne({
        where: dateFilter,
        attributes: [
          [fn("AVG", col("total")), "averageInvoiceValue"],
          [fn("MAX", col("total")), "highestInvoiceValue"],
          [fn("MIN", col("total")), "lowestInvoiceValue"],
          [fn("COUNT", col("id")), "totalInvoices"],
          [fn("SUM", col("total")), "totalRevenue"],
        ],
        raw: true,
      });

      // Get payment completion rate
      const paidInvoices = await Invoice.count({
        where: {
          ...dateFilter,
          status: "payée",
        },
      });

      const totalInvoicesCount = parseInt(statistics?.totalInvoices) || 1;
      const paymentCompletionRate = (paidInvoices / totalInvoicesCount) * 100;

      res.json({
        success: true,
        data: {
          ...statistics,
          paymentCompletionRate: Math.round(paymentCompletionRate * 100) / 100,
          paidInvoices,
          averageInvoiceValue: parseFloat(statistics?.averageInvoiceValue) || 0,
          highestInvoiceValue: parseFloat(statistics?.highestInvoiceValue) || 0,
          lowestInvoiceValue: parseFloat(statistics?.lowestInvoiceValue) || 0,
          totalRevenue: parseFloat(statistics?.totalRevenue) || 0,
        },
      });
    } catch (error) {
      console.error("Invoice statistics error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching invoice statistics",
        error: error.message,
      });
    }
  },
};

module.exports = analyticsController;
