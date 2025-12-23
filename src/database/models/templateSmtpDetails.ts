import { DataTypes } from "sequelize";
import sequelize from "../connection";

const templateSmtpDetails = sequelize.define(
  "templateSmtpDetails",
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
    endPoint: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    port: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    senderAddress: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(150),
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
    tableName: "templateSmtpDetails",
  }
);

export default templateSmtpDetails;
