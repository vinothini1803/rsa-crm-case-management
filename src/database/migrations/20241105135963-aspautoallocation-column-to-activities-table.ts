import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspAutoAllocation` BOOLEAN NULL DEFAULT NULL COMMENT '1-Yes,0-No' AFTER `serviceExpectedAt`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP `aspAutoAllocation`;"
    );
  },
};
