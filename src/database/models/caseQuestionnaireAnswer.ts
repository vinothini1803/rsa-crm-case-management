import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseDetails } from "./index";

const caseQuestionnaireAnswer = sequelize.define(
  "caseQuestionnaireAnswer",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    questionnaireId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    answer: {
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
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships
CaseDetails.hasMany(caseQuestionnaireAnswer, {
  as: "questionnaireAnswers",
  foreignKey: "caseId",
});

caseQuestionnaireAnswer.belongsTo(CaseDetails, {
  as: "caseDetail",
  foreignKey: "caseId",
});

export default caseQuestionnaireAnswer;

