import "reflect-metadata";
import { Env } from "../config/env.config";
import { IAnamMeetingInviteRequest } from "../interfaces/IAnamMeeting.interface";
import { IAnamPersonaConfig } from "../interfaces/IAnamPersona.interface";
import { cancelMeetingInvite, createMeetingInvite } from "../services/anam.service";
import connection from "../models";
import AnamAvatar from "../models/anamAvatar.model";

/**
 * Finds out which optional fields Anam's meeting invite actually accepts.
 *
 * Anam's docs disagree with themselves: directorNotes and sessionOptions.videoQuality
 * are documented for session tokens but absent from the create-meeting-invite
 * schema. Rather than guess whether they take effect in a meeting, this asks the
 * API - it either accepts the field or returns a validation summary naming it.
 *
 *   npm run probe:meeting:dev -- --url="https://teams.microsoft.com/l/meetup-join/..."
 *
 * Each probe is scheduled well out and cancelled immediately, so nothing ever
 * joins the call. Needs a real Teams, Zoom or Meet URL: an invalid one fails on
 * the URL before Anam looks at anything else, which tells us nothing.
 */

const argOf = (name: string): string | undefined =>
    process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=").replace(/^"|"$/g, "");

/**
 * Six days out, not minutes.
 *
 * Every probe is cancelled straight after it is created, but DELETE on an invite
 * is unverified - if it turns out to be the wrong verb, a short window would put
 * six personas into a live call. Six days means a failed cancel dials into a
 * meeting that is long over instead. Anam's ceiling is seven days.
 */
const joinAt = () => new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();

/** Each probe is one extra field bolted onto a request that is known to work. */
const PROBES: Array<{ name: string; patch: Record<string, unknown> }> = [
    { name: "baseline (no extras)", patch: {} },
    {
        name: "personaConfig.directorNotes",
        patch: { __persona: { directorNotes: { presetStyle: "supportive", expressivity: 0.4 } } },
    },
    { name: "personaConfig.voiceSpeed", patch: { __persona: { voiceSpeed: 1 } } },
    { name: "personaConfig.skipGreeting=false", patch: { __persona: { skipGreeting: false } } },
    { name: "sessionOptions.videoQuality", patch: { sessionOptions: { videoQuality: "high" } } },
    {
        name: "sessionOptions.sessionReplay",
        patch: { sessionOptions: { sessionReplay: { enableSessionReplay: true } } },
    },
];

const main = async () => {
    const url = argOf("url");
    if (!url) {
        throw new Error('A meeting URL is required: npm run probe:meeting:dev -- --url="https://teams.microsoft.com/..."');
    }

    if (!Env.anam.anam_api_key) throw new Error("ANAM_API_KEY is not set");

    await connection.authenticate();

    const avatar = await AnamAvatar.findOne({ where: { is_active: 1 }, order: [["display_order", "ASC"]] });
    if (!avatar) throw new Error("No active avatar - run npm run seed:avatars:dev");

    // No tools and a throwaway prompt: this is probing the envelope, not a call.
    const basePersona: IAnamPersonaConfig = {
        name: avatar.display_name,
        avatarId: avatar.avatar_id,
        avatarModel: avatar.avatar_model,
        voiceId: avatar.voice_id,
        systemPrompt: "Probe only. Do not speak.",
    };

    console.log(`Probing ${PROBES.length} field(s) against ${Env.anam.api_base_url}/meetings/invites`);
    console.log(`Avatar: ${avatar.avatar_key} (${avatar.display_name})\n`);

    const results: Array<{
        name: string;
        verdict: string;
        detail: string;
        inviteId?: string;
        cancelled?: boolean;
    }> = [];

    for (const probe of PROBES) {
        const { __persona, ...topLevel } = probe.patch as { __persona?: Record<string, unknown> };

        const request: IAnamMeetingInviteRequest = {
            meetingUrl: url,
            personaConfig: { ...basePersona, ...(__persona ?? {}) } as IAnamPersonaConfig,
            displayName: avatar.display_name,
            groupCall: false,
            joinAt: joinAt(),
            clientLabel: "field-probe",
            ...topLevel,
        };

        try {
            const invite = await createMeetingInvite(request);

            // Never leave a probe scheduled to dial in.
            let cancelled = true;
            try {
                await cancelMeetingInvite(invite.id);
            } catch (error) {
                cancelled = false;
                console.log(
                    `  ! could not cancel ${invite.id}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }

            results.push({
                name: probe.name,
                verdict: "ACCEPTED",
                detail: `invite=${invite.id} status=${invite.status} displayName="${invite.displayName}"`,
                inviteId: invite.id,
                cancelled,
            });
        } catch (error) {
            results.push({
                name: probe.name,
                verdict: "REJECTED",
                detail: error instanceof Error ? error.message : String(error),
            });
        }
    }

    console.log("\nResults:");
    for (const result of results) {
        console.log(`  ${result.verdict.padEnd(8)} ${result.name}`);
        console.log(`           ${result.detail}`);
    }

    // ACCEPTED only means the request was not refused. An unknown field is often
    // ignored silently, so a field that matters still has to be judged on the call.
    console.log(
        `\nNote: ACCEPTED means Anam did not reject the field, not that it took effect.` +
            ` Silently-ignored fields also come back ACCEPTED.`,
    );

    // A cancel that failed leaves a scheduled invite behind. Say so loudly:
    // it will dial in on its own otherwise.
    const stranded = results.filter((result) => result.verdict === "ACCEPTED" && !result.cancelled);
    if (stranded.length) {
        console.log(
            `\nWARNING: ${stranded.length} invite(s) could not be cancelled and are still scheduled.` +
                ` Cancel them in the Anam dashboard: ${stranded.map((r) => r.inviteId).join(", ")}`,
        );
    }

    await connection.close();
};

void main().catch(async (error) => {
    console.error("\nProbe failed:", error instanceof Error ? error.message : error);
    await connection.close().catch(() => undefined);
    process.exit(1);
});
