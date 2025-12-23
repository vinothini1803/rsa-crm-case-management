import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `inboundCallMonitorUCID` VARCHAR(100) NULL AFTER `isCasePushedToAspPortal`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP inboundCallMonitorUCID;"
    );
  },
};
