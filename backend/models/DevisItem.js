// models/DevisItem.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const DevisItem = sequelize.define(
  "DevisItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    quantite: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
    },
    v1: {
      // longueur
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
    },
    v2: {
      // largeur
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1,
    },
    prix_unitaire: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    total_ligne: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    remise_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    articleName: {
      // fallback / manual name when no product selected
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Foreign keys (recommended to add them explicitly like in BonLivraisonProduit)
    devis_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "devis",
        key: "id",
      },
    },
    produit_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true, // allow null if product is optional
      references: {
        model: "produits",
        key: "id",
      },
    },
  },
  {
    tableName: "devis_items",
    timestamps: true,
    underscored: true, // ← added to match BonLivraisonProduit style
  },
);

module.exports = DevisItem;
