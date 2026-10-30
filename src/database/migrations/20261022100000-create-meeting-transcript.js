"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const TRANSCRIPT = { tableName: "tl_meeting_transcript", schema: SCHEMA };
const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };
const PARTICIPANT = { tableName: "tl_meeting_participants", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        TRANSCRIPT,
        {
          meeting_transcript_id: {
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

          meeting_participant_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: { model: PARTICIPANT, key: "meeting_participant_id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },

          speaker_name: { type: Sequelize.STRING(150), allowNull: false },
          language: { type: Sequelize.STRING(10), allowNull: false },
          text: { type: Sequelize.TEXT, allowNull: false },
          translations: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },

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

      await queryInterface.addIndex(TRANSCRIPT, ["meeting_session_id"], {
        name: "idx_meeting_transcript_session",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TRANSCRIPT);
  },
};
