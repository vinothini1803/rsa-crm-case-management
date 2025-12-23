import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `aspId` `aspId` INT(10) UNSIGNED NULL"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` CHANGE `aspId` `aspId` INT(10) UNSIGNED NOT NULL"
    );
  },
};
