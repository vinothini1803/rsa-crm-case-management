import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `customerName` `customerName` VARCHAR(191) NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `customerContactNumber` `customerContactNumber` VARCHAR(20) NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `vin` `vin` VARCHAR(60) NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `customerServices_uk`;"
    );

    await queryInterface.addConstraint("customerServices", {
      fields: [
        "clientId",
        "vin",
        "vehicleRegistrationNumber",
        "serviceId",
        "policyTypeId",
        "policyNumber",
        "membershipTypeId",
      ],
      type: "unique",
      name: "customerServices_uk",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `customerName` `customerName` VARCHAR(191) NOT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `customerContactNumber` `customerContactNumber` VARCHAR(20) NOT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` CHANGE `vin` `vin` VARCHAR(60) NOT NULL;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `customerServices` DROP INDEX `customerServices_uk`;"
    );

    await queryInterface.addConstraint("customerServices", {
      fields: [
        "clientId",
        "vin",
        "serviceId",
        "policyTypeId",
        "policyNumber",
        "membershipTypeId",
      ],
      type: "unique",
      name: "customerServices_uk",
    });
  },
};
