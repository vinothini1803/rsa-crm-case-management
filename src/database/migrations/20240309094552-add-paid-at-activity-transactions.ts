import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `paidAt` DATETIME NULL AFTER `isAdvanceRefundUsed`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP paidAt;"
    );
  },
};
