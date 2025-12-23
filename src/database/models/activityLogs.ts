import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities, CaseDetails } from "./index";

const activityLogs = sequelize.define(
  "activityLogs",
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
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    actionTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    channelId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    toId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    callTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aspActivityReportNewValue: {
      type: DataTypes.STRING(199),
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
  }
);

//Relationships ---------------------------------

Activities.hasMany(activityLogs, {
  foreignKey: "activityId",
});
activityLogs.belongsTo(Activities, {
  foreignKey: "activityId",
});

CaseDetails.hasMany(activityLogs, {
  foreignKey: "caseDetailId",
});
activityLogs.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

export default activityLogs;
