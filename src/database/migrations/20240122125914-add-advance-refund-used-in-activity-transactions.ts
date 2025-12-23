import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `isAdvanceRefundUsed` BOOLEAN NULL DEFAULT NULL AFTER `paidByDealerId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `isAdvanceRefundUsed`;"
    );
  },
};
