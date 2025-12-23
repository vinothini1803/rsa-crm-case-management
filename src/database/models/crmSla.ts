import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities, CaseDetails } from "./index";

const crmSla = sequelize.define(
  "crmSla",
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
      // SLA Inprogress(In time for eg 1 min left), SLA Achieved, SLA Violated
      type: DataTypes.TEXT,
      allowNull: true,
    },
    escalationConfigId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    esclationStatus: {
      // Inprogress(In time for eg 1 min left), Achieved, Violated
      type: DataTypes.TEXT,
      allowNull: true,
    },
    statusColor: {
      type: DataTypes.STRING(60), // orange, green, red
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
    tableName: "crmSlas",
  }
);

Activities.hasMany(crmSla, {
  foreignKey: "activityId",
});
crmSla.belongsTo(Activities, {
  foreignKey: "activityId",
});

CaseDetails.hasMany(crmSla, {
  foreignKey: "caseDetailId",
});
crmSla.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

Activities.hasOne(crmSla, {
  as: "activityCrmSla",
  foreignKey: "activityId",
});

export default crmSla;
