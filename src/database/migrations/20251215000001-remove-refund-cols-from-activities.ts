import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundStatusId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundReason`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundAmount`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundTypeId`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `refundTypeId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `serviceProviderTrackLinkId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `refundAmount` DECIMAL(12, 2) UNSIGNED NULL DEFAULT NULL AFTER `refundTypeId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `refundReason` TEXT NULL DEFAULT NULL AFTER `refundAmount`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `refundId` VARCHAR(191) NULL DEFAULT NULL AFTER `refundReason`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `refundStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `refundId`"
    );
  },
};


