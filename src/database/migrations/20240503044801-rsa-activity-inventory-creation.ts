import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("rsaActivityInventories", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      activityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: {
          model: "activities",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      failedPartName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      repairWork: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hubCaps: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      spareWheel: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      jackAndJackRoad: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      audioSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      reverseParkingSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      speakers: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      keyWithRemote: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      aerial: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      floorMat: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fixedOrHangingIdol: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      vehicleArrivalStatusAtDealership: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reachedDealershipStatus: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      vehicleAcknowledgedBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mobileNumberOfDealerPerson: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      termsAndConditions: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
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
    await queryInterface.dropTable("rsaActivityInventories");
  },
};
