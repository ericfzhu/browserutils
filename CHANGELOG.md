# Changelog

This file tracks notable BrowserUtils changes.

It follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and uses 0.x.0 release versions. Each published release increments x.

## [0.40.0] - 2026-06-27

### Added
- Paste Anyway lets you paste into text fields on sites that block paste events
- Settings include a Paste Anyway toggle that applies as soon as it changes

### Changed
- Settings controls autosave instead of relying on repeated Save Settings buttons
- Changelog history uses one release-numbering scheme: each release increments the middle number

## [0.39.0] - 2026-06-22

### Changed
- General browser usage tracking keeps active tab sessions in temporary session storage instead of local storage
- Heartbeats refresh live tracking state without writing finalized stats on every tick, which cuts down storage writes while keeping minute-level saves
- Recorded usage intervals are compacted as they are saved, and visits count once per browsing session instead of once per heartbeat segment

## [0.38.0] - 2026-06-22

### Changed
- Cleaned up the dashboard, popup, new tab, and blocked page visuals with softer surfaces, clearer spacing, and steadier live numbers
- Daily limits on the Overview page separate exceeded limits from limits that are close to their threshold

## [0.37.0] - 2026-05-28

### Added
- shadcn/ui primitives and Tailwind semantic color tokens across the extension UI
- Color Theme setting with Monochrome and Classic Blue palette options

### Changed
- Updated popup, new tab, blocked page, settings, daily limits, category controls, dashboard shell, and lockdown authentication UI to use the new shared component system
- Unified app chrome around semantic theme tokens while preserving category, chart, warning, and status colors in Monochrome mode

## [0.36.0] - 2026-05-24

### Fixed
- Blocked pages resolve focus mode before rendering, so the generic blocked message no longer flashes first

## [0.35.0] - 2026-03-30

### Fixed
- Daily limits normalize pasted URLs to the tracked domain format, keeping limit matching and reported usage aligned

## [0.34.0] - 2026-03-30

### Changed
- Active focus sessions use the same extension controls as new sessions: 30m, 1h, 1.5h presets, 30-minute steps, and custom minutes

## [0.33.0] - 2026-03-30

### Changed
- Focus sessions use 30m, 1h, and 1.5h presets, 30-minute step controls, and a custom minutes input

## [0.32.0] - 2026-03-23

### Added
- The extension popup shows the active focus target and remaining time

## [0.31.0] - 2026-03-09

### Added
- Lockdown Mode can use an authenticator app instead of the master password
- Authenticator setup shows a QR code for standard TOTP enrollment

### Changed
- Settings let you configure both master password and authenticator app, then choose which method Lockdown Mode requires

### Fixed
- Lockdown-protected actions use the selected authentication method immediately instead of waiting for a reload

## [0.30.0] - 2026-03-09

### Added
- Global Focus mode on the Blocked Sites page blocks every blocked site at once, including uncategorized sites

### Changed
- Blocked pages show focus mode messaging before the site's normal block reason when a focus session is active

### Fixed
- Prevented stale tracking sessions from resuming across sleep, lid-close, restart, or next-day login gaps and logging phantom overnight time

## [0.29.0] - 2026-02-20

### Changed
- Reduced background storage reads by caching settings in the service worker for hot tracking and blocking paths
- Timeline rows precompute per-domain window counts instead of filtering sessions during each render

### Fixed
- Session recording splits cross-midnight intervals into per-day segments
- Scheduled blocking handles overnight windows, such as 23:00 to 06:00

## [0.28.0] - 2026-02-19

### Changed
- Tracking requires fresh content-script heartbeats, so hidden or stale tabs stop counting
- Periodic session saves record only up to the last confirmed activity instead of assuming the tab stayed visible

### Fixed
- Multi-window tracking ends stale sessions quickly when windows are minimized, hidden, or no longer sending visibility heartbeats
- Two visible windows on the same site track independently while dashboard totals still avoid double-counting overlap

## [0.27.0] - 2026-01-16

### Fixed
- Minimized windows stop tracking immediately on focus change instead of waiting for the next periodic check
- Sessions cap recorded time at last confirmed activity plus 30 seconds, avoiding hours of phantom time if alarms fail
- Session end events no longer record the same session twice when they fire at the same time

