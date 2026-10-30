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

const mindful = between('id="account-mindful"', 'id="account-settings"');
assert.ok(mindful.includes('<summary id="account-title">Mindfulness Material</summary>'));
assert.ok(mindful.includes(">Dharma Talks<"));
assert.ok(mindful.includes(">Albums + Playlists<"));
assert.ok(mindful.includes('id="open-talks" data-room="talks" hidden'));
assert.ok(mindful.includes('id="open-shelf"'));
assert.ok(mindful.includes('id="mindful-stats" hidden'));
assert.ok(mindful.includes('id="mindful-total"'));
assert.ok(!mindful.includes("Sit Guidance"));
assert.ok(!mindful.includes("How to sit"), "the guide title stays on the guide page");
assert.ok(!mindful.includes("Albums and forms"));
assert.ok(!mindful.includes("Mindfulness material"));
assert.ok(page.includes('id="start-here" data-room="guide">Start Here</button>'));
assert.strictEqual(page.includes("Sit Guidance"), false);
assert.strictEqual(page.includes('id="account-places"'), false, "the separate links row is gone");
assert.ok(page.includes("<h2>How to sit</h2>"), "the sit guide itself keeps its title");

assert.ok(page.includes('<details class="account-fold" id="account-altar-block" data-fold="altar">'));
assert.ok(page.includes('<details class="account-fold" id="account-practice-block" data-fold="practice">'));
assert.ok(page.includes('<details class="account-fold" id="account-devices-block" data-fold="devices">'));
assert.ok(page.includes('<details class="account-fold" id="account-reminders-block" data-fold="reminders">'));
assert.ok(page.includes('<details class="account-fold" id="account-profile" data-fold="profile">'));
assert.ok(page.includes('<details class="account-fold" id="account-settings" data-fold="settings">'));
assert.ok(page.includes("<summary>Altar</summary>"));
assert.ok(page.includes("<summary>Practice settings</summary>"));
assert.strictEqual(page.includes("<summary>Practice</summary>"), false);
assert.ok(page.includes("<summary>Linked devices</summary>"));
assert.ok(page.includes("<summary>Reminders</summary>"));
assert.ok(page.includes("<summary>Profile</summary>"));
assert.ok(page.includes("<summary>Settings</summary>"));
assert.strictEqual(page.includes('data-fold="altar" open'), false);
assert.strictEqual(page.includes('data-fold="reminders" open'), false);
assert.strictEqual(page.includes('data-fold="profile" open'), false);
assert.strictEqual(page.includes('data-fold="settings" open'), false);
assert.ok(page.indexOf('id="account-altar-block"') < page.indexOf('id="account-profile"'), "Altar sits above Profile");
assert.ok(page.indexOf('id="account-profile"') < page.indexOf('id="account-practice-block"'), "Profile sits above Practice");

const practice = between('id="account-practice-block"', 'id="account-devices-block"');
assert.ok(practice.includes('id="practice-export"'));
assert.ok(practice.includes('id="practice-erase"'));
assert.ok(!practice.includes('id="practice-link"'), "linking has its own section");
assert.ok(practice.includes('id="account-week"'));
assert.ok(practice.includes('id="motion-inner"'), "inner petals sit in Practice settings");
assert.ok(practice.includes('id="motion-outer"'), "outer petals sit in Practice settings");
assert.ok(practice.includes("For intermediate and advanced students."));
assert.ok(practice.includes("center bindu"));
assert.ok(practice.indexOf('id="practice-erase"') < practice.indexOf('id="motion-inner"'), "petal controls sit below the practice record");
assert.ok(practice.indexOf('id="motion-inner"') < practice.indexOf('id="motion-outer"'));
assert.ok(!practice.includes('id="motion-heart"'), "the heart mark control is gone");
assert.ok(!practice.includes('id="mindful-total"'), "mindfulness time stays out of the formal practice block");
assert.ok(!practice.includes(">Triangles<"));
assert.ok(!practice.includes(">Pentagram<"));

const devices = between('id="account-devices-block"', 'id="account-reminders-block"');
assert.ok(devices.includes('id="practice-link"'));
assert.ok(devices.includes("Link my devices"));

const reminders = between('id="account-reminders-block"', 'id="account-mindful"');
assert.ok(reminders.includes('id="reminders"'));
assert.ok(reminders.includes('data-time type="time"'));
assert.ok(reminders.includes('id="remind-save"'));
assert.ok(reminders.includes("Save reminders"));
assert.ok(reminders.includes('id="account-reminders-push"'));
assert.ok(!reminders.includes('id="account-spotify"'));

