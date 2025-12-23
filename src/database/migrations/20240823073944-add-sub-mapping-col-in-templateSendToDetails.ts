import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` ADD `hasSubMapping` BOOLEAN  DEFAULT 0  AFTER `mappingQuery`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` ADD `subMappingService` VARCHAR(150) NULL AFTER `hasSubMapping`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` ADD `subMappingQuery` TEXT NULL AFTER `subMappingService`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` DROP hasSubMapping;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` DROP subMappingService;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `templateSendToDetails` DROP subMappingQuery;"
    );
  },
};
