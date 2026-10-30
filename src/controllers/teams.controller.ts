import { Request, Response } from "express";
import { handle, validate } from "../helpers/controller.helper";
import { trace, traceFailure } from "../helpers/trace.helper";
import * as teamsMail from "../services/teamsMail.service";
import * as teamsSubscription from "../services/teamsSubscription.service";
import {
    graphNotificationSchema,
    validationQuerySchema,
} from "../validators/teams.validator";

/**
 * The Graph mail webhook. An invite email landing here is what creates a meeting
 * session, so this is the entry point for every VA call.
 */

export class TeamsController {
    public static postMailNotification = handle(async (req: Request, res: Response) => {
        const { validationToken } = validate(validationQuerySchema, req.query);
        if (validationToken) {
            trace("mailsub", "handshake", "validated", { url: req.originalUrl.split("?")[0] });
            return res.type("text/plain").send(validationToken);
        }
        validate(graphNotificationSchema, req.body ?? {});

        res.status(202).end();

        try {
            const { value } = validate(graphNotificationSchema, req.body ?? {});
            const messageIds = value
                .filter((notification) => teamsSubscription.matchesClientState(notification.clientState))
                .map((notification) => notification.resourceData?.id)
                .filter((id): id is string => typeof id === "string");

            trace("mailsub", "notification", "received", { count: messageIds.length, ids: messageIds.join(",") });
            await teamsMail.handleNotifications(messageIds);
        } catch (error) {
            traceFailure("mailsub", "notification", "handle", error);
        }
    });

    public static postMailLifecycle = handle(async (req: Request, res: Response) => {
        const { validationToken } = validate(validationQuerySchema, req.query);
        if (validationToken) {
            trace("mailsub", "handshake", "validated", { url: req.originalUrl.split("?")[0] });
            return res.type("text/plain").send(validationToken);
        }

        const { value } = validate(graphNotificationSchema, req.body ?? {});
        res.status(202).end();

        try {
            const { value } = validate(graphNotificationSchema, req.body ?? {});

            for (const notification of value) {
                if (!teamsSubscription.matchesClientState(notification.clientState)) continue;

                const event = notification.lifecycleEvent;
                const current = teamsSubscription.currentSubscriptionId();

                if (!current || notification.subscriptionId !== current) {
                    trace("mailsub", notification.subscriptionId ?? "unknown", "lifecycle ignored", {
                        event,
                        reason: "stale",
                    });
                    continue;
                }

                trace("mailsub", current, "lifecycle", { event });

                if (event === "subscriptionRemoved") {
                    void teamsSubscription.restart();
                } else if (event === "reauthorizationRequired") {
                    void teamsSubscription.reauthorize().catch(() => teamsSubscription.restart());
                }
            }
        } catch (error) {
            traceFailure("mailsub", "lifecycle", "handle", error);
        }
    });
}

/** companyId is optional here on purpose: a timer sweeping every tenant is the point. */


