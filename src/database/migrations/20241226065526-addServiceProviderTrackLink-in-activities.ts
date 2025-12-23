import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `serviceProviderTrackLinkId` INT UNSIGNED NULL DEFAULT NULL AFTER `technicianIdCardLinkId`"
    );
    await queryInterface.addConstraint("activities", {
      fields: ["serviceProviderTrackLinkId"],
      type: "foreign key",
      name: "activities_serviceProviderTrackLinkId_fk",
      references: {
        table: "links",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "activities",
      "activities_serviceProviderTrackLinkId_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE activities DROP serviceProviderTrackLinkId;"
    );
  },
};
