"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };
const RECORDING = { tableName: "tl_meeting_recording", schema: SCHEMA };

const STATUSES = ["STARTED", "STOPPED", "FILE_READY", "STORED", "FAILED"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(RECORDING, {
      meeting_recording_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      meeting_session_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: SESSION, key: "meeting_session_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      company_id: { type: Sequelize.BIGINT, allowNull: false },

      acs_recording_id: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "STARTED" },

      // Filled in by the Event Grid callback, not at start. content_location is
      // short-lived and only readable through the Call Automation client.
      content_location: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
      metadata_location: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
      delete_location: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      storage_kind: { type: Sequelize.STRING(10), allowNull: true, defaultValue: null },
      storage_path: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
      file_name: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },
      size_bytes: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      duration_seconds: { type: Sequelize.INTEGER, allowNull: true, defaultValue: null },

      event_payload: { type: Sequelize.JSONB, allowNull: true, defaultValue: null },

      started_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      stopped_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      stored_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      failure_reason: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
      deleted_at: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
    });

    await queryInterface.addConstraint(RECORDING, {
      fields: ["status"],
      type: "check",
      name: "ck_meeting_recording_status",
      where: { status: STATUSES },
    });

    await queryInterface.addIndex(RECORDING, ["meeting_session_id"], {
      name: "idx_meeting_recording_session",
    });

    // The Event Grid callback finds a row by the recording id in the subject.
    await queryInterface.addIndex(RECORDING, ["acs_recording_id"], {
      name: "idx_meeting_recording_acs_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(RECORDING);
  },
};
