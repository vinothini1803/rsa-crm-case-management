import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("caseDetails", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      typeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      agentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      callCenterId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      dealerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      caseNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      registrationNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      vin: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      vehicleTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      vehicleMakeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      vehicleModelId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      subjectID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestSubServiceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestSchemeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      statusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      cancelReasonId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestPickUpLocation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deliveryRequestPickUpStateId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestPickUpCityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestDropDealerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestDropLocation: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deliveryRequestDropStateId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deliveryRequestDropCityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      contactNameAtPickUp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      contactNumberAtPickUp: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      contactNameAtDrop: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      contactNumberAtDrop: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      deliveryRequestEstimatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hasDocuments: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
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
    await queryInterface.dropTable("caseDetails");
  },
};
