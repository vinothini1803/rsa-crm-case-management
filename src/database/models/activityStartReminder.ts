import { DataTypes } from "sequelize";
import sequelize from "../connection";
import activities from "./activities";
import { CaseDetails } from "./index";

const ActivityStartReminders = sequelize.define(
  "activity_start_reminders",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
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
    activityNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reminderNo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      comment: "1 / 2 / 3",
    },
    areaType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "CITY / HIGHWAY / HILLY",
    },
    fireAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
     notifyUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "SENT", "SKIPPED"),
      defaultValue: "PENDING",
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    tableName: "activity_start_reminders",
  }
);

/* =========================
   Relationships
========================= */

activities.hasMany(ActivityStartReminders, {
  foreignKey: "activityId",
});

ActivityStartReminders.belongsTo(activities, {
  foreignKey: "activityId",
});

CaseDetails.hasMany(ActivityStartReminders, {
  foreignKey: "caseDetailId",
});

ActivityStartReminders.belongsTo(CaseDetails, {
  foreignKey: "caseDetailId",
});

export default ActivityStartReminders;
