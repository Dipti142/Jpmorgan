"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const PROGRAM = { tableName: "tl_persona_program", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(PROGRAM, {
      persona_program_id: {
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

      program_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      program_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      company_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      program_kind: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      kb_domain: {
        type: Sequelize.STRING(60),
        allowNull: true,
        defaultValue: null,
      },


      script: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      script_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null,
      },

      script_synced_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      is_active: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      updated_by: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },

      created_ts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addConstraint(PROGRAM, {
      fields: ["company_id", "program_key"],
      type: "unique",
      name: "uq_persona_program_company_key",
    });

    await queryInterface.addIndex(PROGRAM, ["company_id", "program_kind", "is_active"], {
      name: "idx_persona_program_company_kind",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(PROGRAM);
  },
};
