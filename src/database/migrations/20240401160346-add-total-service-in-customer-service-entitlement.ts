import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServiceEntitlements` ADD `totalService` INT(10) UNSIGNED NULL AFTER `subServiceHasLimit`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServiceEntitlements` DROP `totalService`"
    );
  },
};
