import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const activityTransactions = sequelize.define(
  "activityTransactions",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    membershipId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "RSA membership ID for non-membership transactions",
    },
    razorpayOrderId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      comment: "Razorpay order ID for payment tracking",
    },
    razorpayTransactionId: {
      type: DataTypes.STRING(191),
      allowNull: true,
      comment: "Razorpay transaction ID for payment tracking",
    },
    dealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    paymentMethodId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    paymentTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    transactionTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    accountHolderName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    accountNumber: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    ifscCode: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    upiLinkedMobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    paymentStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    paidByDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    paidToDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    isAdvanceRefundUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    refundAmount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    refundReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    refundStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cancellationStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "Cancellation status: 1311=Waiting for BO Approval, 1312=Rejected, 1313=Cancelled",
    },
    cancellationRejectedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for cancellation rejection",
    },
    isForAdditionalKmPayment: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "Indicates if this transaction is for additional KM payment",
    },
    totalKm: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Stores the total KM for this transaction (captured during payment link generation)",
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

//Relationships ---------------------------------

Activities.hasMany(activityTransactions, { foreignKey: "activityId" });
activityTransactions.belongsTo(Activities, { foreignKey: "activityId" });

Activities.hasOne(activityTransactions, {
  foreignKey: "activityId",
  as: "reimbursementActivityTransaction",
  scope: {
    paymentTypeId: 175,
  },
});

export default activityTransactions;
