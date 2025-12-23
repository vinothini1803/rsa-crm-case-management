import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `aspAssignedById` INT(10) UNSIGNED NULL AFTER `isAspAutoAllocated`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP aspAssignedById;"
    );
  },
};
