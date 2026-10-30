/**
 * US spoken form.
 *
 * A text-to-speech voice reading "$1,250.50" or "2026-09-01" or "(415) 555-0142"
 * is the single fastest way to sound like a machine. Everything a persona might
 * have to say aloud passes through here first, so a figure is spoken the way a
 * person in the US would say it.
 *
 * Pure functions, no dependencies, no I/O - the orientation persona imports the
 * same module, so a change to how money is spoken lands in both at once.
 */

const ONES = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const SCALES: Array<{ value: number; name: string }> = [
    { value: 1_000_000_000, name: "billion" },
    { value: 1_000_000, name: "million" },
    { value: 1_000, name: "thousand" },
];

const ORDINALS: Record<string, string> = {
    one: "first", two: "second", three: "third", five: "fifth", eight: "eighth",
    nine: "ninth", twelve: "twelfth",
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Spoken symbol names, so an address is never read as punctuation. */
const EMAIL_SYMBOLS: Record<string, string> = {
    "@": " at ",
    ".": " dot ",
    "-": " dash ",
    _: " underscore ",
    "+": " plus ",
};

/* -- numbers ------------------------------------------------------------- */

function underThousand(value: number): string {
    if (value < 20) return ONES[value];
    if (value < 100) {
        const tens = TENS[Math.floor(value / 10)];
        const rest = value % 10;
        return rest ? `${tens}-${ONES[rest]}` : tens;
    }
    const hundreds = `${ONES[Math.floor(value / 100)]} hundred`;
    const rest = value % 100;
    return rest ? `${hundreds} ${underThousand(rest)}` : hundreds;
}

/** 1250 -> "one thousand two hundred fifty". No "and", which is British. */
export function spokenInteger(value: number): string {
    if (!Number.isFinite(value)) return "";
    const rounded = Math.trunc(value);
    if (rounded === 0) return "zero";
    if (rounded < 0) return `negative ${spokenInteger(Math.abs(rounded))}`;

    let remaining = rounded;
    const parts: string[] = [];
    for (const scale of SCALES) {
        if (remaining >= scale.value) {
            parts.push(`${underThousand(Math.floor(remaining / scale.value))} ${scale.name}`);
            remaining %= scale.value;
        }
    }
    if (remaining > 0) parts.push(underThousand(remaining));
    return parts.join(" ");
}

/** Decimals read digit by digit after the point, the way a person reads them. */
export function spokenNumber(value: number, maxDecimals = 2): string {
    if (!Number.isFinite(value)) return "";
    const negative = value < 0;
    const absolute = Math.abs(value);
    const whole = Math.trunc(absolute);
    const fraction = Number((absolute - whole).toFixed(maxDecimals));

    let spoken = spokenInteger(whole);
    if (fraction > 0) {
        const digits = fraction.toFixed(maxDecimals).slice(2).replace(/0+$/, "");
        spoken += ` point ${digits.split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ")}`;
    }
    return negative ? `negative ${spoken}` : spoken;
}

/** 3 -> "third", 21 -> "twenty-first". Used for dates and list positions. */
export function spokenOrdinal(value: number): string {
    const words = spokenInteger(value);
    const separator = words.includes("-") ? "-" : " ";
    const index = words.lastIndexOf(separator);
    const head = index === -1 ? "" : words.slice(0, index + 1);
    const tail = index === -1 ? words : words.slice(index + 1);

    if (ORDINALS[tail]) return head + ORDINALS[tail];
    if (tail.endsWith("y")) return `${head}${tail.slice(0, -1)}ieth`;
    return `${head}${tail}th`;
}

/* -- money --------------------------------------------------------------- */

/** 1250.5 -> "one thousand two hundred fifty dollars and fifty cents". */
export function spokenMoney(value: number, currency = "dollar"): string {
    if (!Number.isFinite(value)) return "";
    const negative = value < 0;
    const totalCents = Math.round(Math.abs(value) * 100);
    const dollars = Math.floor(totalCents / 100);
    const cents = totalCents % 100;

    const parts: string[] = [];
    if (dollars || !cents) {
        parts.push(`${spokenInteger(dollars)} ${currency}${dollars === 1 ? "" : "s"}`);
    }
    if (cents) {
        parts.push(`${spokenInteger(cents)} cent${cents === 1 ? "" : "s"}`);
    }

    const spoken = parts.join(" and ");
    return negative ? `minus ${spoken}` : spoken;
}

/** 0.67 as a rate -> "sixty-seven cents". Mileage rates are quoted this way. */
export function spokenRate(value: number, per: string): string {
    const amount = value < 1 ? `${spokenInteger(Math.round(value * 100))} cents` : spokenMoney(value);
    return `${amount} per ${per}`;
}

/* -- units --------------------------------------------------------------- */

const HALVES: Record<string, string> = { "0.5": "and a half", "0.25": "and a quarter", "0.75": "and three quarters" };

/** 37.5 -> "thirty-seven and a half miles". Falls back to "point five". */
export function spokenQuantity(value: number, unit: string, pluralUnit?: string): string {
    if (!Number.isFinite(value)) return "";
    const whole = Math.trunc(value);
    const fraction = Number((Math.abs(value) - Math.abs(whole)).toFixed(2));
    const plural = pluralUnit ?? `${unit}s`;
    const noun = Math.abs(value) === 1 ? unit : plural;

    const half = HALVES[String(fraction)];
    if (half) return `${spokenInteger(whole)} ${half} ${noun}`;
    return `${spokenNumber(value)} ${noun}`;
}

export const spokenMiles = (value: number): string => spokenQuantity(value, "mile");

export const spokenPercent = (value: number): string => `${spokenNumber(value)} percent`;

/** 90 minutes -> "an hour and a half". Used for call and training lengths. */
export function spokenDuration(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return "";
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);

    if (!hours) return spokenQuantity(rest, "minute");
    if (!rest) return spokenQuantity(hours, "hour");
    if (rest === 30) return hours === 1 ? "an hour and a half" : `${spokenInteger(hours)} and a half hours`;
    return `${spokenQuantity(hours, "hour")} and ${spokenQuantity(rest, "minute")}`;
}

