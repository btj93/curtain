# Curtain

Covers a web page with a convincing work screen, on a hotkey or the moment you look away,
while the page keeps running underneath.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. **Load unpacked**, and select this folder.
3. Open **Details → Extension options** and add a profile.

Works in any Chromium browser. Not Safari, which blocks dynamic favicon changes.

## Profiles

A profile is *which sites* × *which cover* × *how it behaves*. The first enabled profile
matching a page wins, so ordering is precedence. Paste any page URL and it is reduced to
its site. Subdomains are separate entries.

| Setting | Default | What it does |
| --- | --- | --- |
| Keep the page running when unfocused | on | Spoofs page visibility, so a site that pauses itself on blur keeps going. |
| Cover automatically when I look away | on | Drops the cover the instant real focus leaves. Off means hotkey only. |
| Mute the tab while covered | on | No audio leaks out of a window pretending to be something else. |
| See-through cover while I'm looking | on | A faint cover you can click straight through. |
| See-through cover opacity | 80% | Higher is more hidden; lower lets you see the page better. |

**Alt+Shift+W** locks and unlocks the cover. Rebind it at `chrome://extensions/shortcuts`,
worth doing on Windows where `Alt+Shift` is also the OS keyboard-layout switcher.

Curtain asks for access only to the sites your profiles name. It never requests all-sites
access.

## The limit: keep-alive cannot beat Chrome's own throttling

Keep-alive defeats a *site's* pause-on-blur. It cannot override Chrome's engine-level
throttling, which suspends timers and animation for a hidden, covered, or minimised tab
based on its **real** on-screen state. A value spoofed in JavaScript never reaches it.

| Window state | Keeps running |
| --- | --- |
| Visible but unfocused (you're working in a window beside it) | Yes |
| Background tab, fully covered, or minimised | No |
| Screen locked or display asleep | No |

Keep the window visible on an awake screen. Launching Chrome with
`--disable-background-timer-throttling --disable-renderer-backgrounding
--disable-backgrounding-occluded-windows --disable-features=IntensiveWakeUpThrottling`
lifts the timer half of this for the whole session, but not `requestAnimationFrame`, and
Chrome reads those switches only at startup.

## Tests

```sh
node --test
```

Covers the pure logic: mode decisions, origin normalisation and profile selection, skin
resolution, and the registration set. DOM, focus, and permission behaviour can only be
checked in a real browser.

## License

Apache 2.0. See [LICENSE](LICENSE).
