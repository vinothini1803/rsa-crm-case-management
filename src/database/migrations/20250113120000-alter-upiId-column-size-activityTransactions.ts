import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` CHANGE COLUMN `upiId` `upiLinkedMobileNumber` VARCHAR(20) NULL;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityTransactions` CHANGE COLUMN `upiLinkedMobileNumber` `upiId` VARCHAR(150) NULL;"
    );
  },
};

