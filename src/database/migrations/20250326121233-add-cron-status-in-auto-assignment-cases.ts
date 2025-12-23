import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `autoAssignmentCases` ADD `cronStatus` TINYINT NOT NULL DEFAULT '0' COMMENT '0-NOT PROCESSED, 1-PROCESSING, 2-PROCESSED' AFTER `autoAssignResponse`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `autoAssignmentCases` DROP cronStatus;"
    );
  },
};
