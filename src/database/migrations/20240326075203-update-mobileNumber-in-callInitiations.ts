import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callInitiations` CHANGE `mobileNumber` `mobileNumber` VARCHAR(20) NULL DEFAULT NULL;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callInitiations` CHANGE `mobileNumber` `mobileNumber` INT UNSIGNED NULL DEFAULT NULL;"
    );
  },
};
