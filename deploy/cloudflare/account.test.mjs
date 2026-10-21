/* node deploy/cloudflare/account.test.mjs */
import assert from "assert";
import { accessResponse, cookieLevel, downgradeResponse, logoutResponse, signOutResponse } from "./worker.js";

const sangha = await accessResponse("sangha").json();
const zazen = await accessResponse("zazen").json();
assert.deepStrictEqual(sangha, { level: "sangha" });
assert.deepStrictEqual(zazen, { level: "zazen" });

const out = signOutResponse();
assert.strictEqual(out.status, 200);
const cookie = out.headers.get("set-cookie");
assert.ok(cookie.startsWith("yantra=;"));
assert.ok(cookie.includes("Max-Age=0"));
assert.ok(cookie.includes("Path=/"));
assert.ok(cookie.includes("HttpOnly"));
const body = await out.json();
assert.strictEqual(body.ok, true);

const left = logoutResponse();
assert.strictEqual(left.status, 200);
const leftCookie = left.headers.get("set-cookie");
assert.ok(leftCookie.startsWith("yantra=;"));
assert.ok(leftCookie.includes("Max-Age=0"));
assert.ok(leftCookie.includes("HttpOnly"));
const html = await left.text();
assert.ok(html.includes("Sangha word"));
assert.ok(html.includes('action="/enter"'));

const down = await downgradeResponse({ COOKIE_KEY: "test-secret" });
assert.strictEqual(down.status, 200);
const downBody = await down.json();
assert.deepStrictEqual(downBody, { ok: true, level: "sangha" });
const issued = down.headers.get("set-cookie").split(";")[0].slice("yantra=".length);
const level = await cookieLevel(
  new Request("https://yantramedi.app/web/", { headers: { cookie: "yantra=" + issued } }),
  { COOKIE_KEY: "test-secret" },
);
assert.strictEqual(level, "sangha");

const worker = await import("fs").then((fs) => fs.readFileSync(new URL("./worker.js", import.meta.url), "utf8"));
assert.ok(worker.includes('pathname === "/leave"'));
assert.ok(worker.includes('pathname === "/logout"'));
assert.ok(worker.includes('pathname === "/access/sangha"'));
assert.ok(worker.includes('pathname === "/access"'));

console.log("account.test.mjs ok");
