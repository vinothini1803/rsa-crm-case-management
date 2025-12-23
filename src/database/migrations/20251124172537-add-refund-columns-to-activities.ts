import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
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
      "ALTER TABLE `activities` ADD `refundStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `refundReason`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCancellationInvoiced` TINYINT NOT NULL DEFAULT '0'  AFTER `refundStatusId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cancellationInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isCancellationInvoiced`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cancellationInvoiceDate` DATE NULL DEFAULT NULL AFTER `cancellationInvoiceNumber`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cancellationInvoicePath` TEXT NULL DEFAULT NULL AFTER `cancellationInvoiceDate`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cancellationRejectedReason` TEXT NULL DEFAULT NULL AFTER `cancellationInvoicePath`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `cancellationStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `cancellationRejectedReason`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundTypeId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundAmount`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundReason`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `refundStatusId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCancellationInvoiced`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoiceNumber`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoiceDate`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoicePath`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationRejectedReason`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationStatusId`"
    );
  },
};
