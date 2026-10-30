"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const HISTORY = { tableName: "tl_meeting_history", schema: SCHEMA };
const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };
const CALL = { tableName: "tl_interview_call", schema: SCHEMA };

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        HISTORY,
        {
          meeting_history_id: {
            type: Sequelize.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },

          company_id: {
            type: Sequelize.BIGINT,
            allowNull: false,
            references: { model: COMPANY, key: "company_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          meeting_session_id: {
            type: Sequelize.BIGINT,
            allowNull: false,
            references: { model: SESSION, key: "meeting_session_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          interview_call_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: { model: CALL, key: "interview_call_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          event_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          failure_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          dropped_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          failed_tracks: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          first_failure_ts: { type: Sequelize.DATE, allowNull: true },
          last_event_ts: { type: Sequelize.DATE, allowNull: true },
          final_status: { type: Sequelize.STRING(40), allowNull: true },

          events: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          errors: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex(HISTORY, ["meeting_session_id"], {
        name: "uq_meeting_history_session",
        unique: true,
        transaction,
      });

      await queryInterface.addIndex(HISTORY, ["company_id", "last_event_ts"], {
        name: "idx_meeting_history_company_last_event",
        transaction,
      });

      await queryInterface.addIndex(HISTORY, ["company_id", "failure_count"], {
        name: "idx_meeting_history_company_failures",
        transaction,
      });

      await queryInterface.addIndex(HISTORY, ["interview_call_id"], {
        name: "idx_meeting_history_call",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(HISTORY);
  },
};
