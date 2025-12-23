import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `conditionOfVehicleOthers` `conditionOfVehicleOthers` TEXT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropDealerLat` `dropLocationLat` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropDealerLong` `dropLocationLong` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropDealerLocation` `dropLocation` TEXT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dealerDropToBreakdownDistance` `breakdownToDropLocationDistance` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `customerNeedToPay` BOOLEAN NOT NULL DEFAULT FALSE AFTER `breakdownToDropLocationDistance`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `nonMembershipType` VARCHAR(191) NULL DEFAULT NULL AFTER `customerNeedToPay`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `additionalChargeableKm` VARCHAR(100) NULL DEFAULT NULL AFTER `nonMembershipType`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `conditionOfVehicleOthers` `conditionOfVehicleOthers` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropLocationLat` `dropDealerLat` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropLocationLong` `dropDealerLong` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `dropLocation` `dropDealerLocation` TEXT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` CHANGE `breakdownToDropLocationDistance` `dealerDropToBreakdownDistance` VARCHAR(100) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `customerNeedToPay`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `nonMembershipType`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `additionalChargeableKm`"
    );
  },
};
