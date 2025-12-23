import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Templates } from ".";

const templateDynamicFields = sequelize.define(
  "templateDynamicFields",
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    inputTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    fromTable: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    whereColumn: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    whereValueVariable: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    columnName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    query: {
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
    tableName: "templateDynamicFields",
  }
);

//Relationships ---------------------------------

Templates.hasMany(templateDynamicFields, {
  foreignKey: "templateId",
});

export default templateDynamicFields;
