/* node web/fullscreen.test.mjs
   The Omarchy sit launcher and the installed-app fullscreen contract. */
import assert from "assert";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = fs.readFileSync(path.join(root, "deploy/omarchy/yantra-sit"), "utf8");
const note = fs.readFileSync(path.join(root, "deploy/omarchy/README.md"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const web = fs.readFileSync(path.join(root, "web/web.js"), "utf8");
const page = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "web/manifest.webmanifest"), "utf8"));
const desktop = fs.readFileSync(path.join(root, "yantra.py"), "utf8");

/* Chromium's --app class: chrome- + host + "__" + path (slashes at the ends
   dropped, other slashes become "_") + "-" + profile. Chrome 156 on X11
   reports the instance as host__path, without the chrome-/-Default wrapper
   Wayland uses. Teams and Zoom are the shapes Omarchy already matches. */
function chromiumAppClass(url, profile = "Default") {
  const parsed = new URL(url);
  let rest = parsed.pathname;
  if (rest.startsWith("/")) rest = rest.slice(1);
  if (rest.endsWith("/")) rest = rest.slice(0, -1);
  rest = rest.replaceAll("/", "_");
  return `chrome-${parsed.host}__${rest}-${profile}`;
}

const yantraClass = chromiumAppClass("https://yantramedi.app/web/");
assert.strictEqual(yantraClass, "chrome-yantramedi.app__web-Default");
assert.strictEqual(chromiumAppClass("https://yantramedi.app/web"), "chrome-yantramedi.app__web-Default");
assert.strictEqual(chromiumAppClass("https://example.com/web/"), "chrome-example.com__web-Default");
assert.strictEqual(chromiumAppClass("https://example.com/wc/home"), "chrome-example.com__wc_home-Default");
assert.strictEqual(chromiumAppClass("https://teams.microsoft.com/"), "chrome-teams.microsoft.com__-Default");
assert.strictEqual(chromiumAppClass("https://app.zoom.us/wc/home"), "chrome-app.zoom.us__wc_home-Default");
assert.strictEqual(chromiumAppClass("https://youtube.com/"), "chrome-youtube.com__-Default");

