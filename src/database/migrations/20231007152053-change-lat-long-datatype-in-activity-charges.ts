import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` DROP dropLocationLat;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` DROP dropLocationLong;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` ADD `dropLocationLat` VARCHAR(60) NULL DEFAULT NULL AFTER `dropLocation`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` ADD `dropLocationLong` VARCHAR(60) NULL DEFAULT NULL AFTER `dropLocationLat`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` DROP dropLocationLat;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` DROP dropLocationLong;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` ADD `dropLocationLat` DECIMAL(12,8) UNSIGNED NULL DEFAULT NULL AFTER `dropLocation`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityDetails` ADD `dropLocationLong` DECIMAL(12,8) UNSIGNED NULL DEFAULT NULL AFTER `dropLocationLat`;"
    );
  },
};
