import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvRazorpayOrderId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoicePath`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoiceDate`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCustomerInvoiced`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCustomerInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `dealerInvoiceNumber`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isCustomerInvoiced`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvRazorpayOrderId` VARCHAR(191) NULL AFTER `isCustomerInvoiced`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoiceDate` DATE NULL AFTER `customerInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoicePath` TEXT NULL AFTER `customerInvoiceDate`;"
    );
  },
};
