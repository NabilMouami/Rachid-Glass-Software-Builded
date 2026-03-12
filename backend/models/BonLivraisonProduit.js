// models/BonLivraisonProduit.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BonLivraisonProduit = sequelize.define(
  "BonLivraisonProduit",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    quantite: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    v1: {
      // Longueur
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1,
    },
    v2: {
      // Largeur
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1,
    },

    prix_unitaire: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    remise_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    deliveredQuantity: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: "Quantity actually delivered",
    },

    bon_livraison_id: {
      // Add this if not present
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "bon_livraisons",
        key: "id",
      },
    },
    produit_id: {
      // Add this if not present
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "produits",
        key: "id",
      },
    },
  },
  {
    tableName: "bon_livraison_produits",
    timestamps: true,
    underscored: true,
  },
);

module.exports = BonLivraisonProduit;
