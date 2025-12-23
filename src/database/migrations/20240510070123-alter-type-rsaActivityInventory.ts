import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` ADD `typeId` INT UNSIGNED NOT NULL AFTER `activityId`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` ADD `requestDealershipSignature` BOOLEAN NOT NULL DEFAULT FALSE AFTER `mobileNumberOfDealerPerson`"
    );

    await queryInterface.removeConstraint(
      "rsaActivityInventories",
      "rsaActivityInventories_ibfk_1"
    );

    await queryInterface.removeIndex("rsaActivityInventories", "activityId");

    await queryInterface.addConstraint("rsaActivityInventories", {
      fields: ["activityId", "typeId"],
      type: "unique",
      name: "rsaActivityInventory_uk",
    });

    await queryInterface.addConstraint("rsaActivityInventories", {
      fields: ["activityId"],
      type: "foreign key",
      name: "FK_activityId",
      references: {
        table: "activities",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "rsaActivityInventories",
      "FK_activityId"
    );
    await queryInterface.removeIndex(
      "rsaActivityInventories",
      "rsaActivityInventory_uk"
    );
    await queryInterface.addIndex("rsaActivityInventories", ["activityId"]);
    await queryInterface.addConstraint("rsaActivityInventories", {
      fields: ["activityId"],
      type: "foreign key",
      name: "rsaActivityInventories_ibfk_1",
      references: {
        table: "activities",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` DROP `requestDealershipSignature`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `rsaActivityInventories` DROP `typeId`;"
    );
  },
};
