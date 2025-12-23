import Sequelize from 'sequelize';
import sequelize from "../connection";

const notes = sequelize.define(
    "notes",
    {
        id: {
            type: Sequelize.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: true,
        },
        status: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
        },
        createdAt: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        updatedAt: {
            type: Sequelize.DATE,
            allowNull: true,
        },
    },
    {
        collate: "utf8mb4_general_ci",
        timestamps: true,
    }
);

export default notes;
