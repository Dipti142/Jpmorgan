"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };
const AVATAR = { tableName: "tl_anam_avatar", schema: SCHEMA };
const TEMPLATE = { tableName: "tl_custom_script_template", schema: SCHEMA };
const SCHEDULED = { tableName: "tl_va_scheduled", schema: SCHEMA };
const BLOCK = { tableName: "tl_va_calendar_block", schema: SCHEMA };

const STATUSES = ["UNASSIGNED", "SCHEDULED", "ONGOING", "COMPLETED", "MISSED", "CANCELLED"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(SCHEDULED, {
      va_scheduled_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      company_id: { type: Sequelize.BIGINT, allowNull: false },

      meeting_session_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: SESSION, key: "meeting_session_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      ics_uid: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
      workable_event_id: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      candidate_id: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
      job_short_code: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },

      anam_avatar_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: AVATAR, key: "anam_avatar_id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      persona_name: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },

      custom_script_template_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: TEMPLATE, key: "custom_script_template_id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      topic: { type: Sequelize.STRING(150), allowNull: true, defaultValue: null },

      schedule_date: { type: Sequelize.DATEONLY, allowNull: false },
      start_time: { type: Sequelize.DATE, allowNull: false },
      end_time: { type: Sequelize.DATE, allowNull: false },
      occupancy_start: { type: Sequelize.DATE, allowNull: false },
      occupancy_end: { type: Sequelize.DATE, allowNull: false },

      meeting_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "SCHEDULED" },
      reschedule_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      started_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      completed_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      cancelled_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      cancel_reason: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
    });

    await queryInterface.addConstraint(SCHEDULED, {
      fields: ["meeting_status"],
      type: "check",
      name: "ck_va_scheduled_status",
      where: { meeting_status: STATUSES },
    });

    await queryInterface.addConstraint(SCHEDULED, {
      fields: ["meeting_session_id"],
      type: "unique",
      name: "uq_va_scheduled_meeting_session",
    });

    await queryInterface.addIndex(SCHEDULED, ["meeting_status", "occupancy_start", "occupancy_end"], {
      name: "idx_va_scheduled_occupancy",
    });

    await queryInterface.createTable(BLOCK, {
      va_calendar_block_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      block_date: { type: Sequelize.DATEONLY, allowNull: false },
      start_ts: { type: Sequelize.DATE, allowNull: false },
      end_ts: { type: Sequelize.DATE, allowNull: false },
      graph_event_id: { type: Sequelize.TEXT, allowNull: false },
      synced_ts: { type: Sequelize.DATE, allowNull: false },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint(BLOCK, {
      fields: ["block_date", "start_ts", "end_ts"],
      type: "unique",
      name: "uq_va_calendar_block_window",
    });

    await queryInterface.addIndex(BLOCK, ["end_ts"], {
      name: "idx_va_calendar_block_end",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(BLOCK);
    await queryInterface.dropTable(SCHEDULED);
  },
};
