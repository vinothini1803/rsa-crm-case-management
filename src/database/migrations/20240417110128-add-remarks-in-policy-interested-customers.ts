import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `policyInterestedCustomers` ADD `remarks` TEXT NULL AFTER `caseDetailId`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `policyInterestedCustomers` DROP `remarks`;"
    );
  },
};
