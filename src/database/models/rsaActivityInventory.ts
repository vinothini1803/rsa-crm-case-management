import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Activities } from "./index";

const rsaActivityInventory = sequelize.define(
  "rsaActivityInventory",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    activityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    failedPartName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    repairWork: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hubCaps: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    spareWheel: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    jackAndJackRoad: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    audioSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    reverseParkingSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    speakers: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    keyWithRemote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    aerial: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    floorMat: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    fixedOrHangingIdol: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    reachedDealershipStatus: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    vehicleAcknowledgedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobileNumberOfReceiver: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    requestDealershipSignature: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    termsAndConditions: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: 0,
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
    tableName: "rsaActivityInventories",
    indexes: [
      {
        unique: true,
        name: "rsaActivityInventory_uk",
        fields: ["activityId", "typeId"],
      },
    ],
  }
);

Activities.hasMany(rsaActivityInventory, {
  foreignKey: "activityId",
});
rsaActivityInventory.belongsTo(Activities, {
  foreignKey: "activityId",
});

export default rsaActivityInventory;
