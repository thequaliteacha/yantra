# Yantra on Omarchy

Super+Shift+Y does not run `yantra.py`. It runs `~/.local/bin/yantra-sit`,
which opens the sangha site in a Chromium app window. Chromium drops
`--start-fullscreen` on Wayland, so Hyprland has to fullscreen that window by
its class. The same pattern is a `fullscreen` window rule, as with other app
windows kept in `~/.config/hypr/looknfeel.lua`.

`yantra.py` is the local player (class `yantra`, at `http://127.0.0.1:8765`).
Leave that launcher as it is. This one is only the site.

## Install the launcher

From this repo:

```sh
install -m 755 deploy/omarchy/yantra-sit ~/.local/bin/yantra-sit
```

If Super+Shift+Y already runs `~/.local/bin/yantra-sit`, that copy is the whole
step. The next press opens `https://yantramedi.app/web/`.

If the bind is missing, add it to `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + SHIFT + Y", "Yantra", os.getenv("HOME") .. "/.local/bin/yantra-sit")
```

If that chord already does something else, check `omarchy menu keybindings --print`
and use `o.rebind` with the same arguments. Then `hyprctl reload`.

## Fullscreen rule

Each launch registers the rule and, if the window is still tiled, sets
fullscreen once. A copy in `looknfeel.lua` applies as the window maps, including
after a Hyprland reload, and sits with your other rules.

Paste into `~/.config/hypr/looknfeel.lua`:

```lua
-- https://yantramedi.app/web/  →  chrome-yantramedi.app__web-Default
-- Confirm with: hyprctl clients
o.window("^(chrome|chromium|google-chrome|brave|brave-browser)-yantramedi\\.app__web_?-", {
  name = "yantra-sit-fullscreen",
  fullscreen = true,
})
```

Then `hyprctl reload` and `hyprctl configerrors`.

Replace any older rule that still names `github.io`. That class belongs to the
previous address and does not match this window.

Omarchy also tiles Chromium app windows. This rule is loaded later, from your
own config and again at launch, so the sit window opens fullscreen.

## The class

Chromium names an `--app` window from the URL and the profile folder:

`chrome-` + host + `__` + path, with the slashes at both ends dropped and any
slash left in the middle turned into `_`, + `-` + profile.

| URL | Class on the Default profile |
| --- | --- |
| `https://teams.microsoft.com/` | `chrome-teams.microsoft.com__-Default` |
| `https://app.zoom.us/wc/home` | `chrome-app.zoom.us__wc_home-Default` |
| `https://yantramedi.app/web/` | `chrome-yantramedi.app__web-Default` |

A trailing slash is dropped, so `/web/` becomes `web`, not `web_`. The launcher
opens that exact URL so the class stays stable. A profile other than Default
changes only the suffix (`-Profile_1`). The rule above does not pin the suffix,
and it still matches a build that keeps the slash as a final underscore.

Chrome 156 on X11 reports the instance alone: `yantramedi.app__web`, with the
window class `google-chrome`. This launcher asks for Wayland, where Hyprland's
`class` is the longer app id in the table. Confirm on Omarchy:

```sh
hyprctl clients
```

Use the `class` line (and `initialClass`, if it differs). If it is not
`chrome-yantramedi.app__web-Default`, put the class you see into the rule.
`fullscreen: 2` means Hyprland already has the window fullscreen.
