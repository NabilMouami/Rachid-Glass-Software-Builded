const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class FactureAchat extends Model {}

FactureAchat.init(
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
          msg: "Le numéro de facture d'achat est requis",
        },
      },
    },
    supplierName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "supplier_name",
      validate: {
        notEmpty: {
          msg: "Le nom du fournisseur est requis",
        },
        len: {
          args: [2, 200],
          msg: "Le nom du fournisseur doit contenir entre 2 et 200 caractères",
        },
      },
    },
    supplierPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "supplier_phone",
    },
    supplierEmail: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "supplier_email",
      validate: {
        isEmail: {
          msg: "L'email du fournisseur n'est pas valide",
        },
      },
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "issue_date",
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "due_date",
      validate: {
        isAfterIssueDate(value) {
          if (
            value &&
            this.issueDate &&
            new Date(value) < new Date(this.issueDate)
          ) {
            throw new Error(
              "La date d'échéance ne peut pas être antérieure à la date d'émission",
            );
          }
        },
      },
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
    fornisseurId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "fornisseur_id",
      references: {
        model: "fornisseurs",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      validate: {
        notNull: {
          msg: "Le fournisseur est requis",
        },
      },
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
    modelName: "FactureAchat",
    tableName: "factures_achat",
    timestamps: true,
    underscored: true,
  },
);

module.exports = FactureAchat;