assert.ok(script.startsWith("#!/bin/sh"));
assert.ok(script.includes('URL="https://yantramedi.app/web/"'));
assert.ok(script.includes(yantraClass));
assert.ok(script.includes("--app="));
assert.ok(script.includes("--ozone-platform=wayland"));
assert.ok(script.includes("--new-window"));
assert.ok(script.includes("--start-fullscreen"));
assert.ok(script.includes('name = "yantra-sit-fullscreen"'));
assert.ok(script.includes("fullscreen = true"));
assert.ok(script.includes('mode = "fullscreen"'));
assert.ok(script.includes('action = "set"'));
assert.ok(script.includes("yantramedi.app__web"));
const scriptCode = script.replace(/^#.*$/gm, "");
assert.strictEqual(scriptCode.includes("github.io"), false);
assert.strictEqual(scriptCode.includes("yantra.py"), false, "the launcher does not start the local server");
assert.ok(note.includes(yantraClass));
assert.ok(note.includes("hyprctl clients"));
assert.ok(note.includes('o.window("^(chrome|chromium|google-chrome|brave|brave-browser)-yantramedi\\\\.app__web_?-",'));
assert.ok(note.includes("fullscreen = true"));
assert.ok(note.includes('o.bind("SUPER + SHIFT + Y"'));
assert.ok(readme.includes("deploy/omarchy/"));
assert.ok(readme.includes("yantra-sit"));

const classLine = script.match(/^CLASS='(.+)'$/m);
assert.ok(classLine, "the launcher keeps the class pattern on one line");
const classRe = new RegExp(classLine[1]);
assert.ok(classRe.test(yantraClass));
assert.ok(classRe.test("chrome-yantramedi.app__web_-Default"), "a build that keeps the trailing slash as an underscore still matches");
assert.ok(classRe.test("brave-yantramedi.app__web_-Profile_1"));
assert.ok(classRe.test("google-chrome-yantramedi.app__web_-Default"));
assert.strictEqual(classRe.test("chrome-youtube.com__-Default"), false);
assert.strictEqual(classRe.test("chromium"), false);

assert.strictEqual(manifest.display, "standalone");
assert.deepStrictEqual(manifest.display_override, ["fullscreen"]);
assert.ok(page.includes('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"'));
assert.ok(page.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"'));
assert.strictEqual(web.includes("getUserMedia"), false);

const enterAt = web.indexOf("function enterFullscreen()");
const leaveAt = web.indexOf("function leaveFullscreen()");
const appAt = web.indexOf("function appDisplay()");
assert.ok(appAt !== -1 && enterAt !== -1 && leaveAt !== -1);
assert.ok(web.includes("if (appDisplay()) return;"));
assert.ok(web.includes('if (window.matchMedia("(display-mode: fullscreen)").matches) return;'));
assert.strictEqual(web.split("requestFullscreen()").length - 1, 1, "fullscreen is requested in one place, on a sit, not when the page opens");
assert.ok(web.includes("navigator.standalone === true"));
for (const mode of ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"]) {
  assert.ok(web.includes(`(display-mode: ${mode})`), mode);
}
assert.ok(web.indexOf("enterFullscreen();") < web.indexOf("function sit(on)"));
assert.ok(web.includes("leaveFullscreen();"));
assert.ok(!/^\s*enterFullscreen\(\);/m.test(web.slice(0, appAt)));

assert.ok(desktop.includes('"--class=yantra"'));
assert.ok(desktop.includes("fullscreen = true"));
assert.ok(desktop.includes('mode = "fullscreen"'));
assert.ok(desktop.includes('action = "set"'));

const mode = fs.statSync(path.join(root, "deploy/omarchy/yantra-sit")).mode;
assert.ok(mode & 0o111, "yantra-sit is executable");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yantra-sit-"));
const log = path.join(tmp, "hyprctl.log");
fs.writeFileSync(path.join(tmp, "hyprctl"), `#!/bin/sh\nprintf '%s\\n' "$2" >> ${JSON.stringify(log)}\n`);
fs.writeFileSync(path.join(tmp, "chromium"), "#!/bin/sh\nprintf '%s\\n' \"$*\" > " + JSON.stringify(path.join(tmp, "browser.args")) + "\n");
fs.chmodSync(path.join(tmp, "hyprctl"), 0o755);
fs.chmodSync(path.join(tmp, "chromium"), 0o755);

const child = spawn(path.join(root, "deploy/omarchy/yantra-sit"), {
  env: { ...process.env, PATH: `${tmp}:/usr/bin:/bin` },
  stdio: ["ignore", "pipe", "pipe"],
});
const stderr = [];
child.stderr.on("data", (chunk) => stderr.push(chunk));
const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    reject(new Error("yantra-sit did not exit"));
  }, 5000);
  child.on("exit", (status) => {
    clearTimeout(timer);
    resolve(status);
  });
});
assert.strictEqual(code, 0, Buffer.concat(stderr).toString());
const args = fs.readFileSync(path.join(tmp, "browser.args"), "utf8");
assert.ok(args.includes("--app=https://yantramedi.app/web/"));
assert.ok(args.includes("--ozone-platform=wayland"));
assert.ok(args.includes("--start-fullscreen"));
assert.strictEqual(args.includes("--class="), false, "the app id comes from the URL, not --class");
const evals = fs.readFileSync(log, "utf8");
assert.ok(evals.includes('name = "yantra-sit-fullscreen"'));
assert.ok(evals.includes("fullscreen = true"));
assert.ok(evals.includes(classLine[1]));
await new Promise((resolve) => setTimeout(resolve, 1200));
const settled = fs.readFileSync(log, "utf8");
assert.ok(settled.includes('mode = "fullscreen"'));
assert.ok(settled.includes('action = "set"'));
