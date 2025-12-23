import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` ADD `activityLogId` INT(10) UNSIGNED NULL AFTER `callMonitorUCID`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` DROP activityLogId;"
    );
  },
};
