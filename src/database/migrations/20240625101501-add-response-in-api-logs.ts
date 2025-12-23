import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` CHANGE `srcData` `request` TEXT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` CHANGE `errors` `response` TEXT NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` CHANGE `request` `srcData` TEXT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `apiLogs` CHANGE `response` `errors` TEXT NULL DEFAULT NULL;"
    );
  },
};
