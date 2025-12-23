import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` CHANGE `aspServiceInitiatingAt` `serviceInitiatingAt` DATETIME NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` CHANGE `serviceInitiatingAt` `aspServiceInitiatingAt` DATETIME NULL DEFAULT NULL;"
    );
  },
};
