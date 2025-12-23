import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("customerServiceEntitlements",
            {
                id: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                customerServiceId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: false,
                    references: {
                        model: "customerServices",
                        key: "id",
                    },
                    onDelete: "CASCADE",
                    onUpdate: "CASCADE",
                },
                subServiceId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                subServiceHasLimit: {
                    type: DataTypes.BOOLEAN,
                    allowNull: true,
                },
                availableService: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                entitlementId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                entitlementLimit: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                entitlementUnit: {
                    type: DataTypes.STRING(20),
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
        await queryInterface.addConstraint("customerServiceEntitlements", {
            fields: ['customerServiceId', 'subServiceId'],
            type: "unique",
            name: "unique_customerServiceId_subServiceId"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("customerServiceEntitlements");
    }
};
