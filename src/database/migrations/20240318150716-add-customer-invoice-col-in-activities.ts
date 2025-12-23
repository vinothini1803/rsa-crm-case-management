import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isCustomerInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `dealerInvoiceNumber`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isCustomerInvoiced`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isCustomerInvoiced`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoiceNumber`;"
    );
  },
};
