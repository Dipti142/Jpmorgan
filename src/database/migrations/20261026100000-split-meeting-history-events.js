"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const HISTORY = { tableName: "tl_meeting_history", schema: SCHEMA };
const EVENT = { tableName: "tl_meeting_history_event", schema: SCHEMA };
const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };

const REMOVED_COLUMNS = [
  "events",
  "errors",
  "event_count",
  "failure_count",
  "dropped_count",
  "failed_tracks",
  "first_failure_ts",
  "last_event_ts",
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        EVENT,
        {
          meeting_history_event_id: {
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

          occurred_ts: { type: Sequelize.DATE, allowNull: false },
          track: { type: Sequelize.STRING(40), allowNull: false },
          provider: { type: Sequelize.STRING(20), allowNull: false },
          event_type: { type: Sequelize.STRING(120), allowNull: false },
          outcome: { type: Sequelize.STRING(20), allowNull: false },
          from_status: { type: Sequelize.STRING(40), allowNull: true },
          to_status: { type: Sequelize.STRING(40), allowNull: true },
          actor_type: { type: Sequelize.STRING(20), allowNull: true },
          actor_id: { type: Sequelize.BIGINT, allowNull: true },
          message: { type: Sequelize.TEXT, allowNull: false },
          note: { type: Sequelize.TEXT, allowNull: true },
          error_code: { type: Sequelize.STRING(80), allowNull: true },
          error_message: { type: Sequelize.TEXT, allowNull: true },
          details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex(EVENT, ["meeting_session_id", "meeting_history_event_id"], {
        name: "idx_meeting_history_event_session_order",
        transaction,
      });

      await queryInterface.addIndex(EVENT, ["company_id", "outcome", "occurred_ts"], {
        name: "idx_meeting_history_event_company_outcome",
        transaction,
      });

      await queryInterface.addIndex(EVENT, ["company_id", "provider", "occurred_ts"], {
        name: "idx_meeting_history_event_company_provider",
        transaction,
      });

      await queryInterface.removeIndex(HISTORY, "idx_meeting_history_company_last_event", { transaction });
      await queryInterface.removeIndex(HISTORY, "idx_meeting_history_company_failures", { transaction });

      for (const column of REMOVED_COLUMNS) {
        await queryInterface.removeColumn(HISTORY, column, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const restored = {
        events: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        errors: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        event_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        failure_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        dropped_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        failed_tracks: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
        first_failure_ts: { type: Sequelize.DATE, allowNull: true },
        last_event_ts: { type: Sequelize.DATE, allowNull: true },
      };

      for (const [column, definition] of Object.entries(restored)) {
        await queryInterface.addColumn(HISTORY, column, definition, { transaction });
      }

      await queryInterface.addIndex(HISTORY, ["company_id", "last_event_ts"], {
        name: "idx_meeting_history_company_last_event",
        transaction,
      });
      await queryInterface.addIndex(HISTORY, ["company_id", "failure_count"], {
        name: "idx_meeting_history_company_failures",
        transaction,
      });

      await queryInterface.dropTable(EVENT, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
