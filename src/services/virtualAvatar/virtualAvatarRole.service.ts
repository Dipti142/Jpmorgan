import { Env } from "../../config/env.config";
import { VirtualAvatarAcsRole, VirtualAvatarParticipantRole } from "../../interfaces/IVirtualAvatarSession.interface";

/**
 * Who someone is, decided from their email address alone.
 *
 * The link a person receives already carries their role, so this runs once when
 * the invite is created and the answer is stored on the participant row. Nothing
 * re-derives it at join time, and nothing takes it from a request.
 */

/**
 * Anchored at the end and escaped, so baystateinterpreters.com.evil.net and
 * notbaystateinterpreters.com both fail.
 */
const organiserDomain = (): RegExp =>
    new RegExp(`@${Env.virtualAvatar.VA_ORGANISER_EMAIL_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

export const resolveRole = (email: string): VirtualAvatarParticipantRole => {
    const address = email.trim().toLowerCase();

    // The exception is checked first: agent@ is inside the organiser domain and
    // would otherwise match it.
    if (Env.virtualAvatar.VA_AGENT_EMAILS.includes(address)) return "AGENT";
    if (organiserDomain().test(address)) return "ORGANISER";
    return "GUEST";
};

/** Only an agent waits. Gating organisers would deadlock a room with no one to open it. */
export const entersLobby = (role: VirtualAvatarParticipantRole): boolean => role === "AGENT";

export const acsRoleFor = (role: VirtualAvatarParticipantRole): VirtualAvatarAcsRole =>
    role === "ORGANISER" ? "Presenter" : "Attendee";
