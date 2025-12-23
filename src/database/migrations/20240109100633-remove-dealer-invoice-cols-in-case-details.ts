import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `isDealerInvoiced`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP `dealerInvoiceNumber`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `isDealerInvoiced` BOOLEAN NOT NULL DEFAULT FALSE AFTER `deliveryRequestCreatedDealerId`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `dealerInvoiceNumber` VARCHAR(60) NULL DEFAULT NULL AFTER `isDealerInvoiced`"
    );
  },
};
