import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "customerServices",
      "unique_clientId_vin_serviceId_policyTypeId_policyNumber"
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

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "customerServices",
      "customerServices_uk"
    );

    await queryInterface.addConstraint("customerServices", {
      fields: ["clientId", "vin", "serviceId", "policyTypeId", "policyNumber"],
      type: "unique",
      name: "unique_clientId_vin_serviceId_policyTypeId_policyNumber",
    });
  },
};
