import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("crmSlas", {
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
      escalationConfigId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      esclationStatus: { 
        type: DataTypes.TEXT,
        allowNull: true,
      },
      statusColor: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      caseReasonId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      activityReasonId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      comments: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("crmSlas");
  },
};
