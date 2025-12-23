import { DataTypes } from "sequelize";
import sequelize from "../connection";

const debugMails = sequelize.define(
  "debugMails",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    to: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bcc: {
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
    tableName: "debugMails",
    paranoid: true,
  }
);

export default debugMails;
