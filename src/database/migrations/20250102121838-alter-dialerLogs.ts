import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` ADD `caseDetailId` INT(10) UNSIGNED NULL AFTER `userName`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` ADD `disposition` TEXT NULL AFTER `caseDetailId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` ADD `callMonitorUCID` VARCHAR(20) NULL AFTER `disposition`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` DROP caseDetailId;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` DROP disposition;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `dialerLogs` DROP callMonitorUCID;"
    );
  },
};
