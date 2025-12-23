import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `totalKm` `estimatedTotalKm` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `aspToPickupKm` `estimatedAspToPickupKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `pickupToDropKm` `estimatedPickupToDropKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `dropToAspKm` `estimatedDropToAspKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `serviceCost` `estimatedServiceCost` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `ccAdditionalCharge` `estimatedAdditionalCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP aspAdditionalCharge;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `payoutAmount` `estimatedTotalAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualTotalKm` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedTotalAmount`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualServiceCost` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualTotalKm`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualAdditionalCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualServiceCost`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `actualTotalAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `actualAdditionalCharge`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedTotalKm` `totalKm` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedAspToPickupKm` `aspToPickupKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedPickupToDropKm` `pickupToDropKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedDropToAspKm` `dropToAspKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedServiceCost` `serviceCost` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedAdditionalCharge` `ccAdditionalCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `aspAdditionalCharge` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `ccAdditionalCharge`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `estimatedTotalAmount` `payoutAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualTotalKm;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualServiceCost;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualAdditionalCharge;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP actualTotalAmount;"
    );
  },
};
