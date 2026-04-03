// models/Devis.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Devis = sequelize.define(
  "Devis",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    devisNumber: {
      type: DataTypes.STRING(12),
      allowNull: false,
      unique: true,
      field: "devis_number",
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customerPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    issueDate: {
      type: DataTypes.DATE,
      field: "issue_date",
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    validUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "brouillon",
        "envoyé",
        "en_attente",
        "accepté",
        "refusé",
        "expiré",
        "annulée",
        "transformé_facture",
        "transformé_bon_livraison",
      ),
      defaultValue: "brouillon",
      allowNull: false,
    },
    discountType: {
      type: DataTypes.ENUM("fixed", "percentage"),
      defaultValue: "fixed",
    },
    discountValue: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    subTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    client_id: {
      type: DataTypes.INTEGER.UNSIGNED, // ← Add .UNSIGNED here
      allowNull: true,
      references: {
        model: "clients",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    preparedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "prepared_by_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    validatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "validated_by_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    preparedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "prepared_by",
    },
    validatedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "validated_by",
    },
    convertedToInvoice: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "converted_to_invoice",
    },
    convertedInvoiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "converted_invoice_id",
    },
    convertedToBonLivraison: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "converted_to_bon_livraison",
    },
    convertedBonLivraisonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "converted_bon_livraison_id",
    },
  },
  {
    tableName: "devis",
    timestamps: true,
    paranoid: false, // change to true if you want soft deletes later
    underscored: true, // ← added to be consistent with BonLivraisonProduit
  },
);

module.exports = Devis;
