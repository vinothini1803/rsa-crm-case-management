import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` ADD `policyStartDate` DATE NULL AFTER `policyNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` ADD `policyEndDate` DATE NULL AFTER `policyStartDate`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `policyNumber` `policyNumber` VARCHAR(191) NULL"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP `policyStartDate`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP `policyEndDate`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `policyNumber` `policyNumber` VARCHAR(191) NOT NULL"
    );
  },
};
