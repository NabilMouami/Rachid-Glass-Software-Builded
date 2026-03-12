// models/Facture.js
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class Facture extends Model {}

Facture.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "invoice_number",
      validate: {
        notEmpty: {
          msg: "Le numéro de facture est requis",
        },
      },
    },
    customerName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "customer_name",
      validate: {
        notEmpty: {
          msg: "Le nom du client est requis",
        },
        len: {
          args: [2, 200],
          msg: "Le nom du client doit contenir entre 2 et 200 caractères",
        },
      },
    },
    customerPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "customer_phone",
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "issue_date",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "brouillon",
        "envoyée",
        "payée",
        "partiellement_payée",
        "en_retard",
        "annulée",
        "en_attente",
      ),
      allowNull: false,
      defaultValue: "brouillon",
    },
    discountType: {
      type: DataTypes.ENUM("fixed", "percentage"),
      allowNull: false,
      defaultValue: "fixed",
      field: "discount_type",
    },
    discountValue: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount_value",
      validate: {
        min: {
          args: [0],
          msg: "La valeur de la remise ne peut pas être négative",
        },
      },
    },
    paymentType: {
      type: DataTypes.ENUM(
        "espece",
        "cheque",
        "virement",
        "carte",
        "multiple",
        "non_paye",
      ),
      allowNull: false,
      defaultValue: "non_paye",
      field: "payment_type",
    },

    // TVA specific fields
    tvaRate: {
      type: DataTypes.FLOAT(5, 2),
      allowNull: false,
      defaultValue: 20,
      field: "tva_rate",
      validate: {
        min: {
          args: [0],
          msg: "Le taux de TVA ne peut pas être négatif",
        },
        max: {
          args: [100],
          msg: "Le taux de TVA ne peut pas dépasser 100%",
        },
      },
    },
    tvaAmount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "tva_amount",
      validate: {
        min: {
          args: [0],
          msg: "Le montant de TVA ne peut pas être négatif",
        },
      },
    },
    includeTvaInPrice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "include_tva_in_price",
    },

    // Financial fields
    advancement: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "L'avancement ne peut pas être négatif",
        },
      },
    },
    remainingAmount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "remaining_amount",
      validate: {
        min: {
          args: [0],
          msg: "Le montant restant ne peut pas être négatif",
        },
      },
    },
    subTotal: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "sub_total",
      validate: {
        min: {
          args: [0],
          msg: "Le sous-total ne peut pas être négatif",
        },
      },
    },
    totalHT: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_ht",
      validate: {
        min: {
          args: [0],
          msg: "Le total HT ne peut pas être négatif",
        },
      },
    },
    totalTTC: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_ttc",
      validate: {
        min: {
          args: [0],
          msg: "Le total TTC ne peut pas être négatif",
        },
      },
    },
    discountAmount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount_amount",
      validate: {
        min: {
          args: [0],
          msg: "Le montant de la remise ne peut pas être négatif",
        },
      },
    },

    // Foreign keys
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "clients",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    // Optional: Link to BonLivraison if invoice is created from delivery note
    bonLivraisonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "bon_livraison_id",
      references: {
        model: "bon_livraisons",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    // User who prepared the invoice
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

    // User who validated the invoice
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

    // Metadata (string fields for display)
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

    // Company info
    ice: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "ice",
    },
    ste: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "ste",
    },

    // Timestamps
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "updated_at",
    },
  },
  {
    sequelize,
    modelName: "Facture",
    tableName: "factures",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Facture;
