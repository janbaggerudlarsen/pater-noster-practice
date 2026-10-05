# Pater Noster Practice (PWA)

Static, offline-capable web app for practising the Latin Pater Noster. No build step, no dependencies,
no cookies or trackers. Relative paths throughout, so it works at a domain root or a sub-path (e.g. GitHub Pages
`https://<user>.github.io/pater-noster-practice/`). Needs HTTPS for the service worker (offline mode).

- Text: `sentences.js` (verbatim from `../pater-noster/sentences.md`, the on-screen text of the
  Cor Fidelis tutorial, https://youtu.be/vrWrFdjPp5g).
- Audio: 96 kbps mono re-encodes of `../pater-noster/` (originals untouched).
- Offline: `sw.js` precaches everything listed in `assets.js`; bump `APP_VERSION` there after changes.

## Deploy to GitHub Pages (once `gh auth login` has been done on the box)

    cd /workspace/catholicism/pater-noster-app
    git init -b main && git add . && git commit -m "Pater Noster practice app"
    gh repo create pater-noster-practice --public --source . --push
    gh api -X POST repos/{owner}/pater-noster-practice/pages -f "source[branch]=main" -f "source[path]=/"

Then open https://<user>.github.io/pater-noster-practice/ after a minute or two.

## Local preview

    node ../pater-noster-server/serve.js /workspace/catholicism/pater-noster-app 8766

## Visit counter

`counter.js` adds +1 to plain numbers on the free Abacus API (https://abacus.jasoncameron.dev), namespace
`jbl-pater-noster`: `opens` (app opens, reloads within 30 min count once), `devices` (first open on a device),
`d-YYYYMMDD` (opens per day, Europe/Warsaw) and `v-YYYYMMDD` (visitors per day). No cookies, IDs or referrer
are sent; it only runs on janbaggerudlarsen.github.io. View the numbers at `stats.html`, which also has a
"Don't count this device" switch.
