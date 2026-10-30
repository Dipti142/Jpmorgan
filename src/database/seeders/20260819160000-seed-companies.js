"use strict";

const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = { tableName: "tl_company", schema: SCHEMA };

const COMPANIES = [
  {
    company_id: 7,
    company_key: "baystate",
    company_name: "Baystate Interpreters",
    tool_prefix: "baystate_",
    kb_folder: "baystate",
    timezone: "America/New_York",
  },
  {
    company_id: 16,
    company_key: "development test company",
    company_name: "Development Test company",
    tool_prefix: "totla_",
    kb_folder: "totla",
    timezone: "America/Los_Angeles",
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const company of COMPANIES) {
      const existing = await queryInterface.rawSelect(
        TABLE,
        { where: { company_id: company.company_id } },
        ["company_id"],
      );
      if (existing) continue;

      await queryInterface.bulkInsert(TABLE, [
        {
          ...company,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, {
      company_id: COMPANIES.map((company) => company.company_id),
    });
  },
};
