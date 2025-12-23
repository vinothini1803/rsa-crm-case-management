import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("templateDynamicFields", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      templateId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "templates",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      displayName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      inputTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      fromTable: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      whereColumn: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      whereValueVariable: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      columnName: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      query: {
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
    await queryInterface.dropTable("templateDynamicFields");
  },
};
