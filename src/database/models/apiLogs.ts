import { DataTypes } from "sequelize";
import sequelize from "../connection";

const apiLogs = sequelize.define(
  "apiLogs",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entityNumber: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    host: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    request: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    isInbound: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "apiLogs",
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default apiLogs;
