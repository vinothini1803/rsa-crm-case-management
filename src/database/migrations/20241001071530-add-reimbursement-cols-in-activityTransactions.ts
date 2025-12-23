import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `accountHolderName` VARCHAR(150) NULL AFTER `transactionTypeId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `accountNumber` VARCHAR(150) NULL AFTER `accountHolderName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `ifscCode` VARCHAR(150) NULL AFTER `accountNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `upiId` VARCHAR(150) NULL AFTER `ifscCode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` ADD `remarks` TEXT NULL DEFAULT NULL AFTER `paidAt`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP accountHolderName;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP accountNumber;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP ifscCode;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP upiId;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` DROP remarks;"
    );
  },
};
