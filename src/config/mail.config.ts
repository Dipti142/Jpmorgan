import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import nodemailer, { Transporter } from "nodemailer";
import { Env } from "./env.config";

/** SMTP transport and the Handlebars template loader. Ported from vri_opi. */

let transport: Transporter | null = null;

export const getMailTransport = (): Transporter => {
    if (transport) return transport;

    if (!Env.mail.MAIL_HOST) {
        throw new Error("MAIL_HOST is not set - no invite email can be sent");
    }

    transport = nodemailer.createTransport({
        host: Env.mail.MAIL_HOST,
        port: Env.mail.MAIL_PORT,
        secure: Env.mail.MAIL_PORT === 465,
        auth: Env.mail.MAIL_USERNAME
            ? { user: Env.mail.MAIL_USERNAME, pass: Env.mail.MAIL_PASSWORD }
            : undefined,
    });

    return transport;
};

// Compiled once each: a template is read from disk on first use and kept.
const compiled = new Map<string, Handlebars.TemplateDelegate>();

export const mailTemplate = (templateFile: string, data: unknown): string => {
    let template = compiled.get(templateFile);

    if (!template) {
        const full = path.resolve(__dirname, "..", "email", "templates", templateFile);
        template = Handlebars.compile(fs.readFileSync(full, "utf8"));
        compiled.set(templateFile, template);
    }

    return template(data);
};

export const mailFrom = (): string =>
    Env.mail.MAIL_FROM_NAME
        ? `"${Env.mail.MAIL_FROM_NAME}" <${Env.mail.MAIL_FROM_EMAIL}>`
        : Env.mail.MAIL_FROM_EMAIL;

const WINDOW_FORMAT = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
});

export const mailWindow = (startsAt: Date, endsAt: Date): string =>
    `${WINDOW_FORMAT.formatRange(startsAt, endsAt)} UTC`;

export const resetMailTransport = (): void => {
    transport = null;
    compiled.clear();
};
