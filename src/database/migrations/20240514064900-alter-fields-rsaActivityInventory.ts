import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` DROP `vehicleArrivalStatusAtDealership`"
    );

    await queryInterface.renameColumn(
      "rsaActivityInventories",
      "mobileNumberOfDealerPerson",
      "mobileNumberOfReceiver"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.renameColumn(
      "rsaActivityInventories",
      "mobileNumberOfReceiver",
      "mobileNumberOfDealerPerson"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` ADD `vehicleArrivalStatusAtDealership` VARCHAR(255) NULL DEFAULT NULL;"
    );
  },
};
