"use strict";


const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createSchema(SCHEMA);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropSchema(SCHEMA);
  },
};