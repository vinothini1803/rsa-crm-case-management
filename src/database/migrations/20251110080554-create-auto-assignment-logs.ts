import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("autoAssignmentLogs", {
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("autoAssignmentLogs");
  },
};

