import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `aspToPickupKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `totalKm`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `pickupToDropKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `aspToPickupKm`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `dropToAspKm` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `pickupToDropKm`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP aspToPickupKm;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP pickupToDropKm;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP dropToAspKm;"
    );
  },
};
