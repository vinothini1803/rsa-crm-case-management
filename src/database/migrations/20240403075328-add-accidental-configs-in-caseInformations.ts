import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `hasAccidentalDocument` BOOLEAN NOT NULL DEFAULT FALSE AFTER `notes`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `withoutAccidentalDocument` BOOLEAN NOT NULL DEFAULT FALSE AFTER `hasAccidentalDocument`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` ADD `withoutAccidentalDocumentRemarks` TEXT NULL DEFAULT NULL AFTER `withoutAccidentalDocument`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `hasAccidentalDocument`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `withoutAccidentalDocument`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseInformations` DROP `withoutAccidentalDocumentRemarks`;"
    );
  },
};
