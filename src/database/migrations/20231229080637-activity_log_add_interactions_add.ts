import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` ADD `channelId` INT(10) UNSIGNED NULL AFTER `typeId`, ADD `toId` INT(10) UNSIGNED NULL AFTER `channelId`, ADD `callTypeId` INT(10) UNSIGNED NULL AFTER `toId`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP `channelId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP `toId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityLogs` DROP `callTypeId`;"
    );
  },
};
