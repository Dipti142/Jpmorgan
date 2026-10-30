import { Env } from "../config/env.config";
import { timingSafeMatch } from "../helpers/security.helper";
import { trace, traceFailure } from "../helpers/trace.helper";
import { IGraphCollection, IGraphSubscription } from "../interfaces/ITeamsGraph.interface";
import { del, getJson, patchJson, postJson } from "./teamsGraph.service";

const TAG = "mailsub";
const BOOT = "boot";

/** Graph caps Outlook message subscriptions at 10,080 minutes while includeResourceData is false. */
const EXPIRY_MINUTES = 10_000;
const RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;

let subscriptionId: string | null = null;
let renewalTimer: NodeJS.Timeout | null = null;
let restarting: Promise<void> | null = null;

export const currentSubscriptionId = (): string | null => subscriptionId;

export const matchesClientState = (value: string | undefined): boolean =>
    timingSafeMatch(value ?? "", Env.teams.TEAMS_CLIENT_STATE);

const notificationUrl = (): string => `${Env.anam.public_base_url}/v1/teams/mail/notifications`;
const lifecycleUrl = (): string => `${Env.anam.public_base_url}/v1/teams/mail/lifecycle`;

/** Graph wants seven fractional digits, which toISOString does not produce. */
const expiresAt = (): string =>
    new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString().replace(/\.\d{3}Z$/, ".0000000Z");

const requireConfig = (): void => {
    if (!Env.teams.AGENT_MAILBOX) throw new Error("AGENT_MAILBOX is not set - nothing to watch");
    if (!Env.anam.public_base_url) {
        throw new Error("AGENTIC_AVATAR_BASE_URL is not set - Graph has nowhere to call back");
    }
    if (!Env.teams.TEAMS_CLIENT_STATE) {
        throw new Error("TEAMS_CLIENT_STATE is not set - notifications could not be verified");
    }
};

const reconcile = async (): Promise<void> => {
    const { value } = await getJson<IGraphCollection<IGraphSubscription>>("/subscriptions");
    const ours = value.filter((s) => s.notificationUrl === notificationUrl());

    for (const s of ours) {
        try {
            await del(`/subscriptions/${s.id}`);
            trace(TAG, BOOT, "removed", { subscriptionId: s.id, expires: s.expirationDateTime });
        } catch (error) {
            traceFailure(TAG, BOOT, "remove", error);
        }
    }
};

const create = async (): Promise<void> => {
    const subscription = await postJson<IGraphSubscription>("/subscriptions", {
        changeType: "created",
        notificationUrl: notificationUrl(),
        lifecycleNotificationUrl: lifecycleUrl(),
        resource: `users/${Env.teams.AGENT_MAILBOX}/mailFolders('Inbox')/messages`,
        expirationDateTime: expiresAt(),
        clientState: Env.teams.TEAMS_CLIENT_STATE,
    });

    subscriptionId = subscription.id;
    trace(TAG, subscription.id, "watching", {
        mailbox: Env.teams.AGENT_MAILBOX,
        expires: subscription.expirationDateTime,
    });
};

/** Always paired: Graph holds several subscriptions per mailbox, so one is dropped before one is made. */
const watch = async (): Promise<void> => {
    await reconcile();
    await create();
};

const renew = async (): Promise<void> => {
    if (!subscriptionId) return watch();

    try {
        const renewed = await patchJson<IGraphSubscription>(`/subscriptions/${subscriptionId}`, {
            expirationDateTime: expiresAt(),
        });
        trace(TAG, subscriptionId, "renewed", { expires: renewed.expirationDateTime });
    } catch (error) {
        traceFailure(TAG, subscriptionId, "renew", error);
        subscriptionId = null;
        await watch();
    }
};

const scheduleRenewal = (): void => {
    if (renewalTimer) clearTimeout(renewalTimer);

    renewalTimer = setTimeout(() => {
        void renew()
            .catch((error) => traceFailure(TAG, subscriptionId ?? BOOT, "renew", error))
            .finally(scheduleRenewal);
    }, RENEW_INTERVAL_MS);
};

export const start = async (): Promise<void> => {
    try {
        requireConfig();
        await watch();
        scheduleRenewal();
    } catch (error) {
        traceFailure(TAG, BOOT, "start", error);
        console.error("Mailbox is NOT being watched. Fix the above and restart.");
    }
};

export const reauthorize = async (): Promise<void> => {
    if (!subscriptionId) return;
    await postJson(`/subscriptions/${subscriptionId}/reauthorize`);
    trace(TAG, subscriptionId, "reauthorized");
};

export const restart = async (): Promise<void> => {
    if (restarting) return restarting;

    restarting = (async () => {
        subscriptionId = null;
        await start();
    })().finally(() => {
        restarting = null;
    });

    return restarting;
};

export const stop = async (): Promise<void> => {
    if (renewalTimer) {
        clearTimeout(renewalTimer);
        renewalTimer = null;
    }
    if (!subscriptionId) return;

    try {
        await del(`/subscriptions/${subscriptionId}`);
        trace(TAG, subscriptionId, "deleted");
    } catch (error) {
        traceFailure(TAG, subscriptionId, "delete", error);
    }
    subscriptionId = null;
};
