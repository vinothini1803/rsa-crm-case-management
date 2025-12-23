import { DataTypes } from "sequelize";
import sequelize from "../connection";

const templateSendToDetails = sequelize.define(
  "templateSendToDetails",
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
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    fromTable: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fromWhereColumn: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fromWhereValueVariable: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fromColumnName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hasMapping: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    mappingService: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    mappingQuery: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hasSubMapping: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    subMappingService: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    subMappingQuery: {
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
    tableName: "templateSendToDetails",
    paranoid: true,
  }
);

export default templateSendToDetails;
