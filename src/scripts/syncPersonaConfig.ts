import "reflect-metadata";
import { Op } from "sequelize";
import { GUARDRAILS, TONE } from "../constants/prompt.rules";
import { PROGRAMS } from "../services/programRegistry.service";
import { IProgramManifest } from "../interfaces/IProgram.interface";
import connection from "../models";
import AnamAvatar from "../models/anamAvatar.model";
import Company from "../models/company.model";
import PersonaProgram from "../models/personaProgram.model";

const stamp = (message: string) => console.log(`  ${message}`);

const syncProgram = async (manifest: IProgramManifest) => {
    const company = await Company.findOne({ where: { company_key: manifest.companyKey } });
    if (!company) {
        throw new Error(
            `No company "${manifest.companyKey}" in tl_company. Add it to the companies seeder and ` +
                `run npm run seed:dev before syncing "${manifest.programKey}".`,
        );
    }

    const [program] = await PersonaProgram.findOrCreate({
        where: { company_id: company.company_id, program_key: manifest.programKey },
        defaults: {
            company_id: company.company_id,
            program_key: manifest.programKey,
            program_name: manifest.programName,
            company_name: company.company_name,
            program_kind: manifest.programKind,
            kb_domain: manifest.kbDomain,
            is_active: 1,
        },
    });

    program.set({
        program_name: manifest.programName,
        company_name: company.company_name,
        program_kind: manifest.programKind,
        kb_domain: manifest.kbDomain,
        is_active: 1,
    });
    await program.save();
    stamp(`programme ${company.company_key}/${manifest.programKey} -> id ${program.persona_program_id}`);

    for (const definition of manifest.personas) {
        if (definition.isActive === false) {
            stamp(`persona ${definition.personaKey} is inactive, skipped`);
            continue;
        }

        const keys = [...definition.avatarPool];
        if (definition.avatarSelectionMode === "FIXED") {
            if (!definition.fixedAvatarKey) {
                throw new Error(
                    `Persona "${definition.personaKey}" is FIXED but has no fixedAvatarKey, ` +
                        `so it would fall through to a random face.`,
                );
            }
            keys.push(definition.fixedAvatarKey);
        }

        if (keys.length) {
            const found = await AnamAvatar.findAll({
                where: { avatar_key: { [Op.in]: keys }, is_active: 1 },
            });
            const missing = keys.filter(
                (key) => !found.some((avatar) => avatar.avatar_key === key),
            );
            if (missing.length) {
                throw new Error(
                    `Persona "${definition.personaKey}" names avatar(s) that are not active rows ` +
                        `in tl_anam_avatar: ${missing.join(", ")}`,
                );
            }
        }

        const faces = definition.avatarPool.length
            ? definition.avatarPool.join(", ")
            : "any active avatar";
        stamp(`persona ${definition.personaKey} (${definition.personaRole}) -> ${faces}`);
    }
};

const main = async () => {
    console.log(`Syncing ${PROGRAMS.length} programme(s) from src/constants/*/*.script.ts`);
    console.log(`The script is stored as one column; personas are checked and read from the file.`);
    console.log(`Shared Tone and Guardrails: ${TONE.length + GUARDRAILS.length} characters, applied at session time.\n`);

    await connection.authenticate();

    for (const entry of PROGRAMS) {
        console.log(`${entry.manifest.programName}:`);
        await syncProgram(entry.manifest);
        console.log("");
    }

    console.log("Done. Run npm run provision:anam:dev if the tool set changed.");
    await connection.close();
};

void main().catch(async (error) => {
    console.error("\nSync failed:", error instanceof Error ? error.message : error);
    await connection.close().catch(() => undefined);
    process.exit(1);
});
