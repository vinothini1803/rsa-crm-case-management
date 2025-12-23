import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `isActivityProcessing` BOOLEAN NULL DEFAULT NULL AFTER `statusId`;"
    );
    await queryInterface.addIndex("caseDetails", ["isActivityProcessing"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP INDEX `case_details_is_activity_processing`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP isActivityProcessing;"
    );
  },
};
