import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `paidToDealerId` INT(10) UNSIGNED NULL AFTER `paidByDealerId`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP `paidToDealerId`;"
    );
  },
};
