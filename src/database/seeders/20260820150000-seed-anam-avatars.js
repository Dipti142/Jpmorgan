"use strict";
const { Env } = require("../../config/env.config");

const SCHEMA = Env.dbPostgres.schema;
const TABLE = { tableName: "tl_anam_avatar", schema: SCHEMA };

const AVATARS = [
  {
    avatar_key: "aura",
    display_name: "Aura",
    avatar_id: "bb4f5306-ffdb-4437-a837-da6fdc23cbff",
    avatar_model: "cara-4",
    voice_id: "d338ed86-05e6-4ca0-a3fc-3d438ddb1a96",
    presentation: "female",
    locale: "en-US",
    llm_id: "058aba1a-b097-4beb-abc8-51c74835f5e8",
    display_order: 1,
  },

  {
    avatar_key: "asmir",
    display_name: "Asmir",
    avatar_id: "195d733e-58a9-40bb-a049-ac344fa70b7f",
    avatar_model: "cara-4",
    voice_id: "90313ddc-4fc0-11f1-84b0-52bacf74fa75",
    presentation: "female",
    locale: "en-US",
    llm_id: "058aba1a-b097-4beb-abc8-51c74835f5e8",
    display_order: 2,
  },

  {
    avatar_key: "kevin",
    display_name: "Kevin",
    avatar_id: "ccf00c0e-7302-455b-ace2-057e0cf58127",
    avatar_model: "cara-4",
    voice_id: "a6cc50fd-7077-415d-aab8-5b40c8df38b6",
    presentation: "male",
    locale: "en-US",
    llm_id: "058aba1a-b097-4beb-abc8-51c74835f5e8",
    display_order: 3,
  },

  {
    avatar_key: "astra",
    display_name: "Astra",
    avatar_id: "960f614f-ea88-47c3-9883-f02094f70874",
    avatar_model: "cara-4",
    voice_id: "d338ed86-05e6-4ca0-a3fc-3d438ddb1a96",
    presentation: "female",
    locale: "en-US",
    llm_id: "058aba1a-b097-4beb-abc8-51c74835f5e8",
    display_order: 4,
  },

  {
    avatar_key: "selin",
    display_name: "Selin",
    avatar_id: "2f596519-d7c2-48ad-b501-934f641e8400",
    avatar_model: "cara-4",
    voice_id: "bb33f54a-cac6-4cde-bfcf-9cd9084d1f01",
    presentation: "female",
    locale: "en-US",
    llm_id: "058aba1a-b097-4beb-abc8-51c74835f5e8",
    display_order: 5,
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const usable = AVATARS.filter((avatar) => avatar.avatar_id && avatar.voice_id);
    const skipped = AVATARS.filter((avatar) => !avatar.avatar_id || !avatar.voice_id);

    for (const avatar of skipped) {
      console.log(`  Skipped "${avatar.avatar_key}": avatar_id and voice_id are both required.`);
    }

    if (!usable.length) {
      console.log("  No avatars seeded. Fill in avatar_id and voice_id in the AVATARS list, then re-run.");
      return;
    }

    for (const avatar of usable) {
      const existing = await queryInterface.rawSelect(
        TABLE,
        { where: { avatar_key: avatar.avatar_key } },
        ["anam_avatar_id"],
      );
      if (existing) {
        console.log(`  "${avatar.avatar_key}" already present, left alone.`);
        continue;
      }

      await queryInterface.bulkInsert(TABLE, [
        {
          ...avatar,
          is_active: 1,
          created_ts: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      ]);
      console.log(`  + ${avatar.avatar_key} (${avatar.display_name})`);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(TABLE, {
      avatar_key: AVATARS.map((avatar) => avatar.avatar_key),
    });
  },
};