/* -- dates and times ---------------------------------------------------- */

function parseDate(value: Date | string): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    // Date-only strings are parsed as UTC by the engine; pin them to noon UTC
    // so a timezone shift cannot move the day.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) return new Date(`${value}T12:00:00Z`);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 2026-09-01 -> "Tuesday, September first". The year is added only if given. */
export function spokenDate(value: Date | string, options: { weekday?: boolean; year?: boolean } = {}): string {
    const date = parseDate(value);
    if (!date) return "";
    const { weekday = true, year = false } = options;

    const parts: string[] = [];
    if (weekday) parts.push(`${WEEKDAYS[date.getUTCDay()]},`);
    parts.push(MONTHS[date.getUTCMonth()], spokenOrdinal(date.getUTCDate()));
    if (year) parts.push(spokenYear(date.getUTCFullYear()));
    return parts.join(" ");
}

/** 2026 -> "twenty twenty-six". 2005 -> "two thousand five". */
export function spokenYear(year: number): string {
    if (year % 100 === 0) return spokenInteger(year);
    if (year >= 2000 && year < 2010) return spokenInteger(year);
    const head = Math.floor(year / 100);
    const tail = year % 100;
    return `${spokenInteger(head)} ${tail < 10 ? `oh ${ONES[tail]}` : underThousand(tail)}`;
}

/** "14:30" -> "two thirty in the afternoon". */
export function spokenTime(value: string): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim());
    if (!match) return "";
    const hours24 = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours24 > 23 || minutes > 59) return "";

    const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    let spoken = spokenInteger(hour12);
    if (minutes === 0) spoken += " o'clock";
    else if (minutes < 10) spoken += ` oh ${ONES[minutes]}`;
    else spoken += ` ${underThousand(minutes)}`;

    if (hours24 < 12) return `${spoken} in the morning`;
    if (hours24 < 17) return `${spoken} in the afternoon`;
    return `${spoken} in the evening`;
}

/* -- contact details ----------------------------------------------------- */

/**
 * Digit by digit in area-code groups. A phone number spoken as a number
 * ("four billion...") is the classic tell that nobody is really there.
 */
export function spokenPhone(value: string): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";

    const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    const say = (chunk: string) => chunk.split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ");

    if (national.length === 10) {
        return [national.slice(0, 3), national.slice(3, 6), national.slice(6)].map(say).join(", ");
    }
    return say(national);
}

/** "a.patel@example.com" -> "a dot patel at example dot com". */
export function spokenEmail(value: string): string {
    const address = String(value ?? "").trim().toLowerCase();
    if (!address) return "";
    return address
        .split("")
        .map((character) => EMAIL_SYMBOLS[character] ?? character)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
}

/* -- masking ------------------------------------------------------------- */

/**
 * What the persona is allowed to say back when a detail does not match. Never
 * the whole value: reading the address on file out loud hands it to whoever is
 * on the call, which is the opposite of verifying it.
 */
export function maskEmail(value: string | null | undefined): string {
    const address = String(value ?? "").trim();
    if (!address.includes("@")) return "nothing on file";
    const [local, domain] = address.split("@");
    const head = local.slice(0, 2);
    const domainParts = domain.split(".");
    const suffix = domainParts.length > 1 ? `.${domainParts.slice(1).join(".")}` : "";
    return `${head}${"*".repeat(Math.max(local.length - 2, 2))}@${domainParts[0][0]}${"*".repeat(
        Math.max(domainParts[0].length - 1, 2),
    )}${suffix}`;
}

