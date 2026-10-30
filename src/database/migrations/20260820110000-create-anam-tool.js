"use strict";
const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const COMPANY = { tableName: "tl_company", schema: SCHEMA };
const TABLE = { tableName: "tl_anam_tool", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      anam_tool_id: {
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
        onDelete: "CASCADE",
      },

      // Our own key, unprefixed, e.g. search_knowledge
      tool_key: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },

      // What Anam knows it as, prefixed, e.g. baystate_search_knowledge
      tool_name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },

      // webhook | client
      tool_kind: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      // The UUID handed to personaConfig.toolIds
      remote_tool_id: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },

      // Hash of the definition last sent, so provisioning skips unchanged tools
      definition_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null,
      },

      provisioned_ts: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      },

      is_active: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["company_id", "tool_key"],
      type: "unique",
      name: "uq_anam_tool_company_key",
    });

    await queryInterface.addIndex(TABLE, ["company_id", "is_active"], {
      name: "idx_anam_tool_company_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
