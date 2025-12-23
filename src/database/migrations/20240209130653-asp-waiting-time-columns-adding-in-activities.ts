import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspStartedToPickupAt` DATETIME NULL DEFAULT NULL AFTER `sentApprovalAt`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspStartedToDropAt` DATETIME NULL DEFAULT NULL AFTER `aspReachedToPickupAt`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspEndServiceAt` DATETIME NULL DEFAULT NULL AFTER `aspReachedToDropAt`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `enableAspWaitingTimeInApp` BOOLEAN NOT NULL DEFAULT FALSE AFTER `aspEndServiceAt`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspWaitingTime` VARCHAR(20) NULL DEFAULT NULL AFTER `enableAspWaitingTimeInApp`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `clientWaitingTime` VARCHAR(20) NULL DEFAULT NULL AFTER `aspWaitingTime`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isAspAcceptedCcDetail` BOOLEAN NULL DEFAULT NULL AFTER `clientWaitingTime`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspRejectedCcDetailReasonId` INT(10) UNSIGNED NULL AFTER `isAspAcceptedCcDetail`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `aspStartedToPickupAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `aspStartedToDropAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `aspEndServiceAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `enableAspWaitingTimeInApp`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `aspWaitingTime`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `clientWaitingTime`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isAspAcceptedCcDetail`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspRejectedCcDetailReasonId;"
    );
  },
};
