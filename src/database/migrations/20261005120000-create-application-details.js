"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const APPLICATION = { tableName: "tl_application_details", schema: SCHEMA };
const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };
const CANDIDATE = { tableName: "tl_candidates", schema: SCHEMA };
const RECORDING = { tableName: "tl_meeting_recording", schema: SCHEMA };
const STATUS = { tableName: "tl_va_meeting_status", schema: SCHEMA };
const AI_RECOMMENDATION = { tableName: "tl_ai_recommendation_status", schema: SCHEMA };
const COMPANY = { tableName: "tl_company", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        APPLICATION,
        {
          application_details_id: {
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

          application_uuid: { type: Sequelize.UUID, allowNull: false },

          application_status: {
            type: Sequelize.STRING(20),
            allowNull: false,
            references: { model: STATUS, key: "status_code" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          application_status_label: { type: Sequelize.STRING(100), allowNull: false },

          candidate_id: {
            type: Sequelize.STRING(100),
            allowNull: true,
            defaultValue: null,
            references: { model: CANDIDATE, key: "candidate_id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          candidate_name: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },

          job_short_code: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },
          job_role_label: { type: Sequelize.STRING(200), allowNull: true, defaultValue: null },
          job_location: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },

          interviewer: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "AI" },

          application_received_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
          interview_scheduled_ts: { type: Sequelize.DATE, allowNull: false },

          candidate_email_id: { type: Sequelize.STRING(255), allowNull: true, defaultValue: null },
          candidate_phone_number: { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },

          reviewer_notes: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

          overridden_application_status: {
            type: Sequelize.STRING(20),
            allowNull: true,
            defaultValue: null,
            references: { model: STATUS, key: "status_code" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          escalated_for_staff: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

          application_recording_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            defaultValue: null,
            references: { model: RECORDING, key: "meeting_recording_id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },

          updated_user_id: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },

          status: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },

          ai_recommendation: {
            type: Sequelize.STRING(20),
            allowNull: true,
            defaultValue: null,
            references: { model: AI_RECOMMENDATION, key: "status_code" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          meeting_session_id: {
            type: Sequelize.BIGINT,
            allowNull: false,
            references: { model: SESSION, key: "meeting_session_id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },

          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
          deleted_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      await queryInterface.addConstraint(APPLICATION, {
        fields: ["application_uuid"],
        type: "unique",
        name: "uq_application_details_uuid",
        transaction,
      });

      await queryInterface.addIndex(APPLICATION, ["meeting_session_id"], {
        name: "uq_application_details_meeting_live",
        unique: true,
        where: { deleted_ts: null },
        transaction,
      });

      await queryInterface.addIndex(
        APPLICATION,
        ["company_id", "application_status", "interview_scheduled_ts"],
        { name: "idx_application_details_company_status", transaction },
      );

      await queryInterface.addIndex(APPLICATION, ["candidate_id"], {
        name: "idx_application_details_candidate",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(APPLICATION);
  },
};
