import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `advancePaymentMethodId` INT(10) UNSIGNED NULL AFTER `customerNeedToPay`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `advancePaymentPaidToId` INT(10) UNSIGNED NULL AFTER `advancePaymentMethodId`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP advancePaymentMethodId;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP advancePaymentPaidToId;"
    );
  },
};
