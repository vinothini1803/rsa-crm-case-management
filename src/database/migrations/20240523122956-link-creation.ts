import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("links", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      entityTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      entityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      mobileNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      token: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expiryDateTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addConstraint("links", {
      fields: ["token"],
      type: "unique",
      name: "links_token_unique",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("links");
  },
};
