"use strict";

// created_by was missing from all three tables - only updated_by was tracked at creation.

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const SET = { tableName: "tl_custom_script_set", schema: SCHEMA };
const TEMPLATE = { tableName: "tl_custom_script_template", schema: SCHEMA };
const SCRIPT = { tableName: "tl_custom_script", schema: SCHEMA };

const TABLES = [SET, TEMPLATE, SCRIPT];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, "created_by", {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      await queryInterface.removeColumn(table, "created_by");
    }
  },
};
