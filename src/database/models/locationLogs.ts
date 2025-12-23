import { DataTypes } from "sequelize";
import sequelize from "../connection";

const locationLogs = sequelize.define(
  "locationLogs",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    customerName: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    customerMobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.STRING(70),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.STRING(70),
      allowNull: true,
    },
    expiryDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default locationLogs;
