"use strict";

const { Env } = require("../../config/env.config");
const { VA_MEETING_STATUSES } = require("../../constants/vaMeetingStatus.constants");

const SCHEMA = Env.dbPostgres.schema;

const STATUS = { tableName: "tl_va_meeting_status", schema: SCHEMA };
const SCHEDULED = { tableName: "tl_va_scheduled", schema: SCHEMA };

const CHECK = "ck_va_scheduled_status";
const FOREIGN_KEY = "fk_va_scheduled_status";
const PREVIOUS_STATUSES = ["UNASSIGNED", "SCHEDULED", "ONGOING", "COMPLETED", "MISSED", "CANCELLED"];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        STATUS,
        {
          va_meeting_status_id: {
            type: Sequelize.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          status_code: { type: Sequelize.STRING(20), allowNull: false },
          status_label: { type: Sequelize.STRING(100), allowNull: false },
          client_status_label: { type: Sequelize.STRING(100), allowNull: false },
          meeting_status_code: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
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
        name: "uq_va_meeting_status_code",
        transaction,
      });

      await queryInterface.bulkInsert(
        STATUS,
        VA_MEETING_STATUSES.map((status) => ({
          ...status,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        })),
        { transaction },
      );

      await queryInterface.removeConstraint(SCHEDULED, CHECK, { transaction });

      await queryInterface.addConstraint(SCHEDULED, {
        fields: ["meeting_status"],
        type: "foreign key",
        name: FOREIGN_KEY,
        references: { table: STATUS, field: "status_code" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeConstraint(SCHEDULED, FOREIGN_KEY, { transaction });

      await queryInterface.addConstraint(SCHEDULED, {
        fields: ["meeting_status"],
        type: "check",
        name: CHECK,
        where: { meeting_status: PREVIOUS_STATUSES },
        transaction,
      });

      await queryInterface.dropTable(STATUS, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
