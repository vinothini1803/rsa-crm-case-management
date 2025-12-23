import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities, CaseDetails } from "./index";

// Constants for assignmentType
export const ASSIGNMENT_TYPE = {
    AGENT: 1,
    ASP: 2,
};

// Constants for status
export const STATUS = {
    FAILED: 0,
    COMPLETED: 1,
};

const autoAssignmentLogs = sequelize.define(
    "autoAssignmentLogs",
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
            references: {
                model: "caseDetails",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
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
        aspId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        assignmentType: {
            type: DataTypes.TINYINT,
            allowNull: false,
            comment: "1 = AGENT, 2 = ASP",
        },
        status: {
            type: DataTypes.TINYINT,
            allowNull: false,
            comment: "1 = COMPLETED, 0 = FAILED",
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        stackTrace: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "autoAssignmentLogs",
        collate: "utf8mb4_general_ci",
        timestamps: true,
    }
);

//Relationships ---------------------------------

CaseDetails.hasMany(autoAssignmentLogs, {
    foreignKey: "caseDetailId",
});
autoAssignmentLogs.belongsTo(CaseDetails, {
    foreignKey: "caseDetailId",
});

Activities.hasMany(autoAssignmentLogs, {
    foreignKey: "activityId",
});
autoAssignmentLogs.belongsTo(Activities, {
    foreignKey: "activityId",
});

export default autoAssignmentLogs;

