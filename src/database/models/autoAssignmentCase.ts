import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails, Activities } from "./index";

const autoAssignmentCases = sequelize.define(
  "autoAssignmentCases",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    autoAssignResponse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cronStatus: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    tableName: "autoAssignmentCases",
  }
);

//Relationships ---------------------------------

CaseDetails.hasOne(autoAssignmentCases, {
  foreignKey: "caseDetailId",
});
autoAssignmentCases.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

Activities.hasOne(autoAssignmentCases, {
  foreignKey: "activityId",
});
autoAssignmentCases.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default autoAssignmentCases;
