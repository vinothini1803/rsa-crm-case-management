import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `customerInvRazorpayOrderId` VARCHAR(191) NULL AFTER `isCustomerInvoiced`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP customerInvRazorpayOrderId;"
    );
  },
};
