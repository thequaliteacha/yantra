const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

async function load() {
  return import(path.join(__dirname, "places.js"));
}

(async () => {
  const P = await load();

  // Every place is complete, and its zone is one the runtime knows.
  for (const place of P.PLACES) {
    assert.strictEqual(place.length, 5, place[0]);
    assert.ok(Math.abs(place[2]) <= 90 && Math.abs(place[3]) <= 180, place[0]);
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: place[4] }), place[0] + " " + place[4]);
  }
  // No city appears twice within one region.
  const seen = new Set();
  for (const [name, region] of P.PLACES) {
    const key = name + "|" + region;
    assert.ok(!seen.has(key), "duplicate " + key);
    seen.add(key);
  }

  // "Austin" brings up Austin, Texas first, with its label.
  const austin = P.findPlaces("Austin");
  assert.strictEqual(austin[0].label, "Austin, Texas");
  assert.strictEqual(austin[0].tz, "America/Chicago");
  // The way people type it: with the state, the code, or a comma.
  assert.strictEqual(P.findPlaces("austin tx")[0].label, "Austin, Texas");
  assert.strictEqual(P.findPlaces("Austin, Texas")[0].label, "Austin, Texas");
  assert.strictEqual(P.findPlaces("austin texas")[0].label, "Austin, Texas");
  // A region alone lists its cities.
  assert.ok(P.findPlaces("Texas").every((place) => place.region === "Texas"));
  assert.ok(P.findPlaces("Texas").length >= 4);
  // Same name, different places: both appear, each labelled.
  const portland = P.findPlaces("Portland").map((place) => place.label);
  assert.ok(portland.includes("Portland, Oregon") && portland.includes("Portland, Maine"));
  assert.strictEqual(P.findPlaces("portland me")[0].label, "Portland, Maine");
  // Starts-with comes before contains; accents fold.
  assert.strictEqual(P.findPlaces("San")[0].name.startsWith("San"), true);
  assert.strictEqual(P.findPlaces("Montréal")[0].label, "Montreal, Quebec");
  // Too short, or coordinates: no suggestions.
  assert.deepStrictEqual(P.findPlaces("A"), []);
  assert.deepStrictEqual(P.findPlaces("30.3, -97.7"), []);
  assert.deepStrictEqual(P.parseCoords("30.3, -97.7"), { lat: 30.3, lon: -97.7, name: "30.3, -97.7" });
  // At most six.
  assert.ok(P.findPlaces("an").length <= 6);

  // The page draws its own list instead of a datalist, which phones do not show.
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(!html.includes("<datalist"));
  assert.ok(html.includes('<div id="remind-places" hidden></div>'));
  const reminders = fs.readFileSync(path.join(__dirname, "reminders.js"), "utf8");
  assert.ok(reminders.includes('button.className = "remind-suggest"'));
  console.log("places ok");
})();
