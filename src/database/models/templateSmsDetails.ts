import { DataTypes } from "sequelize";
import sequelize from "../connection";

const templateSmsDetails = sequelize.define(
  "templateSmsDetails",
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
    smsApiKey: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    smsSenderId: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    smsApiUrl: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    smsDltEntityId: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    smsTemplateId: {
      type: DataTypes.STRING(120),
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
    tableName: "templateSmsDetails",
  }
);

export default templateSmsDetails;
