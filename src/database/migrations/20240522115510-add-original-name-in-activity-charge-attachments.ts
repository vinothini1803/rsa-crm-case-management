import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityChargeAttachments` ADD `originalName` VARCHAR(250) NULL AFTER `fileName`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityChargeAttachments` DROP `originalName`"
    );
  },
};
