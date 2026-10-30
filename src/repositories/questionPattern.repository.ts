import { Transaction } from "sequelize";
import { DefaultScriptPattern } from "../interfaces/IProgram.interface";
import QuestionPattern from "../models/questionPattern.model";

export const listPatterns = async (): Promise<QuestionPattern[]> =>
    QuestionPattern.findAll({
        where: { is_active: 1 },
        order: [["display_order", "ASC"]],
    });

export const findPatternByCode = async (
    code: DefaultScriptPattern,
    transaction?: Transaction,
): Promise<QuestionPattern | null> =>
    QuestionPattern.findOne({ where: { pattern_code: code, is_active: 1 }, transaction });
