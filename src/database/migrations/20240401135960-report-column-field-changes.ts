import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` ADD `fromService` VARCHAR(100) NULL AFTER `fieldType`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` DROP `fromService`;"
    );
  },
};
