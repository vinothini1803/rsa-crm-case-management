import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails ADD ccAdditionalCharge DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER serviceCost;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails ADD aspAdditionalCharge DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER ccAdditionalCharge;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails DROP ccAdditionalCharge;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE activityAspDetails DROP aspAdditionalCharge;"
    );
  },
};
