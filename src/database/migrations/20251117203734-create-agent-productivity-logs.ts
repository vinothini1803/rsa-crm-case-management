import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("agentProductivityLogs", {
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
      currentWorkingStatus: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: "Idle",
      },
      totalTicketAssignedCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      pendingTicketCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      inProgressTicketCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      completedTicketCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      lastCaseAllocatedDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      idleHours: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
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

    // Add unique constraint on (agentId, date)
    await queryInterface.addConstraint("agentProductivityLogs", {
      fields: ["agentId", "date"],
      type: "unique",
      name: "unique_agent_date",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "agentProductivityLogs",
      "unique_agent_date"
    );
    await queryInterface.dropTable("agentProductivityLogs");
  },
};

