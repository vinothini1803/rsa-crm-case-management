import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dealerDocumentComments` TEXT NULL DEFAULT NULL AFTER `dealerApprovalRejectReason`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dealerDocumentComments;"
    );
  },
};
