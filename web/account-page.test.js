/* node web/account-page.test.js */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const page = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const account = fs.readFileSync(path.join(__dirname, "account.js"), "utf8");
const sync = fs.readFileSync(path.join(__dirname, "sync.js"), "utf8");

function between(start, end) {
  const from = page.indexOf(start);
  const to = page.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start + " .. " + end);
  return page.slice(from, to);
}

const mindful = between('id="account-mindful"', 'id="account-practice-block"');
assert.ok(mindful.includes("<h3>Mindfulness Material</h3>"));
assert.ok(mindful.includes(">Dharma Talks<"));
assert.ok(mindful.includes(">Sit Guidance<"));
assert.ok(mindful.includes(">Albums + Playlists<"));
assert.ok(mindful.includes('id="open-talks" data-room="talks" hidden'));
assert.ok(mindful.includes('data-room="guide"'));
assert.ok(mindful.includes('id="open-shelf"'));
assert.ok(!mindful.includes("How to sit"), "the account link is Sit Guidance");
assert.ok(!mindful.includes("Albums and forms"));
assert.ok(!mindful.includes("Mindfulness material"));
assert.strictEqual(page.includes('id="account-places"'), false, "the separate links row is gone");
assert.ok(page.includes("<h2>How to sit</h2>"), "the sit guide itself keeps its title");

assert.ok(page.includes('<details class="account-fold" id="account-practice-block" data-fold="practice">'));
assert.ok(page.includes('<details class="account-fold" id="account-reminders-block" data-fold="reminders">'));
assert.ok(page.includes('<details class="account-fold" id="account-profile" data-fold="profile">'));
assert.ok(page.includes('<details class="account-fold" id="account-settings" data-fold="settings">'));
assert.ok(page.includes("<summary>Practice</summary>"));
assert.ok(page.includes("<summary>Reminders</summary>"));
assert.ok(page.includes("<summary>Profile</summary>"));
assert.ok(page.includes("<summary>Settings</summary>"));
assert.strictEqual(page.includes('data-fold="reminders" open'), false);
assert.strictEqual(page.includes('data-fold="profile" open'), false);
assert.strictEqual(page.includes('data-fold="settings" open'), false);

const practice = between('id="account-practice-block"', 'id="account-reminders-block"');
assert.ok(practice.includes('id="practice-export"'));
assert.ok(practice.includes('id="practice-erase"'));
assert.ok(practice.includes('id="practice-link"'));
assert.ok(practice.includes("Link my devices"));
assert.ok(practice.includes('id="account-week"'));

const reminders = between('id="account-reminders-block"', 'id="account-profile"');
assert.ok(reminders.includes('id="reminders"'));
assert.ok(reminders.includes('data-time type="time"'));
assert.ok(reminders.includes('id="remind-save"'));
assert.ok(reminders.includes("Save reminders"));
assert.ok(reminders.includes('id="account-reminders-push"'));
assert.ok(!reminders.includes('id="account-spotify"'));

const profile = between('id="account-profile"', 'id="account-settings"');
assert.ok(profile.includes('id="account-initial"'));
assert.ok(profile.includes('id="account-name"'));
assert.ok(profile.includes('id="account-altar"'));
assert.ok(profile.includes('id="altar-file"'));
assert.ok(profile.includes('id="account-logout"'));
assert.ok(profile.includes('id="account-sync"'));
assert.ok(profile.includes(">Log out<"));
assert.ok(!profile.includes('id="practice-export"'), "export stays with the practice record");
assert.ok(!profile.includes('id="practice-erase"'));

const settings = between('id="account-settings"', "</div>\n</div>\n<div id=\"gate\">");
assert.ok(settings.includes("<h3>Spotify</h3>"));
assert.ok(settings.includes("<h3>Privacy</h3>"));
assert.ok(settings.includes('id="install-app"'));
assert.ok(settings.includes('id="account-wipe"'));
assert.ok(!settings.includes('id="remind-save"'));
assert.ok(!settings.includes('id="account-name"'));

assert.strictEqual(page.includes('data-fold="practice" open'), false, "every drawer starts closed");
assert.ok(account.includes("window.closeAccountFolds = closeFolds"));
assert.ok(page.includes('if (name === "account" && window.closeAccountFolds) window.closeAccountFolds();'));
assert.ok(!account.includes("yantra.account.folds"), "drawers are not remembered");
assert.ok(account.includes("account-initial"));
assert.ok(page.includes('closest("details")'), "a deep link opens the section that holds it");
assert.ok(sync.includes("yantraCameFromPracticeLink"));
assert.ok(account.includes("yantraCameFromPracticeLink"));
assert.ok(page.includes('class="back" type="button" data-room="home" aria-label="Back"'));
assert.ok(page.includes("grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr)"), "the iPad shelf stays two columns");
assert.strictEqual(page.includes('id="account-bell"'), false);
assert.strictEqual(page.includes('id="account-glow"'), false);

console.log("account-page.test.js ok");
