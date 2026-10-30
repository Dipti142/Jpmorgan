import { Op } from "sequelize";
import { IPersonaDefinition } from "../interfaces/IProgram.interface";
import AnamAvatar from "../models/anamAvatar.model";
import Company from "../models/company.model";
import PersonaProgram from "../models/personaProgram.model";
import { findProgram } from "./programRegistry.service";

/**
 * Who speaks, for whom. Shared by every programme kind, so the interview never
 * resolves a persona itself and orientation will not need to.
 *
 * The persona itself is authored in code and read from the registry - there is
 * no persona table. What comes from the database is what only the database can
 * know: which company this is and which programme row the answers hang off. The
 * questions come from tl_default_script, through scriptBuilder.service.ts.
 */

export interface IResolvedPersona {
    persona: IPersonaDefinition;
    program: PersonaProgram;
    company: Company;
}

export interface IPersonaSummary {
    key: string;
    /**
     * The job. Not a name - a persona has no name until a face is drawn for a
     * session, so there is nothing nameable to list here.
     */
    role: string;
    kind: string;
    programKey: string;
    companyId: number;
    companyName: string;
    presetStyles: string[];
    defaultPresetStyle: string | null;
    defaultExpressivity: number | null;
}

/** Active programmes for a company, each with the company it belongs to. */
const loadPrograms = async (companyId?: number, programKind?: string): Promise<PersonaProgram[]> => {
    const where: Record<string, unknown> = { is_active: 1 };
    if (companyId) where.company_id = companyId;
    if (programKind) where.program_kind = programKind;

    return PersonaProgram.findAll({
        where,
        include: [{ model: Company, as: "company", required: true, where: { is_active: 1 } }],
        order: [["persona_program_id", "ASC"]],
    });
};

/**
 * The personas authored for a programme row, in the order the file lists them.
 * A programme row with no matching manifest returns none rather than throwing -
 * a stale row should not break the whole listing.
 */
const personasOf = (program: PersonaProgram): IPersonaDefinition[] => {
    const registered = findProgram(program.program_key, program.company?.company_key);
    if (!registered) return [];

    return registered.manifest.personas
        .filter((persona) => persona.isActive !== false)
        .sort((left, right) => left.displayOrder - right.displayOrder);
};

export const listPersonas = async (
    options: { companyId?: number; programKind?: string } = {},
): Promise<IPersonaSummary[]> => {
    const programs = await loadPrograms(options.companyId, options.programKind);

    return programs.flatMap((program) =>
        personasOf(program).map((persona) => ({
            key: persona.personaKey,
            role: persona.personaRole,
            kind: program.program_kind,
            programKey: program.program_key,
            companyId: Number(program.company_id),
            companyName: program.company.company_name,
            presetStyles: persona.presetStyles,
            defaultPresetStyle: (persona.directorNotes?.presetStyle as string) ?? null,
            defaultExpressivity: (persona.directorNotes?.expressivity as number) ?? null,
        })),
    );
};

/**
 * A persona key is unique per programme, so a company must be supplied - two
 * tenants can both have an "interviewer", and picking the wrong one would run
 * the wrong script against the wrong knowledge base.
 */
export const resolvePersona = async (
    companyId: number,
    personaKey?: string,
    programKind?: string,
): Promise<IResolvedPersona> => {
    const programs = await loadPrograms(companyId, programKind);

    for (const program of programs) {
        const personas = personasOf(program);
        const persona = personaKey
            ? personas.find((candidate) => candidate.personaKey === personaKey)
            : personas[0];
        if (!persona) continue;

        return { persona, program, company: program.company };
    }

    throw new Error(
        personaKey
            ? `No active persona "${personaKey}" for company ${companyId}`
            : `No active persona for company ${companyId}. Run npm run sync:persona:dev`,
    );
};

const activeAvatarByKey = async (avatarKey: string): Promise<AnamAvatar | null> =>
    AnamAvatar.findOne({ where: { avatar_key: avatarKey, is_active: 1 } });

// The face a meeting pins in persona_id. Matched on either handle because the
// column is free text and nothing has written it yet.
export const findPinnedAvatar = async (personaId?: string | null): Promise<AnamAvatar | null> => {
    const pinned = String(personaId ?? "").trim();
    if (!pinned) return null;

    return AnamAvatar.findOne({
        where: { is_active: 1, [Op.or]: [{ avatar_key: pinned }, { avatar_id: pinned }] },
    });
};

/**
 * Which face speaks this session.
 *
 * A pinned key from the caller wins, then FIXED, then a random draw from the
 * persona's pool - or from every active avatar when the pool is empty, so a new
 * row in tl_anam_avatar joins the rotation with no other change. Voice comes off
 * the same row, so a face is never handed a voice that is not its own.
 */
export const pickAvatar = async (
    persona: IPersonaDefinition,
    requestedAvatarKey?: string,
): Promise<AnamAvatar> => {
    if (requestedAvatarKey) {
        const pinned = await activeAvatarByKey(requestedAvatarKey);
        if (!pinned) throw new Error(`No active avatar "${requestedAvatarKey}"`);
        return pinned;
    }

    if (persona.avatarSelectionMode === "FIXED" && persona.fixedAvatarKey) {
        const fixed = await activeAvatarByKey(persona.fixedAvatarKey);
        if (fixed) return fixed;
        // A deactivated fixed avatar should not end the call - fall through.
    }

    const pool = persona.avatarPool ?? [];
    const candidates = await AnamAvatar.findAll({
        where: { is_active: 1, ...(pool.length ? { avatar_key: { [Op.in]: pool } } : {}) },
        order: [["display_order", "ASC"]],
    });

    if (!candidates.length) {
        throw new Error("No active avatars - run npm run seed:avatars:dev before starting a session");
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
};
