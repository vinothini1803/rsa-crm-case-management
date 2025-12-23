import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `previousAgentId` INT UNSIGNED NULL DEFAULT NULL AFTER `agentReplacedAt`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `previousAgentId`;"
    );
  },
};
