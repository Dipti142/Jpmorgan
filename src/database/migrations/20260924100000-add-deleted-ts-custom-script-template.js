"use strict";

// tl_custom_script and tl_custom_script_set both track deleted_ts on retirement -
// the heading table never got the same column.

const { Env } = require("../../config/env.config");

const TEMPLATE = { tableName: "tl_custom_script_template", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TEMPLATE, "deleted_ts", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(TEMPLATE, "deleted_ts");
  },
};
