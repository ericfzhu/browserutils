# BrowserUtils

A Chrome extension for tracking website usage and blocking distracting sites.

## Features

### Time Tracking
- Tracks time spent on each website with per-domain breakdown
- Accurate tracking using content script heartbeats (15-second intervals)
- Tracks only the active tab in the focused Chrome window and pauses when Chrome loses focus
- Continues tracking during media playback (e.g., YouTube videos)
- Daily, weekly, and monthly statistics with visual breakdowns

### Site Blocking
- Block access to distracting websites by domain pattern
- Supports wildcards (e.g., `*.reddit.com`)
- Multiple unlock methods:
  - Password protection
  - Timer-based unlock (temporary access)
  - Schedule-based blocking (block during specific hours/days)

### Dashboard
- Overview of daily activity
- Detailed metrics with charts
- Manage blocked sites
- Configure settings (tracking, blocking, data retention)
- Create and restore password-encrypted backups
- Set master password for protected sites

## Installation

1. Download `browserutils-v1.0.0.zip` from the [latest GitHub Release](https://github.com/ericfzhu/browserutils/releases/latest)
2. Extract the zip file
3. Open Chrome and go to `chrome://extensions`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

## Development

If you want to modify the extension:

```bash
# Install dependencies
yarn install

# Build for production
yarn build
```

Load the generated `dist` folder from `chrome://extensions` while developing.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Chrome Extension Manifest V3

## Privacy

All data is stored locally in your browser using `chrome.storage.local`. No data is sent to external servers.
