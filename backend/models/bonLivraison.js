const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");

class BonLivraison extends Model {}

BonLivraison.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    deliveryNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: "delivery_number", // Explicit column name
      validate: {
        notEmpty: {
          msg: "Le numéro de bon de livraison est requis",
        },
      },
    },
    customerName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "customer_name", // Explicit column name
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
      field: "customer_phone", // Explicit column name
    },
    issueDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "issue_date", // Explicit column name
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
      field: "discount_type", // Explicit column name
    },
    discountValue: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount_value", // Explicit column name
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
      field: "payment_type", // Explicit column name
    },
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
      field: "remaining_amount", // Explicit column name
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
      field: "sub_total", // Explicit column name
      validate: {
        min: {
          args: [0],
          msg: "Le sous-total ne peut pas être négatif",
        },
      },
    },
    total: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: "Le total ne peut pas être négatif",
        },
      },
    },
    discountAmount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount_amount", // Explicit column name
      validate: {
        min: {
          args: [0],
          msg: "Le montant de la remise ne peut pas être négatif",
        },
      },
    },
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
    deliveredBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "delivered_by",
    },
    receiverName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "receiver_name", // Explicit column name
    },
    receiverSignature: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "receiver_signature", // Explicit column name
      comment: "Base64 encoded signature image",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "created_at", // Explicit column name
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "updated_at", // Explicit column name
    },
  },
  {
    sequelize,
    modelName: "BonLivraison",
    tableName: "bon_livraisons",
    timestamps: true,
    underscored: true, // 🔥 ADD THIS - tells Sequelize to use snake_case
  },
);

module.exports = BonLivraison;
