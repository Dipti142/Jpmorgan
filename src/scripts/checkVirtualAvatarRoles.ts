import { resolveRole } from "../services/virtualAvatar/virtualAvatarRole.service";

const cases: [string, string][] = [
    ["dr.rao@mailinator.com", "ORGANISER"],
    ["Dr.Rao@mailinator.com", "ORGANISER"],
    ["agent@mailinator.com", "AGENT"],
    ["AGENT@mailinator.com", "AGENT"],
    ["patient@gmail.com", "GUEST"],
    ["someone@notmailinator.com", "GUEST"],
    ["someone@mailinator.com.evil.net", "GUEST"],
    ["agent@othercompany.com", "GUEST"],
];

let failures = 0;
for (const [email, expected] of cases) {
    const actual = resolveRole(email);
    const ok = actual === expected;
    if (!ok) failures += 1;
    console.log(`${ok ? "ok  " : "FAIL"}  ${email.padEnd(42)} -> ${actual} (expected ${expected})`);
}

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
