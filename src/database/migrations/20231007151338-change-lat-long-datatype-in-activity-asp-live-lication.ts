import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` DROP latitude;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` DROP longitude;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` ADD `latitude` VARCHAR(60) NULL DEFAULT NULL AFTER `aspId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` ADD `longitude` VARCHAR(60) NULL DEFAULT NULL AFTER `latitude`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` DROP latitude;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` DROP longitude;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` ADD `latitude` DECIMAL(12,8) UNSIGNED NULL DEFAULT NULL AFTER `aspId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspLiveLocations` ADD `longitude` DECIMAL(12,8) UNSIGNED NULL DEFAULT NULL AFTER `latitude`;"
    );
  },
};
