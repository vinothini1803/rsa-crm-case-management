import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `refundTypeId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `failureReason`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `refundAmount` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `refundTypeId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `refundReason` TEXT NULL DEFAULT NULL AFTER `refundAmount`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `refundId` VARCHAR(191) NULL DEFAULT NULL AFTER `refundReason`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `refundStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `refundId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `refundStatusId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `refundId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `refundReason`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `refundAmount`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `refundTypeId`;"
    );
  },
};


