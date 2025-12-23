import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from ".";

const callInitiation = sequelize.define(
  "callInitiation",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    contactName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    callFromId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    dispositionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    caseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
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
  }
);

callInitiation.belongsTo(CaseDetails, {
  as: "caseDetail",
  foreignKey: "caseId",
});

CaseDetails.hasOne(callInitiation, {
  as: "callInitiation",
  foreignKey: "caseId",
});

export default callInitiation;
