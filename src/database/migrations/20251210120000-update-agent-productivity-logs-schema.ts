import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Rename totalTicketCount to assigned
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `totalTicketCount` `assigned` INT UNSIGNED NOT NULL DEFAULT 0;"
    );

    // Drop pendingTicketCount column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `pendingTicketCount`;"
    );

    // Add notPicked column after assigned
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `notPicked` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `assigned`;"
    );

    // Add picked column after notPicked
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `picked` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `notPicked`;"
    );

    // Rename inProgressTicketCount to inprogress
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `inProgressTicketCount` `inprogress` INT UNSIGNED NOT NULL DEFAULT 0;"
    );

    // Add cancelled column after inprogress
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `cancelled` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `inprogress`;"
    );

    // Add completed column after cancelled
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `completed` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `cancelled`;"
    );

    // Drop completedTicketCount column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `completedTicketCount`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Add completedTicketCount column back
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `completedTicketCount` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `inprogress`;"
    );

    // Drop completed column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `completed`;"
    );

    // Drop cancelled column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `cancelled`;"
    );

    // Rename inprogress back to inProgressTicketCount
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `inprogress` `inProgressTicketCount` INT UNSIGNED NOT NULL DEFAULT 0;"
    );

    // Drop picked column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `picked`;"
    );

    // Drop notPicked column
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` DROP COLUMN `notPicked`;"
    );

    // Add pendingTicketCount column back
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` ADD `pendingTicketCount` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `assigned`;"
    );

    // Rename assigned back to totalTicketCount
    await queryInterface.sequelize.query(
      "ALTER TABLE `agentProductivityLogs` CHANGE `assigned` `totalTicketCount` INT UNSIGNED NOT NULL DEFAULT 0;"
    );
  },
};
