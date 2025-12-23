import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities, CaseDetails } from "./index";

const caseSla = sequelize.define(
  "caseSla",
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
      references: {
        model: "caseDetails",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "activities",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    slaConfigId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    slaStatus: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    statusColor: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    violateReasonId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    violateReasonComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    updatedById: {
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
    tableName: "caseSlas",
  }
);

Activities.hasMany(caseSla, {
  foreignKey: "activityId",
});
caseSla.belongsTo(Activities, {
  foreignKey: "activityId",
});

CaseDetails.hasMany(caseSla, {
  foreignKey: "caseDetailId",
});
caseSla.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

CaseDetails.hasOne(caseSla, {
  foreignKey: "caseDetailId",
  as: "agentAssignmentSla",
});

Activities.hasOne(caseSla, {
  foreignKey: "activityId",
  as: "aspAssignmentSla",
});

Activities.hasOne(caseSla, {
  foreignKey: "activityId",
  as: "dealerPaymentSla",
});

CaseDetails.hasOne(caseSla, {
  foreignKey: "caseDetailId",
  as: "firstCaseSla",
});

export default caseSla;
