import { IPersonaJoinLogEntry, IPersonaJoinLogEvent } from "../../interfaces/IVirtualAvatarSession.interface";
import connection from "../../models/index";
import PersonaJoinLog from "../../models/personaJoinLog.model";

export const MAX_EVENTS_PER_SESSION = 2000;

const toEntry = (event: IPersonaJoinLogEvent, receivedTs: string): IPersonaJoinLogEntry => ({
    attempt_id: event.attemptId,
    level: event.level,
    stage: event.stage,
    message: event.message,
    details: event.detail ?? null,
    occurred_ts: event.at,
    received_ts: receivedTs,
});

export const appendEvents = async (input: {
    companyId: number;
    meetingSessionId: number;
    events: IPersonaJoinLogEvent[];
}): Promise<number> =>
    connection.transaction(async (transaction) => {
        const where = { company_id: input.companyId, meeting_session_id: input.meetingSessionId };

        await PersonaJoinLog.findOrCreate({ where, defaults: { ...where, events: [] }, transaction });
        const row = await PersonaJoinLog.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw new Error("Persona join log row not found after it was created");

        const receivedTs = new Date().toISOString();
        const room = Math.max(0, MAX_EVENTS_PER_SESSION - row.events.length);
        const added = input.events.slice(0, room).map((event) => toEntry(event, receivedTs));

        if (added.length === 0) return 0;

        row.set("events", [...row.events, ...added]);
        await row.save({ transaction });

        return added.length;
    });
