// models/index.js
const sequelize = require("../config/db");

// Import all models
const User = require("./user");
const BonLivraison = require("./bonLivraison");
const BonLivraisonProduit = require("./BonLivraisonProduit");
const Fornisseur = require("./fornisseur");
const Produit = require("./Produit");
const Client = require("./client");
const Advancement = require("./Advancement");
const Devis = require("./Devis");
const DevisItem = require("./DevisItem");

// Import new Facture models
const Facture = require("./Facture");
const FactureProduit = require("./FactureProduit");

// ============================================
// USER ASSOCIATIONS
// ============================================

// User - BonLivraison relationships (prepared by)
User.hasMany(BonLivraison, {
  foreignKey: "preparedById",
  as: "preparedBonLivraisons",
});

BonLivraison.belongsTo(User, {
  foreignKey: "preparedById",
  as: "preparator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User - BonLivraison relationships (validated by)
User.hasMany(BonLivraison, {
  foreignKey: "validatedById",
  as: "validatedBonLivraisons",
});

BonLivraison.belongsTo(User, {
  foreignKey: "validatedById",
  as: "validator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User - Facture relationships (prepared by)
User.hasMany(Facture, {
  foreignKey: "preparedById",
  as: "preparedFactures",
});

Facture.belongsTo(User, {
  foreignKey: "preparedById",
  as: "preparator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User - Facture relationships (validated by)
User.hasMany(Facture, {
  foreignKey: "validatedById",
  as: "validatedFactures",
});

Facture.belongsTo(User, {
  foreignKey: "validatedById",
  as: "validator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User - Devis relationships (prepared by)
User.hasMany(Devis, {
  foreignKey: "preparedById",
  as: "preparedDevis",
});

Devis.belongsTo(User, {
  foreignKey: "preparedById",
  as: "preparator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// User - Devis relationships (validated by)
User.hasMany(Devis, {
  foreignKey: "validatedById",
  as: "validatedDevis",
});

Devis.belongsTo(User, {
  foreignKey: "validatedById",
  as: "validator",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// ============================================
// EXISTING RELATIONSHIPS (unchanged)
// ============================================

// Fornisseur - Produit relationships
Fornisseur.hasMany(Produit, {
  foreignKey: "fornisseurId",
  as: "produits",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Produit.belongsTo(Fornisseur, {
  foreignKey: "fornisseurId",
  as: "fornisseur",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Client - BonLivraison relationships
Client.hasMany(BonLivraison, {
  foreignKey: "client_id",
  as: "bonLivraisons",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

BonLivraison.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// BonLivraison - Advancement relationships
BonLivraison.hasMany(Advancement, {
  foreignKey: "bon_livraison_id",
  as: "advancements",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Advancement.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bon_livraison",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Many-to-Many relationship between BonLivraison and Produit
BonLivraison.belongsToMany(Produit, {
  through: BonLivraisonProduit,
  foreignKey: "bon_livraison_id",
  otherKey: "produit_id",
  as: "produits",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Produit.belongsToMany(BonLivraison, {
  through: BonLivraisonProduit,
  foreignKey: "produit_id",
  otherKey: "bon_livraison_id",
  as: "bonLivraisons",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Direct relationships for BonLivraisonProduit
BonLivraisonProduit.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bonLivraison",
});

BonLivraisonProduit.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
});

BonLivraison.hasMany(BonLivraisonProduit, {
  foreignKey: "bon_livraison_id",
  as: "lignes",
  onDelete: "CASCADE",
});

Produit.hasMany(BonLivraisonProduit, {
  foreignKey: "produit_id",
  as: "bonLivraisonItems",
  onDelete: "CASCADE",
});

// Devis relationships
Client.hasMany(Devis, {
  foreignKey: "client_id",
  as: "devis",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Devis.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Devis ↔ DevisItem
Devis.hasMany(DevisItem, {
  foreignKey: "devis_id",
  as: "lignes",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

DevisItem.belongsTo(Devis, {
  foreignKey: "devis_id",
  as: "devis",
});

// DevisItem ↔ Produit
DevisItem.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
});

Produit.hasMany(DevisItem, {
  foreignKey: "produit_id",
  as: "devisItems",
});

// ============================================
// NEW FACTURE RELATIONSHIPS
// ============================================

// Client - Facture relationships
Client.hasMany(Facture, {
  foreignKey: "client_id",
  as: "factures",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Facture.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// BonLivraison - Facture relationship (optional - if invoice created from delivery note)
BonLivraison.hasOne(Facture, {
  foreignKey: "bon_livraison_id",
  as: "facture",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Facture.belongsTo(BonLivraison, {
  foreignKey: "bon_livraison_id",
  as: "bonLivraison",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Facture - Advancement relationships
Facture.hasMany(Advancement, {
  foreignKey: "facture_id",
  as: "advancements",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Note: You'll need to update the Advancement model to include facture_id
// We'll modify Advancement model later

// Many-to-Many relationship between Facture and Produit
Facture.belongsToMany(Produit, {
  through: FactureProduit,
  foreignKey: "facture_id",
  otherKey: "produit_id",
  as: "produits",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

Produit.belongsToMany(Facture, {
  through: FactureProduit,
  foreignKey: "produit_id",
  otherKey: "facture_id",
  as: "factures",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Direct relationships for FactureProduit
FactureProduit.belongsTo(Facture, {
  foreignKey: "facture_id",
  as: "facture",
  onDelete: "CASCADE",
});

FactureProduit.belongsTo(Produit, {
  foreignKey: "produit_id",
  as: "produit",
  onDelete: "CASCADE",
});

Facture.hasMany(FactureProduit, {
  foreignKey: "facture_id",
  as: "lignes",
  onDelete: "CASCADE",
});

Produit.hasMany(FactureProduit, {
  foreignKey: "produit_id",
  as: "factureItems",
  onDelete: "CASCADE",
});

// ============================================
// EXPORT ALL MODELS
// ============================================
const db = {
  sequelize,
  User,
  Advancement,
  Devis,
  Fornisseur,
  Produit,
  Client,
  DevisItem,
  BonLivraison,
  BonLivraisonProduit,
  Facture,
  FactureProduit,
};

module.exports = db;
