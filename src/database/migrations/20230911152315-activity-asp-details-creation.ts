import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("activityAspDetails", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
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
        allowNull: false,
      },
      subServiceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      aspServiceAccepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0, //-1
      },
      rejectReasonId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      aspMechanicId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      aspMechanicServiceAccepted: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      aspMechanicRejectReasonId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      aspVehicleRegistrationNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      totalKm: {
        type: DataTypes.DECIMAL(10, 2).UNSIGNED,
        allowNull: true,
      },
      serviceCost: {
        type: DataTypes.DECIMAL(12, 2).UNSIGNED,
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
    await queryInterface.dropTable("activityAspDetails");
  },
};
