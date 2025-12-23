import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails ADD payoutAmount DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER serviceCost;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails DROP payoutAmount;"
    );
  },
};
