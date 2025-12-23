import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `agentPickedAt` DATETIME NULL DEFAULT NULL AFTER `agentAssignedAt`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `agentPickedAt`;"
    );
  },
};