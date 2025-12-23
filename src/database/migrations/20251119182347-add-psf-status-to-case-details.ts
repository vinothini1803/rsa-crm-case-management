import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` ADD `psfStatus` TINYINT UNSIGNED NOT NULL DEFAULT '1' COMMENT '1-Not completed, 2-Completed' AFTER `feedbackRating`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseDetails` DROP COLUMN `psfStatus`;"
    );
  },
};

