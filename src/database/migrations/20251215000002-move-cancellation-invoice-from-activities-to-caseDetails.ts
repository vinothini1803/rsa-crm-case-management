import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Add cancellation invoice columns to caseDetails
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `isCancellationInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `customerInvoicePath`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancellationInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isCancellationInvoiced`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancellationInvoiceDate` DATE NULL DEFAULT NULL AFTER `cancellationInvoiceNumber`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancellationInvoicePath` TEXT NULL DEFAULT NULL AFTER `cancellationInvoiceDate`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancellationRejectedReason` TEXT NULL DEFAULT NULL AFTER `cancellationInvoicePath`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `cancellationStatusId` INTEGER UNSIGNED NULL DEFAULT NULL AFTER `cancellationRejectedReason`"
    );

    // Remove cancellation invoice columns from activities
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationStatusId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationRejectedReason`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoicePath`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoiceDate`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `cancellationInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCancellationInvoiced`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    // Restore cancellation invoice columns to activities
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCancellationInvoiced` BOOLEAN NOT NULL DEFAULT '0' AFTER `refundStatusId`"
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

    // Remove cancellation invoice columns from caseDetails
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `cancellationStatusId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `cancellationRejectedReason`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `cancellationInvoicePath`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `cancellationInvoiceDate`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `cancellationInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `isCancellationInvoiced`;"
    );
  },
};


