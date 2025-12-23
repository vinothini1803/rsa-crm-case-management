import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedAspToPickupKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedAspToPickupKm`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedPickupToDropKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedPickupToDropKm`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `estimatedDropToAspKmDuration` VARCHAR(60) NULL DEFAULT NULL AFTER `estimatedDropToAspKm`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedAspToPickupKmDuration;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedPickupToDropKmDuration;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP estimatedDropToAspKmDuration;"
    );
  },
};
