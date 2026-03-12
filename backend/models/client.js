const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Client extends Model {}

Client.init(
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
    reference: {
      type: DataTypes.STRING(200),
      allowNull: true,
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
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Client",
    tableName: "clients",
    timestamps: true,
  },
);

module.exports = Client;
