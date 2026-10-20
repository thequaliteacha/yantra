/* node deploy/cloudflare/account.test.mjs */
import assert from "assert";
import { accessResponse, signOutResponse } from "./worker.js";

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

const worker = await import("fs").then((fs) => fs.readFileSync(new URL("./worker.js", import.meta.url), "utf8"));
assert.ok(worker.includes('pathname === "/leave"'));
assert.ok(worker.includes('pathname === "/access"'));

console.log("account.test.mjs ok");
