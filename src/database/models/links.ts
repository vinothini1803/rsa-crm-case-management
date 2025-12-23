import { DataTypes } from "sequelize";
import sequelize from "../connection";

const links = sequelize.define(
  "links",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
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
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING(250),
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
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
    tableName: "links",
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default links;
