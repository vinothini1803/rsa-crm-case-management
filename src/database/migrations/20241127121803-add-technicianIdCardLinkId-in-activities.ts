import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD `technicianIdCardLinkId` INT UNSIGNED NULL DEFAULT NULL AFTER `remarks`"
    );
    await queryInterface.addConstraint("activities", {
      fields: ["technicianIdCardLinkId"],
      type: "foreign key",
      name: "activities_technicianIdCardLinkId_fk",
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
      "activities_technicianIdCardLinkId_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE activities DROP technicianIdCardLinkId;"
    );
  },
};