/** Last four only, spoken as digits: "ending zero one four two". */
export function maskPhone(value: string | null | undefined): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (digits.length < 4) return "nothing on file";
    return `ending ${digits.slice(-4).split("").map((d) => DIGIT_WORDS[Number(d)]).join(" ")}`;
}

/* -- normalising what was heard ----------------------------------------- */

/** What they say before the detail itself. A separator is required, so "my@x.com" survives. */
const LEAD_IN =
    /^(?:\s*(?:it'?s|it is|that'?s|this is|here'?s|sure|yeah|yes|yep|ok|okay|um|uh|so|well|my|the|email|e-?mail|address|number|phone|mobile|cell|is|you can (?:reach|contact|get) me (?:at|on)|(?:reach|contact) me (?:at|on))\b[\s,:]+)+/;

/** The inverse of EMAIL_SYMBOLS, longest spoken form first so "at the rate" beats "at". */
const HEARD_SYMBOLS: Array<[RegExp, string]> = [
    [/\b(?:at the rate(?: of)?|at sign|atsign|at symbol)\b/g, "@"],
    [/\bat\b/g, "@"],
    [/\b(?:dot|point|full stop)\b/g, "."],
    [/\b(?:dash|hyphen|minus)\b/g, "-"],
    [/\bunder\s?score\b/g, "_"],
    [/\bplus\b/g, "+"],
];

const HEARD_DIGITS: Record<string, string> = {
    zero: "0", oh: "0", o: "0", nought: "0", one: "1", two: "2", three: "3",
    four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

/**
 * Speech-to-text writes an email as "a dot patel at example dot com" and a
 * phone number with words and punctuation mixed in. Both have to be folded back
 * before they can be compared with what is on file, or every check fails.
 *
 * What arrives is a whole spoken turn, not a bare address - "it's h-a-r-s-h-i-t-h
 * at gmail dot com" - so the lead-in goes, the spoken symbols and spelled-out
 * letters fold down, and the address is picked out of whatever is left.
 */
export function normaliseHeardEmail(value: string): string {
    let heard = String(value ?? "").toLowerCase().replace(LEAD_IN, "");
    for (const [spoken, symbol] of HEARD_SYMBOLS) heard = heard.replace(spoken, symbol);

    // "at" heard as "that" is the usual way an address arrives with no @ in it at all.
    if (!heard.includes("@")) heard = heard.replace(/\b(?:that|hat)\b/, "@");

    const folded = heard
        // A run of single letters joined by hyphens was spelled out, not hyphenated.
        .replace(/\b[a-z](?:-[a-z]){2,}\b/g, (run) => run.replace(/-/g, ""))
        .replace(/\s+/g, "")
        .replace(/[.,;]+$/, "");

    return folded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] ?? folded;
}

export function normaliseHeardPhone(value: string): string {
    const spelled = String(value ?? "")
        .toLowerCase()
        // An extension is not part of the number, and its digits would break the compare.
        .replace(/\b(?:ext|extn|extension)\b.*$/, "")
        .replace(/\b(zero|oh|o|nought|one|two|three|four|five|six|seven|eight|nine)\b/g, (word) => HEARD_DIGITS[word])
        .replace(/\b(double|triple)\s*(\d)/g, (_match, many, digit) => String(digit).repeat(many === "double" ? 2 : 3));

    const digits = spelled.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/* -- sweeping retrieved text ------------------------------------------- */

/**
 * Knowledge-base text is written to be read, not spoken - "$0.67 per mile",
 * "37.5 miles", "9:00-17:00". This rewrites those in place before the text
 * reaches the prompt, so the persona is handed something already sayable
 * instead of being trusted to convert it mid-sentence.
 */
export function toSpokenText(text: string): string {
    if (!text) return "";

    return String(text)
        // Ranges first: "9:00-17:00" must not be split by the time rule below.
        .replace(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g,
            (_m, from, to) => `${spokenTime(from)} to ${spokenTime(to)}`)
        .replace(/\$\s?([\d,]+(?:\.\d{1,2})?)\s*(?:\/|\bper\b)\s*([a-z]+)/gi,
            (_m, amount, unit) => spokenRate(Number(String(amount).replace(/,/g, "")), String(unit)))
        .replace(/\$\s?([\d,]+(?:\.\d{1,2})?)/g,
            (_m, amount) => spokenMoney(Number(String(amount).replace(/,/g, ""))))
        .replace(/\b(\d{1,2}:\d{2})\b/g, (_m, time) => spokenTime(time))
        .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,
            (match) => spokenDate(match, { weekday: false, year: true }))
        .replace(/\b([\d.]+)\s?(miles|mile|hours|hour|minutes|minute|days|day|weeks|week)\b/gi,
            (_m, amount, unit) => {
                const singular = String(unit).replace(/s$/i, "").toLowerCase();
                return spokenQuantity(Number(amount), singular);
            })
        .replace(/\b([\d.]+)\s?%/g, (_m, amount) => spokenPercent(Number(amount)))
        .replace(/\s{2,}/g, " ");
}
