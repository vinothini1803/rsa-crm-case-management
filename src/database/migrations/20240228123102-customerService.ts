import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("customerServices",
            {
                id: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false,
                },
                clientId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: false,
                },
                customerName: {
                    type: DataTypes.STRING(191),
                    allowNull: false,
                },
                customerContactNumber: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                },
                vin: {
                    type: DataTypes.STRING(60),
                    allowNull: false,
                },
                vehicleRegistrationNumber: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                },
                serviceId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                policyTypeId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                membershipTypeId: {
                    type: DataTypes.INTEGER.UNSIGNED,
                    allowNull: true,
                },
                totalService: {
                    type: DataTypes.INTEGER,
                    allowNull: true,
                },
                availedService: {
                    type: DataTypes.INTEGER.UNSIGNED,
                },
                availableService: {
                    type: DataTypes.INTEGER.UNSIGNED,
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
                }
            });
        await queryInterface.addConstraint("customerServices", {
            fields: ['clientId', 'vin'],
            type: "unique",
            name: "unique_clientId_vin"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("customerServices");
    }
};