## [0.26.0] - 2026-01-10

### Added
- Focus sessions for blocking every site in a folder with one shared timer
- Focus button on folder headers opens modal to set duration
- Quick duration presets (15m, 30m, 1h, 2h) in focus modal
- Focus sessions override individual site settings and block everything in the folder

### Changed
- Timer blocking is temporary. Sites stay accessible until you start the timer
- Timer sites show "Disabled" button that starts blocking when clicked, "Stop" to end early
- Active timer blocks display remaining time with live countdown in dashboard and blocked page
- Time remaining appears to the left of the block type label
- Enable All and Disable All on folders start or clear timer blocks for timer-type sites
- Status buttons use the same width for Blocking, Disabled, and Stop states

### Fixed
- Timer duration input can be cleared before typing a new value
- Timer blocks start immediately when clicking Disabled or Enable All

## [0.25.0] - 2026-01-10

### Changed
- Compact session storage format reduces data size by ~65%
- Faster loading of Categories and Metrics pages by loading summary data first
- Timeline and YouTube data load only for the selected date range
- One-time migration converts existing data to compact format on update

## [0.24.0] - 2026-01-10

### Added
- Categories page showing sites grouped by category with time spent
- Collapsible categories
- Expand all/Collapse all button for quick category management
- Select mode for bulk moving multiple sites between categories
- Drag and drop to reorder categories (except "Other" which stays at the bottom)
- Drag and drop sites between categories to recategorize them
- Drop sites onto collapsed categories
- Custom categories with names and colors
- Drag a site to "Drop here to create new category" zone to create a category for it
- Rename built-in categories (original names preserved, can reset anytime)
- Delete custom categories (sites return to their default category)
- Default badge on built-in categories to distinguish from custom ones

## [0.23.0] - 2026-01-10

### Added
- Day/Week/Month/Custom date selector on Metrics page with animated sliding indicator
- Custom date range picker with calendar and presets (Week to date, Month to date, Last 7 days, Last 30 days)
- Expandable/collapsible Activity timeline and YouTube channels sections on Metrics page
- Clickable domain links in Metrics page Activity timeline and Top sites
- Anchor navigation from Overview "View all" links to specific sections on Metrics page

### Changed
- Overview and Metrics labels use sentence case
- Consistent spacing between sections on Overview and Metrics pages
- Activity timeline shows day markers instead of hour markers for multi-day date ranges

## [0.22.0] - 2026-01-10

### Added
- GitHub link in Settings page under new About section

### Fixed
- Blocked pages open when a link to a blocked site comes from another website instead of showing Chrome ERR_BLOCKED_BY_CLIENT

## [0.21.0] - 2026-01-09

### Added
- Clickable YouTube channel names in Overview and Metrics
- Clickable site URLs in Overview

### Fixed
- YouTube session data survives overlaps between YouTube tracking and site tracking
- YouTube channel URLs are captured from video pages

## [0.20.0] - 2026-01-09

### Added
- Lockdown Mode requires the master password to disable blocking, remove sites, or disable limits
- Disabling blocking from the popup requires the master password when one is set
- 5-minute authentication session after entering password for uninterrupted changes
- Session automatically clears when dashboard is closed
- New shield icon as extension favicon and toolbar icon

## [0.19.0] - 2026-01-08

