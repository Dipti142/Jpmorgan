"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const LOG = { tableName: "tl_persona_join_log", schema: SCHEMA };
const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const SESSION = { tableName: "tl_meeting_session", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        LOG,
        {
          persona_join_log_id: {
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

          events: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

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

      await queryInterface.addIndex(LOG, ["meeting_session_id"], {
        name: "uq_persona_join_log_session",
        unique: true,
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(LOG);
  },
};
