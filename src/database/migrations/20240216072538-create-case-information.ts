import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("caseInformations", {
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
          model: "caseDetails", // The name of the target table
          key: "id", // The name of the target column
        },
        onDelete: "CASCADE", // Optional: cascade on delete
        onUpdate: "CASCADE",
      },
      customerContactName: { type: DataTypes.STRING(255), allowNull: true },
      customerMobileNumber: { type: DataTypes.STRING(20), allowNull: true },
      customerCurrentContactName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      customerCurrentMobileNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      customerAlternateMobileNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      voiceOfCustomer: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dispositionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      customerCurrentContactLanguageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      }, //Languages
      channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      caseTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      accidentTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      specialCraneNeeded: { type: DataTypes.BOOLEAN, allowNull: true },
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      subServiceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      conditionOfVehicleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      conditionOfVehicleOthers: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      irateCustomer: { type: DataTypes.BOOLEAN, allowNull: true },
      womenAssist: { type: DataTypes.BOOLEAN, allowNull: true },
      policyNumber: { type: DataTypes.STRING(100), allowNull: true },
      fuelTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      saleDate: { type: DataTypes.DATEONLY, allowNull: true },
      runningKm: { type: DataTypes.STRING(100), allowNull: true },
      policyTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      policyStartDate: { type: DataTypes.DATEONLY, allowNull: true },
      policyEndDate: { type: DataTypes.DATEONLY, allowNull: true },
      serviceEligibilityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      serviceEligibility: { type: DataTypes.STRING(100), allowNull: true },
      policyPremiumId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      getLocationViaId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      reasonForManualLocationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      }, //configs or master
      sentToMobile: { type: DataTypes.STRING(20), allowNull: true },
      sentLink: { type: DataTypes.TEXT, allowNull: true },
      breakdownLocation: { type: DataTypes.TEXT, allowNull: true },
      nearestCity: { type: DataTypes.STRING(100), allowNull: true },
      breakdownLat: { type: DataTypes.STRING(100), allowNull: true },
      breakdownLong: { type: DataTypes.STRING(100), allowNull: true },
      areaId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      customerLocation: { type: DataTypes.TEXT, allowNull: true },
      vehicleLocationId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      dropLocationTypeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, //configs
      customerPreferredLocationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      }, //configs
      dropDealerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      dropDealerLat: { type: DataTypes.STRING(100), allowNull: true },
      dropDealerLong: { type: DataTypes.STRING(100), allowNull: true },
      dealerDropToBreakdownDistance: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      sendPaymentLinkTo: { type: DataTypes.STRING(20), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: true },
      updatedAt: { type: DataTypes.DATE, allowNull: true },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("caseInformations");
  },
};
