import { DataTypes } from "sequelize";
import sequelize from "../connection";

const templateLogs = sequelize.define(
  "templateLogs",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    templateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    entityTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    toMobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    toEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ccEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    request: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "templateLogs",
  }
);

export default templateLogs;
