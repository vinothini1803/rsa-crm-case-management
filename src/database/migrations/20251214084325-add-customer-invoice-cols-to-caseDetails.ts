import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `isCustomerInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `closedAt`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `customerInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isCustomerInvoiced`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `customerInvoiceDate` DATE NULL DEFAULT NULL AFTER `customerInvoiceNumber`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `customerInvoicePath` TEXT NULL DEFAULT NULL AFTER `customerInvoiceDate`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `customerInvoicePath`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `customerInvoiceDate`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `customerInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `isCustomerInvoiced`;"
    );
  },
};
