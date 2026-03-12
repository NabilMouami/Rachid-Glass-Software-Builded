const { Op, fn, col, literal, QueryTypes } = require("sequelize");
const sequelize = require("../config/db");
const Facture = require("../models/Facture");
const BonLivraison = require("../models/bonLivraison");
const FactureProduit = require("../models/FactureProduit");
const Produit = require("../models/Produit");
const Advancement = require("../models/Advancement");
const { Client, BonLivraisonProduit } = require("../models");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Sequelize date range condition for a given column.
 * If no dates provided, defaults to the current calendar year.
 */
const buildDateRange = (startDate, endDate, column = "issueDate") => {
  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { [column]: { [Op.between]: [start, end] } };
};

/**
 * Return MySQL DATE_FORMAT string for a given granularity.
 */
const periodFormat = (granularity) => {
  switch (granularity) {
    case "day":
      return "%Y-%m-%d";
    case "week":
      return "%Y-%u"; // ISO week number
    case "month":
      return "%Y-%m";
    case "year":
      return "%Y";
    default:
      return "%Y-%m";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DASHBOARD SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/dashboard
 * Query params: startDate, endDate
 *
 * Returns high-level KPIs for the selected period:
 *  - Factures: total count, total HT/TTC, total paid, total remaining, by status
 *  - BonLivraisons: total count, total HT/TTC, by status
 *  - Advancements: total collected payments
 *  - Top 5 clients by revenue
 */
const getDashboardSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);

    // ── Factures KPIs ──────────────────────────────────────────────────────
    const factureStats = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("total_ht")), "total_ht"],
        [fn("SUM", col("total_ttc")), "total_ttc"],
        [fn("SUM", col("advancement")), "total_paye"],
        [fn("SUM", col("remaining_amount")), "total_restant"],
      ],
      group: ["status"],
      raw: true,
    });

    // ── BonLivraisons KPIs ─────────────────────────────────────────────────
    const blStats = await BonLivraison.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("sub_total")), "total_ht"],
        [fn("SUM", col("total")), "total_ttc"],
      ],
      group: ["status"],
      raw: true,
    });

    // ── Advancements collected in the period ───────────────────────────────
    const advancementTotal = await Advancement.findOne({
      where: buildDateRange(startDate, endDate, "paymentDate"),
      attributes: [[fn("SUM", col("amount")), "total_collected"]],
      raw: true,
    });

    // ── Top 5 clients by Facture TTC ───────────────────────────────────────
    const topClientsByFactures = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "client_id",
        [fn("COUNT", col("Facture.id")), "nb_factures"],
        [fn("SUM", col("Facture.total_ttc")), "total_ttc"],
      ],
      include: [
        { model: Client, as: "client", attributes: ["id", "nom_complete"] },
      ],
      group: ["client_id", "client.id"],
      order: [[literal("total_ttc"), "DESC"]],
      limit: 5,
      raw: true,
      nest: true,
    });

    // ── Top 5 clients by BonLivraison TTC ──────────────────────────────────
    const topClientsByBLs = await BonLivraison.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "client_id",
        [fn("COUNT", col("BonLivraison.id")), "nb_bls"],
        [fn("SUM", col("BonLivraison.total")), "total_ttc"],
      ],
      include: [
        { model: Client, as: "client", attributes: ["id", "nom_complete"] },
      ],
      group: ["client_id", "client.id"],
      order: [[literal("total_ttc"), "DESC"]],
      limit: 5,
      raw: true,
      nest: true,
    });

    // ── Aggregate facture totals ───────────────────────────────────────────
    const factureTotals = factureStats.reduce(
      (acc, row) => {
        acc.total_count += parseInt(row.count) || 0;
        acc.total_ht += parseFloat(row.total_ht) || 0;
        acc.total_ttc += parseFloat(row.total_ttc) || 0;
        acc.total_paye += parseFloat(row.total_paye) || 0;
        acc.total_restant += parseFloat(row.total_restant) || 0;
        return acc;
      },
      {
        total_count: 0,
        total_ht: 0,
        total_ttc: 0,
        total_paye: 0,
        total_restant: 0,
      },
    );

    const blTotals = blStats.reduce(
      (acc, row) => {
        acc.total_count += parseInt(row.count) || 0;
        acc.total_ht += parseFloat(row.total_ht) || 0;
        acc.total_ttc += parseFloat(row.total_ttc) || 0;
        return acc;
      },
      { total_count: 0, total_ht: 0, total_ttc: 0 },
    );

    res.json({
      success: true,
      period: {
        startDate: startDate || "year_start",
        endDate: endDate || "today",
      },
      factures: {
        totals: {
          count: factureTotals.total_count,
          total_ht: factureTotals.total_ht.toFixed(2),
          total_ttc: factureTotals.total_ttc.toFixed(2),
          total_paye: factureTotals.total_paye.toFixed(2),
          total_restant: factureTotals.total_restant.toFixed(2),
          taux_recouvrement:
            factureTotals.total_ttc > 0
              ? (
                  (factureTotals.total_paye / factureTotals.total_ttc) *
                  100
                ).toFixed(1)
              : "0.0",
        },
        by_status: factureStats,
      },
      bon_livraisons: {
        totals: {
          count: blTotals.total_count,
          total_ht: blTotals.total_ht.toFixed(2),
          total_ttc: blTotals.total_ttc.toFixed(2),
        },
        by_status: blStats,
      },
      advancements: {
        total_collected: parseFloat(
          advancementTotal?.total_collected || 0,
        ).toFixed(2),
      },
      top_clients_factures: topClientsByFactures, // ✅ NEW: Top clients by Factures
      top_clients_bls: topClientsByBLs, // ✅ NEW: Top clients by BLs
      // ⚠️ DEPRECATED: Keep for backward compatibility
      top_clients: topClientsByFactures,
    });
  } catch (error) {
    console.error("Erreur dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Erreur dashboard",
      error: error.message,
    });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// 2. REVENUE OVER TIME (Chart data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/revenue-over-time
 * Query params: startDate, endDate, granularity (day|week|month|year)
 *
 * Returns time-series data for charts: revenue per period for both
 * Factures and BonLivraisons.
 */
