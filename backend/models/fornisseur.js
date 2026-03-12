const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Fornisseur extends Model {}

Fornisseur.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    nom_complete: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Le nom complet est requis",
        },
        len: {
          args: [2, 200],
          msg: "Le nom complet doit contenir entre 2 et 200 caractères",
        },
      },
    },
    ville: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    telephone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Le numéro de téléphone est requis",
        },
        is: {
          args: /^[0-9+\-\s()]{8,20}$/,
          msg: "Format de téléphone invalide",
        },
      },
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      validate: {
        len: {
          args: [0, 50],
          msg: "La référence ne doit pas dépasser 50 caractères",
        },
      },
    },
  },
  {
    sequelize,
    modelName: "Fornisseur",
    tableName: "fornisseurs",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["telephone"],
      },
      {
        unique: true,
        fields: ["reference"],
        where: {
          reference: {
            [sequelize.Sequelize.Op.ne]: null,
          },
        },
      },
    ],
  },
);

module.exports = Fornisseur;
