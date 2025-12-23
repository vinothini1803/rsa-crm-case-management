import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `activeTime` TEXT NULL DEFAULT NULL COMMENT 'Total active time in seconds' AFTER `loginDatetime`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `totalTicketAssignedCount` `totalTicketCount` INT UNSIGNED NOT NULL DEFAULT 0;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `idleHours` `idleTime` TEXT NULL DEFAULT NULL COMMENT 'Total idle time in seconds';"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `activeTime`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `totalTicketCount` `totalTicketAssignedCount` INT UNSIGNED NOT NULL DEFAULT 0;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `idleTime` `idleHours` DECIMAL(10,2) NOT NULL DEFAULT 0;"
    );
  },
};

