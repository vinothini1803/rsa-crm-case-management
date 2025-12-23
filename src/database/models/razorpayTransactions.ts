import { DataTypes } from "sequelize";
import sequelize from "../connection";

const razorpayTransactions = sequelize.define(
  "razorpayTransactions",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    payableTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    payableId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    traceNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    orderNo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentStatusId: {
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

export default razorpayTransactions;
