import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("templateSendToDetails", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      typeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      roleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      fromTable: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      fromWhereColumn: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      fromWhereValueVariable: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      fromColumnName: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      hasMapping: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      mappingService: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      mappingQuery: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deletedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("templateSendToDetails");
  },
};
