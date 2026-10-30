"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = { tableName: "tl_company", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      company_id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        allowNull: false,
      },

      company_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      company_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      tool_prefix: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      kb_folder: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      timezone: {
        type: Sequelize.STRING(60),
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["company_key"],
      type: "unique",
      name: "uq_company_key",
    });

    await queryInterface.addIndex(TABLE, ["is_active"], {
      name: "idx_company_is_active",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
