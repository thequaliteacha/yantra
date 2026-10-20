/* node web/solar.test.mjs
   Published local times, minute resolution, from timeanddate.com for 21 June 2026.
   Honolulu 21.3069 N, 157.8583 W: sunrise 5:50, sunset 7:16 (HST).
   Austin 30.2672 N, 97.7431 W: sunrise 6:30, sunset 8:36 (CDT) at the southwest city zip;
   downtown tables vary by a minute across Austin, so the check allows two minutes. */
import assert from "assert";
import { sunTimes } from "./solar.js";
import { formatLocal, zonedToUtc } from "./schedule.js";

function localMinutes(ms, timeZone) {
  const text = formatLocal(ms, timeZone);
  const match = text.match(/(\d+):(\d+)\s*(AM|PM)/i);
  assert.ok(match, text);
  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

function expectNear(ms, timeZone, hhmm, slack) {
  const [hour, minute] = hhmm.split(":").map(Number);
  const got = localMinutes(ms, timeZone);
  const want = hour * 60 + minute;
  assert.ok(Math.abs(got - want) <= slack, formatLocal(ms, timeZone) + " vs " + hhmm);
}

const noonHonolulu = zonedToUtc(2026, 6, 21, 12, 0, "Pacific/Honolulu");
const honolulu = sunTimes(noonHonolulu, 21.3069, -157.8583);
expectNear(honolulu.sunrise, "Pacific/Honolulu", "05:50", 2);
expectNear(honolulu.sunset, "Pacific/Honolulu", "19:16", 2);

const noonAustin = zonedToUtc(2026, 6, 21, 12, 0, "America/Chicago");
const austin = sunTimes(noonAustin, 30.2672, -97.7431);
expectNear(austin.sunrise, "America/Chicago", "06:30", 2);
expectNear(austin.sunset, "America/Chicago", "20:36", 2);

const winterH = sunTimes(zonedToUtc(2026, 12, 21, 12, 0, "Pacific/Honolulu"), 21.3069, -157.8583);
const winterA = sunTimes(zonedToUtc(2026, 12, 21, 12, 0, "America/Chicago"), 30.2672, -97.7431);
assert.ok(winterH.sunrise > winterH.sunset - 12 * 3600000);
assert.ok(localMinutes(winterA.sunrise, "America/Chicago") > localMinutes(austin.sunrise, "America/Chicago"));
assert.ok(localMinutes(winterA.sunset, "America/Chicago") < localMinutes(austin.sunset, "America/Chicago"));

console.log("solar.test.mjs ok", {
  honolulu: [formatLocal(honolulu.sunrise, "Pacific/Honolulu"), formatLocal(honolulu.sunset, "Pacific/Honolulu")],
  austin: [formatLocal(austin.sunrise, "America/Chicago"), formatLocal(austin.sunset, "America/Chicago")],
  winter: {
    honolulu: [formatLocal(winterH.sunrise, "Pacific/Honolulu"), formatLocal(winterH.sunset, "Pacific/Honolulu")],
    austin: [formatLocal(winterA.sunrise, "America/Chicago"), formatLocal(winterA.sunset, "America/Chicago")],
  },
});
