// models/FactureProduit.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const FactureProduit = sequelize.define(
  "FactureProduit",
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
      validate: {
        min: {
          args: [1],
          msg: "La quantité doit être au moins 1",
        },
      },
    },
    v1: {
      // Longueur
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1,
      validate: {
        min: {
          args: [0.01],
          msg: "La longueur doit être supérieure à 0",
        },
      },
    },
    v2: {
      // Largeur
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1,
      validate: {
        min: {
          args: [0.01],
          msg: "La largeur doit être supérieure à 0",
        },
      },
    },
    prix_unitaire: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le prix unitaire ne peut pas être négatif",
        },
      },
    },
    remise_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "La remise par ligne ne peut pas être négative",
        },
      },
    },
    total_ligne: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le total de la ligne ne peut pas être négatif",
        },
      },
    },

    // TVA per line (if different from invoice TVA)
    tva_ligne: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: null,
      field: "tva_ligne",
      comment: "TVA spécifique pour cette ligne (si différente de la facture)",
    },

    // Foreign keys
    facture_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "factures",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    produit_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "produits",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "facture_produits",
    timestamps: true,
    underscored: true,
  },
);

module.exports = FactureProduit;
