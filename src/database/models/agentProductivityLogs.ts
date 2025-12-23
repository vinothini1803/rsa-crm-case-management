import { DataTypes } from "sequelize";
import sequelize from "../connection";

const agentProductivityLogs = sequelize.define(
  "agentProductivityLogs",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    loginDatetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    activeTime: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Total active time in seconds",
    },
    currentWorkingStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "Idle",
    },
    assigned: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    notPicked: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    picked: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    inprogress: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    cancelled: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    completed: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    lastCaseAllocatedDateTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    idleTime: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Total idle time in seconds",
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    tableName: "agentProductivityLogs",
    indexes: [
      {
        unique: true,
        fields: ["agentId", "date"],
        name: "unique_agent_date",
      },
    ],
  }
);

export default agentProductivityLogs;

