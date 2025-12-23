import { DataTypes } from "sequelize";
import sequelize from "../connection";

const tempCaseFormDetail = sequelize.define(
  "tempCaseFormDetail",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tempCaseFormDetails",
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default tempCaseFormDetail;
