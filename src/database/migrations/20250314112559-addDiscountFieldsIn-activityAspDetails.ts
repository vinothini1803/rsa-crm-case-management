import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `discountPercentage` DECIMAL(5,2) UNSIGNED NULL AFTER `estimatedAdditionalCharge`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `discountAmount` DECIMAL(12,2) UNSIGNED NULL AFTER `discountPercentage`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` ADD `discountReason` VARCHAR(255) NULL AFTER `discountAmount`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP discountPercentage;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP discountAmount;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activityAspDetails` DROP discountReason;"
    );
  },
};
