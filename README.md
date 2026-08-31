<img src="site/public/favicon.svg" width="48" height="48" alt="BrowserUtils blue shield">

# BrowserUtils.

the internet. useful until it isn't.<br>
BrowserUtils adds a few brakes.

[download the latest release](https://github.com/ericfzhu/browserutils/releases/latest) / [read the changelog](CHANGELOG.md)

## enough youtube.

Set a daily limit for a site. BrowserUtils watches active browsing time and blocks the page when the time is gone. Limits reset with the next local day.

## the day, measured.

BrowserUtils records the active tab in the focused Chrome window. Overview shows today. Metrics keeps the longer view: sites, categories, browsing sessions, blocks, and focus history.

Background tabs do not quietly collect time. Chrome losing focus pauses general tracking. Media playback can continue to count while it is genuinely active.

## focus. now in minutes.

Start a focus session for one blocked-site folder or every blocked site at once. Pick a duration, close the dashboard, and get on with it.

## blocked means blocked.

Rules can cover a domain, subdomain, or path. A block can be always on, scheduled, protected by a password, or run for a fixed amount of time.

Lockdown Mode protects changes with a master password or authenticator app. Overlapping rules are all evaluated, so an inactive rule cannot hide an active one.

## small extras.

- Paste Anyway restores pasting on sites that interfere with it.
- Video download tools handle supported Blob-backed and Reddit media.
- Complete encrypted backups preserve settings, protected rules, authenticator setup, and usage history.

These features stay dormant until enabled.

## under the panel.

| | |
| --- | --- |
| platform | Chrome Extension Manifest V3 |
| interface | React, TypeScript, Tailwind CSS |
| tracking | focused-window active tab time |
| records | one local storage key per day |
| storage | `chrome.storage.local` |
| live state | `chrome.storage.session` |
| backups | complete password-encrypted export |
| account | none |
| subscription | none |

## install.

1. Download `browserutils-v1.0.1.zip` from the [latest GitHub release](https://github.com/ericfzhu/browserutils/releases/latest).
2. Extract the archive somewhere permanent.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.

Chrome keeps the extension ID stable because the manifest includes the public key used by BrowserUtils releases.

## build it.

Requires Yarn 4.

```bash
yarn install
yarn build
yarn test:run
```

The extension build is written to `dist/`. Load that directory from `chrome://extensions` while developing.

For watch mode:

```bash
yarn dev
```

## the public face.

The interactive showcase lives in `site/`.

```bash
yarn site:dev
yarn site:build
```

It is configured as Cloudflare Workers Static Assets in `wrangler.jsonc`. Production deploys are triggered from the connected GitHub repository with:

```text
Build command:          yarn site:build
Deploy command:         yarn wrangler deploy
Preview deploy command: yarn wrangler versions upload
```

Run the production Worker locally with:

```bash
yarn site:worker:dev
```

## privacy.

Browsing records, settings, password hashes, and authenticator secrets stay in browser storage. Backup files are only created when you explicitly export them. BrowserUtils has no account system and sends no usage data to an external service.

## release.

Installable builds are published as versioned ZIP files under [GitHub Releases](https://github.com/ericfzhu/browserutils/releases). Build output stays out of Git history.
