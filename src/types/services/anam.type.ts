import AnamAvatar from "../../models/anamAvatar.model";
import Company from "../../models/company.model";
import { IPersonaDefinition } from "../../interfaces/IProgram.interface";

export interface IMintSessionInput {
    company: Company;
    persona: IPersonaDefinition;
    avatar: AnamAvatar;
    systemPrompt: string;
    toolKeys: string[];
}
