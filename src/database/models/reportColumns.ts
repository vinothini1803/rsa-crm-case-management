import { DataTypes } from "sequelize";
import sequelize from "../connection";

const reportColumns = sequelize.define(
  "reportColumns",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    columnName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fromTable: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fromColumn: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    mapping: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    targetTable: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targetColumn: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fieldType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fromService: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targetTableHasRelation: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    relationTable: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    relationName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    relationTableColumn: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: false,
  }
);

export default reportColumns;