const getRevenueOverTime = async (req, res) => {
  try {
    const { startDate, endDate, granularity = "month" } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);
    const fmt = periodFormat(granularity);

    // Factures revenue by period
    const factureRevenue = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        [fn("DATE_FORMAT", col("issue_date"), fmt), "period"],
        [fn("COUNT", col("id")), "nb_factures"],
        [fn("SUM", col("total_ht")), "total_ht"],
        [fn("SUM", col("total_ttc")), "total_ttc"],
        [fn("SUM", col("advancement")), "total_paye"],
      ],
      group: [fn("DATE_FORMAT", col("issue_date"), fmt)],
      order: [[fn("DATE_FORMAT", col("issue_date"), fmt), "ASC"]],
      raw: true,
    });

    // BonLivraisons revenue by period
    const blRevenue = await BonLivraison.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        [fn("DATE_FORMAT", col("issue_date"), fmt), "period"],
        [fn("COUNT", col("id")), "nb_bls"],
        [fn("SUM", col("sub_total")), "total_ht"],
        [fn("SUM", col("total")), "total_ttc"],
      ],
      group: [fn("DATE_FORMAT", col("issue_date"), fmt)],
      order: [[fn("DATE_FORMAT", col("issue_date"), fmt), "ASC"]],
      raw: true,
    });

    // Payments (advancements) by period
    const paymentsOverTime = await Advancement.findAll({
      where: buildDateRange(startDate, endDate, "paymentDate"),
      attributes: [
        [fn("DATE_FORMAT", col("paymentDate"), fmt), "period"],
        [fn("COUNT", col("id")), "nb_payments"],
        [fn("SUM", col("amount")), "total_amount"],
      ],
      group: [fn("DATE_FORMAT", col("paymentDate"), fmt)],
      order: [[fn("DATE_FORMAT", col("paymentDate"), fmt), "ASC"]],
      raw: true,
    });

    res.json({
      success: true,
      granularity,
      factures: factureRevenue,
      bon_livraisons: blRevenue,
      payments: paymentsOverTime,
    });
  } catch (error) {
    console.error("Erreur revenue over time:", error);
    res.status(500).json({
      success: false,
      message: "Erreur revenue over time",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAYMENT STATUS REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/payment-status
 * Query params: startDate, endDate
 *
 * Returns aging analysis of unpaid / partially paid invoices, plus
 * a breakdown by payment method.
 */
// ============================================================================
// REPLACE YOUR CURRENT getPaymentStatusReport WITH THIS CODE
// This version works WITHOUT the montant_paye/montant_restant columns
// ============================================================================

const getPaymentStatusReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);

    // Outstanding invoices with client details
    const outstandingFactures = await Facture.findAll({
      where: {
        ...dateFilter,
        status: { [Op.in]: ["brouillon", "partiellement_payée"] },
      },
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone"],
        },
      ],
      attributes: [
        "id",
        "invoiceNumber",
        "issueDate",
        "total_ttc",
        "advancement",
        "remaining_amount",
        "status",
        "payment_type",
      ],
      order: [["remaining_amount", "DESC"]],
      raw: true,
      nest: true,
    });

    // Outstanding BonLivraison with client details
    const outstandingBonLivraisons = await BonLivraison.findAll({
      where: {
        ...dateFilter,
        status: { [Op.in]: ["brouillon", "partiellement_payée"] },
      },
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone"],
        },
      ],
      attributes: [
        "id",
        "deliveryNumber",
        "issueDate",
        "total",
        "sub_total",
        "status",
        "payment_type",
      ],
      order: [["total", "DESC"]],
      raw: true,
      nest: true,
    });

    // Add calculated montant_paye and montant_restant to BonLivraisons
    const enrichedBonLivraisons = outstandingBonLivraisons.map((bl) => ({
      ...bl,
      montant_paye: 0,
      montant_restant: parseFloat(bl.total || 0),
    }));

    // Aging buckets for Factures: 0-30, 31-60, 61-90, 90+ days overdue
    const now = new Date();
    const facturageAging = { "0-30": [], "31-60": [], "61-90": [], "90+": [] };

    outstandingFactures.forEach((f) => {
      const daysOld = Math.floor(
        (now - new Date(f.issueDate)) / (1000 * 60 * 60 * 24),
      );
      if (daysOld <= 30) facturageAging["0-30"].push(f);
      else if (daysOld <= 60) facturageAging["31-60"].push(f);
      else if (daysOld <= 90) facturageAging["61-90"].push(f);
      else facturageAging["90+"].push(f);
    });

    const factureAgingSummary = Object.entries(facturageAging).map(
      ([bucket, items]) => ({
        bucket,
        count: items.length,
        total_restant: items
          .reduce((s, f) => s + parseFloat(f.montant_restant || 0), 0)
          .toFixed(2),
        items,
      }),
    );

    // Aging buckets for BonLivraison
    const bonLivraisonAging = {
      "0-30": [],
      "31-60": [],
      "61-90": [],
      "90+": [],
    };

    enrichedBonLivraisons.forEach((bl) => {
      const daysOld = Math.floor(
        (now - new Date(bl.issueDate)) / (1000 * 60 * 60 * 24),
      );
      if (daysOld <= 30) bonLivraisonAging["0-30"].push(bl);
      else if (daysOld <= 60) bonLivraisonAging["31-60"].push(bl);
      else if (daysOld <= 90) bonLivraisonAging["61-90"].push(bl);
      else bonLivraisonAging["90+"].push(bl);
    });

    const bonLivraisonAgingSummary = Object.entries(bonLivraisonAging).map(
      ([bucket, items]) => ({
        bucket,
        count: items.length,
        total_restant: items
          .reduce((s, bl) => s + parseFloat(bl.montant_restant || 0), 0)
          .toFixed(2),
        items,
      }),
    );

    // Payment method breakdown (paid invoices)
    const byPaymentMethod = await Facture.findAll({
      where: { ...dateFilter, status: "payée" },
      attributes: [
        "payment_type",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("total_ttc")), "total_ttc"],
      ],
      group: ["payment_type"],
      raw: true,
    });

    // Payment method breakdown for BonLivraison (paid)
    const bonLivraisonByPaymentMethod = await BonLivraison.findAll({
      where: { ...dateFilter, status: "payée" },
      attributes: [
        "payment_type",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("total")), "total_ttc"],
      ],
      group: ["payment_type"],
      raw: true,
    });

    // Advancement payment methods
    const advancementByMethod = await Advancement.findAll({
      where: buildDateRange(startDate, endDate, "paymentDate"),
      attributes: [
        "paymentMethod",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("amount")), "total"],
      ],
      group: ["paymentMethod"],
      raw: true,
    });

    // Calculate totals
    const totalFactureOutstanding = outstandingFactures
      .reduce((s, f) => s + parseFloat(f.montant_restant || 0), 0)
      .toFixed(2);

    const totalBonLivraisonOutstanding = enrichedBonLivraisons
      .reduce((s, bl) => s + parseFloat(bl.montant_restant || 0), 0)
      .toFixed(2);

    const totalOutstanding = (
      parseFloat(totalFactureOutstanding) +
      parseFloat(totalBonLivraisonOutstanding)
    ).toFixed(2);

    res.json({
      success: true,
      factures: {
        aging: factureAgingSummary,
        total_outstanding: totalFactureOutstanding,
        total_outstanding_count: outstandingFactures.length,
        payment_methods: byPaymentMethod,
      },
      bon_livraisons: {
        aging: bonLivraisonAgingSummary,
        total_outstanding: totalBonLivraisonOutstanding,
        total_outstanding_count: enrichedBonLivraisons.length,
        payment_methods: bonLivraisonByPaymentMethod,
      },
      combined_totals: {
        total_outstanding: totalOutstanding,
        total_outstanding_count:
          outstandingFactures.length + enrichedBonLivraisons.length,
      },
      advancement_methods: advancementByMethod,
    });
  } catch (error) {
    console.error("Erreur payment status:", error);
    res.status(500).json({
      success: false,
      message: "Erreur payment status",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. CLIENT STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/clients
 * Query params: startDate, endDate, limit (default 10)
 *
 * Returns per-client revenue, invoice count, average invoice value,
 * payment rate, and outstanding balance.
 */
const getClientStatistics = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);

    const clientStats = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "client_id",
        [fn("COUNT", col("Facture.id")), "nb_factures"],
        [fn("SUM", col("total_ttc")), "total_ttc"],
        [fn("SUM", col("total_ht")), "total_ht"],
        [fn("SUM", col("advancement")), "total_paye"],
        [fn("SUM", col("remaining_amount")), "total_restant"],
        [fn("AVG", col("total_ttc")), "avg_facture"],
        [fn("MAX", col("issue_date")), "last_facture_date"],
      ],
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id", "nom_complete", "telephone", "address"],
        },
      ],
      group: ["client_id", "client.id"],
      order: [[literal("total_ttc"), "DESC"]],
      limit: parseInt(limit),
      raw: true,
      nest: true,
    });

    // Enrich with payment rate
    const enriched = clientStats.map((row) => ({
      ...row,
      total_ttc: parseFloat(row.total_ttc || 0).toFixed(2),
      total_ht: parseFloat(row.total_ht || 0).toFixed(2),
      total_paye: parseFloat(row.total_paye || 0).toFixed(2),
      total_restant: parseFloat(row.total_restant || 0).toFixed(2),
      avg_facture: parseFloat(row.avg_facture || 0).toFixed(2),
      taux_paiement:
        parseFloat(row.total_ttc) > 0
          ? (
              (parseFloat(row.total_paye) / parseFloat(row.total_ttc)) *
              100
            ).toFixed(1)
          : "0.0",
    }));

    // BL stats per client
    const clientBLStats = await BonLivraison.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "client_id",
        [fn("COUNT", col("id")), "nb_bls"],
        [fn("SUM", col("total")), "total_bl_ttc"],
      ],
      group: ["client_id"],
      raw: true,
    });

    const blByClient = clientBLStats.reduce((acc, row) => {
      acc[row.client_id] = row;
      return acc;
    }, {});

    // ✅ FIXED: Format total_bl_ttc as string to match other fields
    const finalStats = enriched.map((row) => ({
      ...row,
      nb_bls: blByClient[row.client_id]?.nb_bls || 0,
      total_bl_ttc: parseFloat(
        blByClient[row.client_id]?.total_bl_ttc || 0,
      ).toFixed(2),
    }));

    res.json({ success: true, clients: finalStats, count: finalStats.length });
  } catch (error) {
    console.error("Erreur client stats:", error);
    res.status(500).json({
      success: false,
      message: "Erreur client stats",
      error: error.message,
    });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// 5. PRODUCT / ARTICLE STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/products
 * Query params: startDate, endDate, limit (default 10)
 *
 * Returns best-selling products by quantity and revenue.
 */
const getProductStatistics = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);

    // We join through FactureProduit
    const productStats = await BonLivraisonProduit.findAll({
      include: [
        {
          model: BonLivraison,
          as: "bonLivraison",
          where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
          attributes: [],
        },
        {
          model: Produit,
          as: "produit",
          attributes: ["id", "reference", "designation"],
        },
      ],
      attributes: [
        "produit_id",
        [fn("COUNT", col("BonLivraisonProduit.id")), "nb_lignes"],
        [fn("SUM", col("quantite")), "total_quantite"],
        [fn("SUM", col("total_ligne")), "total_revenue"],
        [fn("AVG", col("prix_unitaire")), "avg_prix_unitaire"],
      ],
      group: ["produit_id", "produit.id"],
      order: [[literal("total_revenue"), "DESC"]],
      limit: parseInt(limit),
      raw: true,
      nest: true,
    });

    const enriched = productStats.map((row) => ({
      ...row,
      total_quantite: parseFloat(row.total_quantite || 0),
      total_revenue: parseFloat(row.total_revenue || 0).toFixed(2),
      total_ht: parseFloat(row.total_ht || 0).toFixed(2),
      avg_prix_unitaire: parseFloat(row.avg_prix_unitaire || 0).toFixed(2),
    }));

    res.json({ success: true, products: enriched, count: enriched.length });
  } catch (error) {
    console.error("Erreur product stats:", error);
    res.status(500).json({
      success: false,
      message: "Erreur product stats",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPARISON: CURRENT PERIOD vs PREVIOUS PERIOD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/comparison
 * Query params: startDate, endDate
 *
 * Compares the selected period against the equivalent previous period
 * (same duration, immediately before).
 */
const getPeriodComparison = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const current_start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const current_end = endDate ? new Date(endDate) : new Date();
    current_end.setHours(23, 59, 59, 999);

    const duration_ms = current_end - current_start;
    const previous_end = new Date(current_start.getTime() - 1);
    const previous_start = new Date(previous_end.getTime() - duration_ms);

    const fetchPeriodStats = async (start, end) => {
      const where = {
        issueDate: { [Op.between]: [start, end] },
        status: { [Op.ne]: "annulée" },
      };

      const [factureRow] = await Facture.findAll({
        where,
        attributes: [
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total_ttc")), "total_ttc"],
          [fn("SUM", col("advancement")), "total_paye"],
        ],
        raw: true,
      });

      const [blRow] = await BonLivraison.findAll({
        where,
        attributes: [
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total")), "total_ttc"],
        ],
        raw: true,
      });

      return {
        factures: {
          count: parseInt(factureRow?.count || 0),
          total_ttc: parseFloat(factureRow?.total_ttc || 0).toFixed(2),
          total_paye: parseFloat(factureRow?.total_paye || 0).toFixed(2),
        },
        bon_livraisons: {
          count: parseInt(blRow?.count || 0),
          total_ttc: parseFloat(blRow?.total_ttc || 0).toFixed(2),
        },
      };
    };

    const [current, previous] = await Promise.all([
      fetchPeriodStats(current_start, current_end),
      fetchPeriodStats(previous_start, previous_end),
    ]);

    // Calculate % change
    const pct = (curr, prev) => {
      if (!prev || parseFloat(prev) === 0) return curr > 0 ? "+100.0" : "0.0";
      return (
        ((parseFloat(curr) - parseFloat(prev)) / parseFloat(prev)) *
        100
      ).toFixed(1);
    };

    res.json({
      success: true,
      periods: {
        current: { start: current_start, end: current_end },
        previous: { start: previous_start, end: previous_end },
      },
      current,
      previous,
      changes: {
        factures: {
          count_change: pct(current.factures.count, previous.factures.count),
          total_ttc_change: pct(
            current.factures.total_ttc,
            previous.factures.total_ttc,
          ),
          total_paye_change: pct(
            current.factures.total_paye,
            previous.factures.total_paye,
          ),
        },
        bon_livraisons: {
          count_change: pct(
            current.bon_livraisons.count,
            previous.bon_livraisons.count,
          ),
          total_ttc_change: pct(
            current.bon_livraisons.total_ttc,
            previous.bon_livraisons.total_ttc,
          ),
        },
      },
    });
  } catch (error) {
    console.error("Erreur period comparison:", error);
    res.status(500).json({
      success: false,
      message: "Erreur comparison",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. TVA REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/tva
 * Query params: startDate, endDate, granularity (month|quarter|year)
 *
 * Returns TVA collected per period (useful for tax declarations).
 */
const getTVAReport = async (req, res) => {
  try {
    const { startDate, endDate, granularity = "month" } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);
    const fmt = periodFormat(granularity);

    const tvaByPeriod = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        [fn("DATE_FORMAT", col("issue_date"), fmt), "period"],
        [fn("SUM", col("total_ht")), "base_ht"],
        [fn("SUM", col("tva_amount")), "total_tva"],
        [fn("SUM", col("total_ttc")), "total_ttc"],
        [fn("COUNT", col("id")), "nb_factures"],
      ],
      group: [fn("DATE_FORMAT", col("issue_date"), fmt)],
      order: [[fn("DATE_FORMAT", col("issue_date"), fmt), "ASC"]],
      raw: true,
    });

    // TVA by rate
    const tvaByRate = await Facture.findAll({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
      attributes: [
        "tva_rate",
        [fn("COUNT", col("id")), "nb_factures"],
        [fn("SUM", col("total_ht")), "base_ht"],
        [fn("SUM", col("tva_amount")), "total_tva"],
      ],
      group: ["tva_rate"],
      order: [["tva_rate", "ASC"]],
      raw: true,
    });

    const grandTotal = tvaByPeriod.reduce(
      (acc, row) => {
        acc.base_ht += parseFloat(row.base_ht || 0);
        acc.total_tva += parseFloat(row.total_tva || 0);
        acc.total_ttc += parseFloat(row.total_ttc || 0);
        acc.nb_factures += parseInt(row.nb_factures || 0);
        return acc;
      },
      { base_ht: 0, total_tva: 0, total_ttc: 0, nb_factures: 0 },
    );

    res.json({
      success: true,
      granularity,
      by_period: tvaByPeriod,
      by_rate: tvaByRate,
      grand_total: {
        base_ht: grandTotal.base_ht.toFixed(2),
        total_tva: grandTotal.total_tva.toFixed(2),
        total_ttc: grandTotal.total_ttc.toFixed(2),
        nb_factures: grandTotal.nb_factures,
      },
    });
  } catch (error) {
    console.error("Erreur TVA report:", error);
    res.status(500).json({
      success: false,
      message: "Erreur TVA report",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. BON DE LIVRAISON CONVERSION RATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /reports/bl-conversion
 * Query params: startDate, endDate
 *
 * Returns how many BonLivraisons have been converted to Factures.
 */
const getBLConversionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = buildDateRange(startDate, endDate);

    const totalBLs = await BonLivraison.count({
      where: { ...dateFilter, status: { [Op.ne]: "annulée" } },
    });

    const convertedBLs = await BonLivraison.count({
      where: { ...dateFilter, bonLivraisonId: { [Op.ne]: null } },
    });

    const notConvertedBLs = await BonLivraison.findAll({
      where: {
        ...dateFilter,
        bonLivraisonId: null,
        status: { [Op.ne]: "annulée" },
      },
      include: [
        { model: Client, as: "client", attributes: ["id", "nom_complete"] },
      ],
      attributes: [
        "id",
        "deliveryNumber",
        "issueDate",
        "total",
        "status",
      ],
      order: [["issueDate", "DESC"]],
      raw: true,
      nest: true,
    });

    const totalValueConverted = await BonLivraison.findOne({
      where: { ...dateFilter, bonLivraisonId: { [Op.ne]: null } },
      attributes: [[fn("SUM", col("total")), "total"]],
      raw: true,
    });

    const totalValuePending = await BonLivraison.findOne({
      where: {
        ...dateFilter,
        bonLivraisonId: null,
        status: { [Op.ne]: "annulée" },
      },
      attributes: [[fn("SUM", col("total")), "total"]],
      raw: true,
    });

    res.json({
      success: true,
      summary: {
        total_bls: totalBLs,
        converted: convertedBLs,
        not_converted: totalBLs - convertedBLs,
        conversion_rate:
          totalBLs > 0 ? ((convertedBLs / totalBLs) * 100).toFixed(1) : "0.0",
        value_converted: parseFloat(totalValueConverted?.total || 0).toFixed(2),
        value_pending: parseFloat(totalValuePending?.total || 0).toFixed(2),
      },
      pending_bls: notConvertedBLs,
    });
  } catch (error) {
    console.error("Erreur BL conversion:", error);
    res.status(500).json({
      success: false,
      message: "Erreur BL conversion",
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getDashboardSummary,
  getRevenueOverTime,
  getPaymentStatusReport,
  getClientStatistics,
  getProductStatistics,
  getPeriodComparison,
  getTVAReport,
  getBLConversionReport,
};
