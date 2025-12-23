import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("dialerLogs", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      agentId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      agentName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      agentPhoneNumber: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      agentStatus: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      agentUniqueId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      apikey: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      audioFile: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      callerId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      campaignName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      campaignStatus: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      customerStatus: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      did: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      duration: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      userName: {
        type: DataTypes.STRING(50),
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
    await queryInterface.dropTable("dialerLogs");
  },
};
