"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const CALL = { tableName: "tl_interview_call", schema: SCHEMA };
const HISTORY = { tableName: "tl_interview_call_answer_history", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Append-only. tl_interview_call_answer says where a question ended up;
    // this says how it got there, one row per tool call.
    await queryInterface.createTable(HISTORY, {
      answer_history_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      // CASCADE: the trail has no meaning without the call it came from
      interview_call_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: CALL, key: "interview_call_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // Denormalised so a company-scoped read needs no join through the call
      company_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: COMPANY, key: "company_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      question_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      // GREETING | CHECKLIST | QUESTION_ANSWER | SCENARIO | INTERVIEW_CONCLUSION
      question_pattern: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      // Copied per row so a row reads on its own after the script is reworded
      question_text: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      expected_answer: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // ask_question | record_answer | verify_contact
      tool: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },

      // asked | answered | declined | unclear | skipped | match | mismatch | missing
      outcome: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      // What they had said by this point. Empty on the ask.
      answer: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      captured: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      score: {
        type: Sequelize.SMALLINT,
        allowNull: true,
      },

      // When ask_question put the question, repeated so one row answers "how long"
      asked_ts: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      tool_called_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      seconds_since_asked: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // The trail for one call, in the order it happened - the read this exists for
    await queryInterface.addIndex(HISTORY, ["interview_call_id", "tool_called_ts"], {
      name: "ix_call_answer_history_call_time",
    });

    // "how did every candidate handle the scenario questions" without a join
    await queryInterface.addIndex(HISTORY, ["company_id", "question_pattern"], {
      name: "ix_call_answer_history_company_pattern",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(HISTORY);
  },
};
