const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./models");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const clientRoutes = require("./routes/client");
const fornisseurRoutes = require("./routes/fornisseur");
const produitRoutes = require("./routes/produit");

const devisRoutes = require("./routes/devis");
const analyticsRoutes = require("./routes/analytics");
const bonLivraison = require("./routes/bonLivraison");
const facture = require("./routes/facture");
const factureAchatRoutes = require("./routes/factureAchat");

const reportRoutes = require("./routes/reports");

const seedAdmin = require("./utils/seedAdmin");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, etc.)
    if (!origin || origin.startsWith("file://")) {
      return callback(null, true);
    }
    // List of allowed origins
    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5000",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ];

    // Add production domains if defined
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    if (process.env.FRONTEND_WWW_URL) {
      allowedOrigins.push(process.env.FRONTEND_WWW_URL);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Apply CORS middleware - this handles preflight requests automatically
app.use(cors(corsOptions));
// Your other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/fornisseurs", fornisseurRoutes);
app.use("/api/produits", produitRoutes);

app.use("/api/devis", devisRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/bonlivraisons", bonLivraison);
app.use("/api/factures", facture);
app.use("/api/factures-achat", factureAchatRoutes);
app.use("/api/reports", reportRoutes);

// Health check
app.get("/", (req, res) => res.json({ message: "API running" }));

// Error handling for CORS
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS policy denied this request",
    });
  }
  next(err);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Database connection and server startup
(async () => {
  try {
    await db.sequelize.authenticate();
    console.log("DB connected");

    console.log("Database models synchronized");

    // 🔥 SEED ADMIN USER HERE
    await seedAdmin();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started at http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
