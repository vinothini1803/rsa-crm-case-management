import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `vehicleRegistrationNumber` `vehicleRegistrationNumber` VARCHAR(20) NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `vehicleRegistrationNumber` `vehicleRegistrationNumber` VARCHAR(20) NOT NULL;"
    );
  },
};
