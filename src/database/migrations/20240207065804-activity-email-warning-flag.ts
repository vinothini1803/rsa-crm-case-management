import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dealerAdvanceInitialWarningSent` BOOLEAN NOT NULL DEFAULT FALSE AFTER `aspReachedToDropAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dealerAdvanceFinalWarningSent` BOOLEAN NOT NULL DEFAULT FALSE AFTER `dealerAdvanceInitialWarningSent`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `dealerAdvanceEscalationSent` BOOLEAN NOT NULL DEFAULT FALSE AFTER `dealerAdvanceFinalWarningSent`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dealerAdvanceInitialWarningSent;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dealerAdvanceFinalWarningSent;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP dealerAdvanceEscalationSent;"
    );
  },
};
