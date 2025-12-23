import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isInitiallyCreated` BOOLEAN NULL DEFAULT NULL COMMENT '1-Yes,0-No' AFTER `activityNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isImmediateService` BOOLEAN NULL DEFAULT NULL COMMENT '1-Yes,0-No' AFTER `dealerApprovalRejectReason`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspServiceInitiatingAt` DATETIME NULL AFTER `isImmediateService`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `serviceExpectedAt` DATETIME NULL AFTER `aspServiceInitiatingAt`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP isInitiallyCreated;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP isImmediateService;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspServiceInitiatingAt;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP serviceExpectedAt;"
    );
  },
};
