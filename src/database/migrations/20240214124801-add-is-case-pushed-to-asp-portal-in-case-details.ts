import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `isCasePushedToAspPortal` BOOLEAN NOT NULL DEFAULT FALSE AFTER `deliveryRequestCreatedDealerId`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP isCasePushedToAspPortal;"
    );
  },
};
