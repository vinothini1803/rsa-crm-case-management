import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `isOldAspInvoicePushedToAspPortal` BOOLEAN NOT NULL DEFAULT FALSE AFTER `dealerAdvanceEscalationSent`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP isOldAspInvoicePushedToAspPortal;"
    );
  },
};
