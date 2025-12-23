import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from ".";

const policyInterestedCustomers = sequelize.define(
  "policyInterestedCustomers",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    remarks: {
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
    tableName: "policyInterestedCustomers",
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

policyInterestedCustomers.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

export default policyInterestedCustomers;
