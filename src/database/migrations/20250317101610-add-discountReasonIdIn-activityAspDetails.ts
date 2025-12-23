import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `discountReasonId` INT(10) UNSIGNED NULL AFTER `discountAmount`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP discountReasonId;"
    );
  },
};