### Added
- Path-based site blocking for URL paths like reddit.com/r/funny/*
- URL input normalization strips https:// and formats patterns correctly

### Changed
- https://example.com/ normalizes to example.com
- https://example.com/path/ normalizes to example.com/path/*

## [0.18.0] - 2026-01-08

### Added
- Folder reordering by drag and drop in Blocked Sites
- Site reordering within folders by drag and drop in Blocked Sites

### Changed
- Clicking anywhere on a folder header expands or collapses it

### Fixed
- Missing gap between YouTube Channels and other sections in Overview and Metrics tabs
- Drag and drop works when folders are collapsed in Blocked Sites
- Folder headers and site rows are easier to tell apart in Blocked Sites

## [0.17.0] - 2026-01-07

### Changed
- YouTube tracking uses the Media Session API for channel detection
- YouTube watch time tracks playback (play/pause) instead of page open time
- YouTube continues tracking when tab is in background (if video is still playing)
- Overview progress bars are relative to the top item

### Fixed
- YouTube channel detection works across video pages
- Channel changes are no longer detected falsely when channelId appears intermittently

## [0.16.0] - 2026-01-07

### Added
- YouTube Channel Tracking for videos and Shorts
- New setting to enable/disable YouTube tracking (off by default)
- YouTube Channels section in Overview showing top watched channels
- YouTube Channels section in Metrics with full channel breakdown

## [0.15.0] - 2026-01-07

### Added
- Dark mode support with three options: Light, Dark, and System (follows OS preference)
- Theme selector in Settings under new "Appearance" section
- Automatic theme switching when OS preference changes (in System mode)

### Fixed
- Blocked sites list follows the dark mode theme

## [0.14.0] - 2026-01-07

### Changed
- Activity timeline merges overlapping sessions

## [0.13.0] - 2026-01-07

### Added
- Site Categories automatically categorize domains (Social, Entertainment, News, etc.)
- Category breakdown view in Metrics and Overview pages
- Pre-built category mappings for ~300 popular domains
- Daily Time Limits for maximum daily browsing time per site
- New "Daily Limits" page for managing time limits
- Bypass options for daily limits: wait timer, password, or no bypass
- Limits approaching warning on Overview page
- Blocked page shows daily limit exceeded UI with bypass options

## [0.12.0] - 2026-01-07

### Fixed
- Sidebar stays fixed while scrolling, keeping version and "What's New" visible on all pages
- Back button on the changelog page returns to the previous page instead of Settings

## [0.11.0] - 2026-01-07

### Added
- Multi-window session tracking across all visible browser windows
- Activity Timeline visualization showing when sites were visited throughout the day
- Timeline preview on Overview page with link to full view
- Full timeline on Metrics page with date navigation and calendar picker
- Date range mode to view aggregated data across multiple days
- Slide animations when navigating between dates
- Multiple windows indicator on timeline rows

### Changed
- Refactored time tracking from single-session to multi-session model
- "Time today" represents the union of all browsing sessions, avoiding overlap double-counting

## [0.10.0] - 2026-01-07

### Added
- Smooth expand/collapse animation for folder sections

## [0.9.0] - 2026-01-07

### Changed
- New tab greeting is deterministic based on day of year

## [0.8.0] - 2026-01-07

### Added
- Folder organization for blocked sites
- Drag-and-drop support for moving sites between folders
- Collapsible folder sections
- Group-level enable/disable controls per folder
- Folder selector when adding/editing blocked sites

### Changed
- Blocked Sites page refactored from table to grouped folder view

## [0.7.0] - 2026-01-07

### Changed
- Content script runs at document_start for faster blocking
- Blocked attempts tracked from content script fallback

### Fixed
- Scheduled blocking checks whether the current time is inside the blocking window
- Sites with service workers that bypass declarativeNetRequest are blocked

## [0.6.0] - 2026-01-07

### Fixed
- Blocked site metrics increment correctly

## [0.5.0] - 2026-01-07

### Added
- Content script heartbeat system for accurate time tracking
- Page Visibility API integration for true visibility detection
- Session state persistence across service worker restarts
- Media detection keeps tracking active when audio is playing

### Fixed
- Date calculations use local timezone instead of UTC
- Maximum tracking data loss reduced from 60+ seconds to ~15 seconds

## [0.4.0] - 2026-01-07

### Changed
- Quick links auto-fetch favicons
- Simplified add link modal: just enter URL
- Auto-extract site name from domain

## [0.3.0] - 2026-01-07

### Added
- Custom new tab page with time-based greetings
- Personalized name display in settings
- Large clock with date on new tab
- Quick links with emoji icons

## [0.2.0] - 2026-01-06

### Added
- Percentage display in daily breakdown hover tooltip
- Included dist folder for easy extension loading

## [0.1.0] - 2026-01-06

### Added
- Website time tracking with per-site breakdowns
- Site blocking with password, timer, and schedule options
- Dashboard with Overview and Metrics pages
- Popup for quick stats access
- Settings for tracking, blocking, theme, and data retention
- Idle detection to pause tracking when inactive
