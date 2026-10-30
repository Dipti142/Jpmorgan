"use strict";

const { Op } = require("sequelize");
const { Env } = require("../../config/env.config");

const TABLE = { tableName: "tl_interview_call", schema: Env.dbPostgres.schema };

const MEETING_PROVIDERS = ["teams", "zoom", "meet"];
const MEETING_STATUSES = ["pending", "active", "cancelled", "ended", "failed"];

const INDEXES = [
  { name: "idx_interview_call_meeting_invite", fields: ["meeting_invite_id"] },
  { name: "idx_interview_call_session", fields: ["anam_session_id"] },
];

const droppedColumns = (Sequelize) => ({
  job_id: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
  kb_sources_used: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
  meeting_provider: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
  meeting_url: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },
  meeting_invite_id: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
  meeting_status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
  meeting_join_state: { type: Sequelize.STRING(30), allowNull: true, defaultValue: null },
  anam_session_id: { type: Sequelize.STRING(100), allowNull: true, defaultValue: null },
  scheduled_for_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
  consent_version: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
  consent_accepted_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
  recording_requested: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  retention_expires_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
  pii_redacted_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
  updated_by: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeConstraint(TABLE, "ck_interview_call_meeting_provider", { transaction });
      await queryInterface.removeConstraint(TABLE, "ck_interview_call_meeting_status", { transaction });

      for (const index of INDEXES) {
        await queryInterface.removeIndex(TABLE, index.name, { transaction });
      }

      for (const column of Object.keys(droppedColumns(Sequelize))) {
        await queryInterface.removeColumn(TABLE, column, { transaction });
      }

      await queryInterface.addColumn(
        TABLE,
        "room_initiated_ts",
        { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn(TABLE, "room_initiated_ts", { transaction });

      for (const [column, definition] of Object.entries(droppedColumns(Sequelize))) {
        await queryInterface.addColumn(TABLE, column, definition, { transaction });
      }

      for (const index of INDEXES) {
        await queryInterface.addIndex(TABLE, index.fields, { name: index.name, transaction });
      }

      await queryInterface.addConstraint(TABLE, {
        fields: ["meeting_provider"],
        type: "check",
        name: "ck_interview_call_meeting_provider",
        where: { [Op.or]: [{ meeting_provider: null }, { meeting_provider: MEETING_PROVIDERS }] },
        transaction,
      });

      await queryInterface.addConstraint(TABLE, {
        fields: ["meeting_status"],
        type: "check",
        name: "ck_interview_call_meeting_status",
        where: { [Op.or]: [{ meeting_status: null }, { meeting_status: MEETING_STATUSES }] },
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
