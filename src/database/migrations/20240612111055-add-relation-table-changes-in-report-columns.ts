import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` ADD `targetTableHasRelation` BOOLEAN NULL AFTER `fromService`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` ADD `relationTable` VARCHAR(100) NULL AFTER `targetTableHasRelation`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` ADD `relationName` VARCHAR(100) NULL AFTER `relationTable`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` ADD `relationTableColumn` VARCHAR(100) NULL AFTER `relationName`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` DROP targetTableHasRelation;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` DROP relationTable;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` DROP relationName;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `reportColumns` DROP relationTableColumn;"
    );
  },
};
