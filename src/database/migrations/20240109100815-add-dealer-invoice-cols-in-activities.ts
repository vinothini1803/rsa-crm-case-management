import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isDealerInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `activityAppStatusId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dealerInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isDealerInvoiced`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `isDealerInvoiced`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `dealerInvoiceNumber`;"
    );
  },
};