const profile = between('id="account-profile"', 'id="account-practice-block"');
assert.ok(profile.includes('id="account-initial"'));
assert.ok(profile.includes('id="account-name"'));
assert.ok(!profile.includes('id="account-altar"'), "the altar has its own section");
assert.ok(!profile.includes('id="altar-file"'));
assert.ok(!profile.includes('id="account-logout"'), "log out is not inside Profile");
assert.ok(profile.includes('id="account-sync"'));
assert.ok(!profile.includes(">Log out<"));
assert.ok(!profile.includes('id="practice-export"'), "export stays with the practice record");
assert.ok(!profile.includes('id="practice-erase"'));

const settings = between('id="account-settings"', "</details>\n    <div id=\"account-logout\"");
assert.ok(settings.includes("<h3>Spotify</h3>"));
assert.ok(settings.includes("<h3>Privacy</h3>"));
assert.ok(settings.includes('id="install-app"'));
assert.ok(settings.includes('id="account-wipe"'));
assert.ok(!settings.includes('id="motion-inner"'), "petal motion left Settings");
assert.ok(!settings.includes('id="motion-outer"'));
assert.ok(!settings.includes('id="motion-heart"'), "the heart mark is gone from Settings");
assert.ok(!settings.includes(">Triangles<"));
assert.ok(!settings.includes(">Pentagram<"));
assert.ok(!settings.includes("Heart chakra"));
assert.ok(settings.indexOf("<h3>Spotify</h3>") < settings.indexOf("<h3>Privacy</h3>"));
assert.ok(!settings.includes('id="account-logout"'), "log out is not inside Settings");
assert.ok(!settings.includes('id="remind-save"'));
assert.ok(!settings.includes('id="account-name"'));
const altar = between('id="account-altar-block"', 'id="account-profile"');
assert.ok(altar.includes('id="account-altar"'));
assert.ok(altar.includes('id="altar-file"'));
assert.ok(altar.includes("meditation, enlightenment, power, and peace"));
const logoutAt = page.indexOf('id="account-logout"');
assert.ok(logoutAt > page.indexOf('id="account-settings"'), "log out sits below Settings");
assert.ok(logoutAt < page.indexOf('<div id="gate">'));
assert.ok(page.includes('class="account-signout"'));
assert.ok(page.includes('id="account-leave">Log out</button>'));
assert.strictEqual(page.includes("glowbar"), false);
assert.strictEqual(page.includes('id="glow"'), false);

assert.strictEqual(page.includes('data-fold="practice" open'), false, "every drawer starts closed");
assert.ok(account.includes("window.closeAccountFolds = closeFolds"));
assert.ok(page.includes('if (name === "account" && window.closeAccountFolds) window.closeAccountFolds();'));
const menuAt = page.indexOf('const menuAccount = document.getElementById("menu-account")');
const menuHandler = page.slice(menuAt, menuAt + 280);
assert.ok(menuHandler.includes('roomFocus = "account-settings"'), "Albums Settings opens the Settings fold");
assert.ok(menuHandler.includes('showRoom("account")'));
const showRoomFn = page.slice(page.indexOf("function showRoom"), page.indexOf("window.showRoom = showRoom"));
assert.ok(showRoomFn.indexOf("closeAccountFolds") < showRoomFn.indexOf("const focus = roomFocus"));
assert.ok(account.includes('data-fold="devices"'), "a practice link still opens Linked devices");
assert.ok(!account.includes("yantra.account.folds"), "drawers are not remembered");
assert.ok(!account.includes("account-initial"), "the profile mark is the yantra, never an initial");
assert.ok(page.includes('closest("details")'), "a deep link opens the section that holds it");
assert.ok(sync.includes("yantraCameFromPracticeLink"));
assert.ok(account.includes("yantraCameFromPracticeLink"));
assert.ok(page.includes('class="back" type="button" data-room="home" aria-label="Back"'));
const corner = between('id="account-corner"', "</button>");
assert.ok(corner.includes('class="yantra-mark"'), "the corner button is the yantra, not a name or You");
assert.ok(!/>You</.test(page), "no You label anywhere on the page");
assert.ok(!page.includes('id="listen"'), "the shelf has no Listen on / Connected row");
assert.ok(page.includes('id="account-spotify-connect"'), "Spotify still connects from Settings");
assert.ok(!account.includes("textContent = mark"), "the corner never shows a profile initial");
assert.ok(page.includes("grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr)"), "the iPad shelf stays two columns");
assert.ok(account.includes("mindfulness: mindfulness"), "export keeps the mindfulness total beside the formal record");
assert.ok(account.includes("YantraListening"));
assert.ok(page.includes("YantraListening.erase()"));
assert.strictEqual(page.includes('id="account-bell"'), false);
assert.strictEqual(page.includes('id="account-glow"'), false);

console.log("account-page.test.js ok");
