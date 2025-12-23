import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `caseCreateClickedAt` DATETIME NULL DEFAULT NULL AFTER `inboundCallMonitorUCID`;"
    );
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `caseCreateClickedAt`;"
    );
  },
};


