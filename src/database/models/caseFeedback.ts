import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from "./index";

const caseFeedback = sequelize.define(
  "caseFeedback",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseDetailId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    languageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "References languages table in master service",
    },
    callStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "References config.id for call status in master service",
    },
    customerFeedback: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Stores the selected customer feedback option value (e.g., 'Satisfied', 'Not satisfied') - stored as reference for quick access",
    },
    notConnectedReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Stores the selected not connected reason option value (e.g., 'RNR (Ringing No Response)', 'Switch Off') - stored as reference for quick access",
    },
    comments: {
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "caseFeedbacks",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships
CaseDetails.hasMany(caseFeedback, {
  as: "feedbacks",
  foreignKey: "caseDetailId",
});

caseFeedback.belongsTo(CaseDetails, {
  as: "caseDetail",
  foreignKey: "caseDetailId",
});

export default caseFeedback;

