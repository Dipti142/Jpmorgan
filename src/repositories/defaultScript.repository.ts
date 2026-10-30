import { DefaultScriptRole, DefaultScriptType, ProgramKind } from "../interfaces/IProgram.interface";
import DefaultScript from "../models/defaultScript.model";
import QuestionPattern from "../models/questionPattern.model";

export interface IDefaultScriptQuery {
    companyId: number;
    programKind: ProgramKind;
    participantRole: DefaultScriptRole;
    scriptType: DefaultScriptType;
}

export const listScripts = async (query: IDefaultScriptQuery): Promise<DefaultScript[]> =>
    DefaultScript.findAll({
        where: {
            company_id: query.companyId,
            program_kind: query.programKind,
            participant_role: query.participantRole,
            script_type: query.scriptType,
            is_active: 1,
        },
        // The builder reads the pattern's kind and rating default off this row.
        include: [{ model: QuestionPattern, as: "pattern" }],
        order: [
            ["script_order", "ASC"],
            ["default_script_id", "ASC"],
        ],
    });
