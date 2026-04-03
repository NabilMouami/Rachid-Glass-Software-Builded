const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Produit extends Model {}

Produit.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },

    reference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "La référence est requise",
        },
        len: {
          args: [1, 100],
          msg: "La référence doit contenir entre 1 et 100 caractères",
        },
      },
    },

    designation: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "La désignation est requise",
        },
      },
    },

    // Longueur en mm
    L1: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    // Largeur en mm
    L2: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    // Surface en m² (calculée automatiquement: L1 * L2 * qty)
    surface: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0,
    },

    qty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, // Changed from 0 to 1
      validate: {
        min: {
          args: [0],
          msg: "La quantité ne peut pas être négative",
        },
      },
    },

    // Prix total tablette
    prix_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // Prix vente minimum
    prix_vente_min: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // Prix vente maximum
    prix_vente_max: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // Prix achat au m²
    prix_achat: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le prix d'achat ne peut pas être négatif",
        },
      },
    },

    // Prix vente au m² (standard)
    prix_vente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: "Le prix de vente ne peut pas être négatif",
        },
      },
    },

    fornisseurId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "fornisseurs",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "Produit",
    tableName: "produits",
    timestamps: true,

    hooks: {
      beforeValidate: (instance) => {
        // Vérification prix min / max
        if (
          instance.prix_vente_min &&
          instance.prix_vente_max &&
          instance.prix_vente_min > instance.prix_vente_max
        ) {
          throw new Error(
            "Le prix de vente minimum ne peut pas être supérieur au prix maximum",
          );
        }
      },

      beforeCreate: (instance) => {
        // Assurer que qty a une valeur par défaut de 1 si non définie
        if (instance.qty === null || instance.qty === undefined) {
          instance.qty = 1;
        }
      },
    },

    indexes: [
      {
        unique: true,
        fields: ["reference"],
      },
      {
        fields: ["designation"],
        type: "FULLTEXT",
      },
      {
        fields: ["fornisseurId"],
      },
    ],
  },
);

module.exports = Produit;
