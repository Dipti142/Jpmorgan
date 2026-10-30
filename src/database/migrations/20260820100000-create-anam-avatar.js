"use strict";
const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;

const AVATAR = { tableName: "tl_anam_avatar", schema: SCHEMA };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(AVATAR, {
      anam_avatar_id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      avatar_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      display_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      // Anam's own ids, from the Lab
      avatar_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      avatar_model: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      voice_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      presentation: {
        type: Sequelize.STRING(30),
        allowNull: true,
        defaultValue: null,
      },

      locale: {
        type: Sequelize.STRING(20),
        allowNull: true,
        defaultValue: null,
      },

      llm_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null,
      },

      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addConstraint(AVATAR, {
      fields: ["avatar_key"],
      type: "unique",
      name: "uq_anam_avatar_key",
    });

    await queryInterface.addIndex(AVATAR, ["is_active", "display_order"], {
      name: "idx_anam_avatar_active_order",
    });


  },

  async down(queryInterface) {
    await queryInterface.dropTable(AVATAR);
  },
};
