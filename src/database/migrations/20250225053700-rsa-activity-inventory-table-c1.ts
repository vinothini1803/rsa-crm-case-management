import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` CHANGE `speakers` `speakers` VARCHAR(10) NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` CHANGE `floorMat` `floorMat` VARCHAR(10) NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` CHANGE `speakers` `speakers` INT NULL DEFAULT NULL;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` CHANGE `floorMat` `floorMat` INT NULL DEFAULT NULL;"
    );
  },
};
