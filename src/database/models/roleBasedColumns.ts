import { DataTypes } from "sequelize";
import sequelize from "../connection";

const roleBasedColumns = sequelize.define(
  "roleBasedColumns",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    reportColumn: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default roleBasedColumns;
