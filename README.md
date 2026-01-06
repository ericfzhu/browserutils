# BrowserUtils

A Chrome extension for tracking website usage and blocking distracting sites.

## Features

### Time Tracking
- Tracks time spent on each website with per-domain breakdown
- Accurate tracking using content script heartbeats (15-second intervals)
- Respects page visibility (pauses when tab is hidden or minimized)
- Continues tracking during media playback (e.g., YouTube videos)
- Daily, weekly, and monthly statistics with visual breakdowns

### Site Blocking
- Block access to distracting websites by domain pattern
- Supports wildcards (e.g., `*.reddit.com`)
- Multiple unlock methods:
  - Password protection
  - Timer-based unlock (temporary access)
  - Schedule-based blocking (block during specific hours/days)

### Custom New Tab
- Replaces Chrome's new tab page
- Shows current time with personalized greeting
- Quick links with auto-fetched favicons
- Today's browsing stats at a glance

### Dashboard
- Overview of daily activity
- Detailed metrics with charts
- Manage blocked sites
- Configure settings (tracking, blocking, data retention)
- Export/import data
- Set master password for protected sites

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Development

If you want to modify the extension:

```bash
# Install dependencies
yarn install

# Build for production
yarn build
```

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Chrome Extension Manifest V3

## Privacy

All data is stored locally in your browser using `chrome.storage.local`. No data is sent to external servers.
