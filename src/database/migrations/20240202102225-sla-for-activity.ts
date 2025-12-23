import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspServiceAcceptedAt` DATETIME NULL AFTER `dealerInvoiceNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `sentApprovalAt` DATETIME NULL AFTER `aspServiceAcceptedAt`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspServiceAcceptedAt;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP sentApprovalAt;"
    );
  },
};
