import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      const key = line.slice(0, i);
      let val = line.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return [key, val];
    }),
);

const clientId = env.NEXIFORMA_TEAMS_CLIENT_ID;
const clientSecret = env.NEXIFORMA_TEAMS_CLIENT_SECRET;
const m365Tenant = process.argv[2] ?? "fbe2e973-801d-4d64-8487-ccaadc6905d7";
const organizer = process.argv[3] ?? "admin@formafuturoportugal.pt";

if (!clientId || !clientSecret) {
  console.error("Falta NEXIFORMA_TEAMS_CLIENT_ID/SECRET no .env");
  process.exit(1);
}

const tokRes = await fetch(
  `https://login.microsoftonline.com/${m365Tenant}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  },
);
if (!tokRes.ok) {
  console.error("TOKEN FAIL", tokRes.status, await tokRes.text());
  process.exit(1);
}
const { access_token: token } = await tokRes.json();

const userRes = await fetch(
  `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizer)}?$select=id,displayName`,
  { headers: { authorization: `Bearer ${token}` } },
);
if (!userRes.ok) {
  console.error("USER FAIL", userRes.status, await userRes.text());
  process.exit(1);
}
const user = await userRes.json();

const meetRes = await fetch(
  `https://graph.microsoft.com/v1.0/users/${user.id}/onlineMeetings`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      subject: "Teste NexiForma",
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }),
  },
);
const body = await meetRes.text();
if (!meetRes.ok) {
  console.error("MEETING FAIL", meetRes.status, body);
  process.exit(1);
}
const meeting = JSON.parse(body);
console.log(
  JSON.stringify(
    {
      ok: true,
      organizer: user.displayName,
      objectId: user.id,
      meetingId: meeting.id,
      joinUrl: meeting.joinWebUrl,
    },
    null,
    2,
  ),
);
