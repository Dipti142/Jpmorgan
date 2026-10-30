"use strict";

const { Env } = require("../../config/env.config");
const { AI_RECOMMENDATION_STATUSES } = require("../../constants/aiRecommendationStatus.constants");

const STATUS = { tableName: "tl_ai_recommendation_status", schema: Env.dbPostgres.schema };

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        STATUS,
        {
          ai_recommendation_status_id: {
            type: Sequelize.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          status_code: { type: Sequelize.STRING(20), allowNull: false },
          status_label: { type: Sequelize.STRING(100), allowNull: false },
          client_status_label: { type: Sequelize.STRING(100), allowNull: false },
          display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          is_active: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          created_ts: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
          updated_ts: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
        },
        { transaction },
      );

      await queryInterface.addConstraint(STATUS, {
        fields: ["status_code"],
        type: "unique",
        name: "uq_ai_recommendation_status_code",
        transaction,
      });

      await queryInterface.bulkInsert(
        STATUS,
        AI_RECOMMENDATION_STATUSES.map((status) => ({
          ...status,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        })),
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(STATUS);
  },
};
