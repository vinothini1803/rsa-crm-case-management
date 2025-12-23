import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities, CaseDetails } from ".";

const reminder = sequelize.define(
  "reminder",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reminderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    scheduleTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    priorityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    statusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dismiss: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    snoozeCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    isAuto: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      comment: "0-Manual, 1-Auto",
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    updatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

Activities.hasMany(reminder, { foreignKey: "activityId" });
reminder.belongsTo(Activities, { foreignKey: "activityId" });

CaseDetails.hasMany(reminder, { foreignKey: "caseDetailId" });
reminder.belongsTo(CaseDetails, { foreignKey: "caseDetailId" });

export default reminder;
