import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspToBreakdownKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedPickupToDropKmDuration`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspToBreakdownKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedAspToBreakdownKm`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedBreakdownToAspKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedAspToBreakdownKmDuration`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedBreakdownToAspKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedBreakdownToAspKm`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedBreakdownToDropKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `estimatedBreakdownToAspKmDuration`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedBreakdownToDropKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedBreakdownToDropKm`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedAspToBreakdownKm`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedAspToBreakdownKmDuration`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedBreakdownToAspKm`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedBreakdownToAspKmDuration`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedBreakdownToDropKm`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP `estimatedBreakdownToDropKmDuration`"
    );
  },
};
