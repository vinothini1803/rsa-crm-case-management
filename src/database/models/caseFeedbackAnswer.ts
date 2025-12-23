import { DataTypes } from "sequelize";
import sequelize from "../connection";
import CaseFeedback from "./caseFeedback";

const caseFeedbackAnswer = sequelize.define(
  "caseFeedbackAnswer",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseFeedbackId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    feedbackQuestionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: "References feedback_questions.id in master service",
    },
    answerText: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Stores all answer values including ratings (as strings), text answers, option values, and conditional text",
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
    tableName: "caseFeedbackAnswers",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships
CaseFeedback.hasMany(caseFeedbackAnswer, {
  as: "answers",
  foreignKey: "caseFeedbackId",
});

caseFeedbackAnswer.belongsTo(CaseFeedback, {
  as: "caseFeedback",
  foreignKey: "caseFeedbackId",
});

export default caseFeedbackAnswer;

