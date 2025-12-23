import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("reportColumns", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      columnName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      fromTable: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      fromColumn: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      mapping: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      targetTable: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      targetColumn: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      fieldType: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("reportColumns");
  },
};
