import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoiceDate` DATE NULL AFTER `customerInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvoicePath` TEXT NULL AFTER `customerInvoiceDate`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoiceDate`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `customerInvoicePath`"
    );
  },
};
