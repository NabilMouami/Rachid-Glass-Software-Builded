// models/Advancement.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Advancement extends Model {}

Advancement.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    paymentMethod: {
      type: DataTypes.ENUM("espece", "cheque", "virement", "carte"),
      allowNull: false,
      defaultValue: "espece",
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Check number, transfer reference, etc.",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    bonLivraisonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "bon_livraisons", // Make sure this matches your actual table name
        key: "id",
      },
    },
    factureId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "factures",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    // factureId: {
    //   type: DataTypes.INTEGER.UNSIGNED,
    //   allowNull: true,
    //   references: {
    //     model: "factures",
    //     key: "id",
    //   },
    // },
  },
  {
    sequelize,
    modelName: "Advancement",
    tableName: "advancements",
    timestamps: true,
  },
);

module.exports = Advancement;
