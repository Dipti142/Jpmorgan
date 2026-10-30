"use strict";


const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const SET = { tableName: "tl_custom_script_set", schema: SCHEMA };
const TEMPLATE = { tableName: "tl_custom_script_template", schema: SCHEMA };
const SCRIPT = { tableName: "tl_custom_script", schema: SCHEMA };
const CALL = { tableName: "tl_interview_call", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        SET,
        {
          custom_script_set_id: {
            type: Sequelize.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },

          // CHECKLIST | QUESTION_ANSWER | SCENARIO - lives here and nowhere else.
          question_pattern: { type: Sequelize.STRING(30), allowNull: false },

          script_name: { type: Sequelize.STRING(150), allowNull: false },

          questions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

          is_active: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          deleted_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
          updated_by: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      await queryInterface.createTable(
        TEMPLATE,
        {
          custom_script_template_id: {
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

          // The handle quoted outside this service. Generated in the service, so
          // no pgcrypto or gen_random_uuid() dependency on older Postgres.
          script_uuid: { type: Sequelize.UUID, allowNull: false },

          program_kind: { type: Sequelize.STRING(30), allowNull: false },

          template_key: { type: Sequelize.STRING(50), allowNull: false },
          template_name: { type: Sequelize.STRING(150), allowNull: false },
          template_description: { type: Sequelize.TEXT, allowNull: true, defaultValue: null },

          // The sets gathered under this heading, in speaking order. Postgres
          // cannot foreign key into an array, so the service checks the ids.
          script_set_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },

          is_active: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          updated_by: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      // Global, not per company: a uuid is quoted without a companyId beside it.
      await queryInterface.addConstraint(TEMPLATE, {
        fields: ["script_uuid"],
        type: "unique",
        name: "uq_custom_script_template_uuid",
        transaction,
      });

      await queryInterface.addConstraint(TEMPLATE, {
        fields: ["company_id", "template_key"],
        type: "unique",
        name: "uq_custom_script_template_company_key",
        transaction,
      });

      // "which headings use set 21" - asked before a set is retired.
      await queryInterface.addIndex(TEMPLATE, {
        fields: [{ name: "script_set_ids", operator: "jsonb_path_ops" }],
        name: "idx_custom_script_template_set_ids_gin",
        using: "gin",
        transaction,
      });

      await queryInterface.createTable(
        SCRIPT,
        {
          custom_script_id: {
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

          // The heading this role runs. RESTRICT, so a heading in use cannot be
          // deleted out from under a live assignment.
          custom_script_template_id: {
            type: Sequelize.BIGINT,
            allowNull: false,
            references: { model: TEMPLATE, key: "custom_script_template_id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },

          program_kind: { type: Sequelize.STRING(30), allowNull: false },
          participant_role: { type: Sequelize.STRING(20), allowNull: false },

          // What a lookup matches on. job_label is a snapshot.
          job_short_code: { type: Sequelize.STRING(50), allowNull: false },
          job_label: { type: Sequelize.STRING(150), allowNull: true, defaultValue: null },

          is_active: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          deleted_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
          updated_by: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      // One live script per job role. Partial, so the row that was replaced does
      // not collide with the row that replaced it.
      await queryInterface.addIndex(SCRIPT, {
        fields: ["company_id", "program_kind", "participant_role", "job_short_code"],
        name: "uq_custom_script_live_role",
        unique: true,
        where: { deleted_ts: null },
        transaction,
      });

      // "which roles run this heading" - asked before a heading is retired.
      await queryInterface.addIndex(SCRIPT, {
        fields: ["custom_script_template_id"],
        name: "idx_custom_script_template_id",
        transaction,
      });

      // The job a call was opened for, so a tool call mid-call resolves the same
      // script the persona was given when the session opened.
      await queryInterface.addColumn(
        CALL,
        "job_short_code",
        { type: Sequelize.STRING(50), allowNull: true, defaultValue: null },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(CALL, "job_short_code");
    await queryInterface.dropTable(SCRIPT);
    await queryInterface.dropTable(TEMPLATE);
    await queryInterface.dropTable(SET);
  },
};
