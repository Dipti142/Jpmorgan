"use strict";


const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const DEFAULT_SCRIPT = { tableName: "tl_default_script", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(DEFAULT_SCRIPT, {
      default_script_id: {
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

      program_kind: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      question_pattern: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      participant_role: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      script_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      script_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      script_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      script_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      questions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
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

    await queryInterface.addConstraint(DEFAULT_SCRIPT, {
      fields: ["company_id", "program_kind", "participant_role", "script_type", "script_key"],
      type: "unique",
      name: "uq_default_script_company_kind_role_type_key",
    });

    // Covers the only read the runtime makes: every active set for one kind and role.
    await queryInterface.addIndex(
      DEFAULT_SCRIPT,
      ["company_id", "program_kind", "participant_role", "script_type", "is_active"],
      { name: "idx_default_script_company_kind_role" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(DEFAULT_SCRIPT);
  },
};
