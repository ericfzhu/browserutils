# Changelog

All notable changes to BrowserUtils will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.5] - 2026-01-10

### Changed
- Compact session storage format reduces data size by ~65%
- Faster loading of Categories and Metrics pages by loading summary data first
- Timeline and YouTube data now loads on-demand for selected date range only
- One-time migration converts existing data to compact format on update

## [0.10.4] - 2026-01-10

### Added
- New Categories page - view all sites organized by category with time spent
- Collapsible categories - click to expand/collapse each category
- Expand all/Collapse all button for quick category management
- Select mode for bulk moving multiple sites between categories
- Drag and drop to reorder categories (except "Other" which stays at the bottom)
- Drag and drop sites between categories to recategorize them
- Drop sites onto collapsed categories
- Custom categories - create your own with custom names and colors
- Drag a site to "Drop here to create new category" zone to create a category for it
- Rename built-in categories (original names preserved, can reset anytime)
- Delete custom categories (sites return to their default category)
- Default badge on built-in categories to distinguish from custom ones

## [0.10.3] - 2026-01-10

### Added
- Day/Week/Month/Custom date selector on Metrics page with animated sliding indicator
- Custom date range picker with calendar and presets (Week to date, Month to date, Last 7 days, Last 30 days)
- Expandable/collapsible Activity timeline and YouTube channels sections on Metrics page
- Clickable domain links in Metrics page Activity timeline and Top sites
- Anchor navigation from Overview "View all" links to specific sections on Metrics page

### Changed
- Labels now use sentence case throughout Overview and Metrics pages
- Consistent spacing between sections on Overview and Metrics pages
- Activity timeline shows day markers instead of hour markers for multi-day date ranges

## [0.10.2] - 2026-01-10

### Added
- GitHub link in Settings page under new About section

### Fixed
- Fixed blocked page not showing when clicking links to blocked sites from other websites (was showing Chrome ERR_BLOCKED_BY_CLIENT error)

## [0.10.1] - 2026-01-09

### Added
- Clickable YouTube channel names - click a channel in Overview or Metrics to visit their page
- Site URLs in Overview are now clickable links

### Fixed
- Fixed race condition that could cause YouTube session data loss when tracking overlapped with site tracking
- Fixed YouTube channel URL not being captured from video pages

## [0.10.0] - 2026-01-09

### Added
- Lockdown Mode - require master password to disable blocking, remove sites, or disable limits
- Disabling blocking from popup now requires master password (if one is set)
- 5-minute authentication session after entering password for uninterrupted changes
- Session automatically clears when dashboard is closed
- New shield icon as extension favicon and toolbar icon

## [0.9.0] - 2026-01-08

### Added
- Path-based site blocking - block specific URL paths like reddit.com/r/funny/*
- URL input normalization - automatically strips https:// and formats patterns correctly

### Changed
- Entering https://example.com/ now normalizes to example.com
- Entering https://example.com/path/ now normalizes to example.com/path/*

## [0.8.2] - 2026-01-08

### Added
- Folders can now be reordered by dragging in Blocked Sites
- Sites can now be reordered within folders by dragging in Blocked Sites

### Changed
- Folder headers in Blocked Sites can now be clicked anywhere to expand/collapse

### Fixed
- Fixed missing gap between YouTube Channels section and other sections in Overview and Metrics tabs
- Fixed drag and drop not working properly when folders are collapsed in Blocked Sites
- Improved visual distinction between folder headers and site rows in Blocked Sites

## [0.8.1] - 2026-01-07

### Changed
- YouTube tracking now uses Media Session API for more reliable channel detection
- YouTube watch time now tracks actual playback (play/pause) instead of page open time
- YouTube continues tracking when tab is in background (if video is still playing)
- Overview progress bars now relative to top item for better visual comparison

### Fixed
- YouTube channel detection now works reliably across all video pages
- Fixed false "channel changed" detection when channelId was intermittently available

## [0.8.0] - 2026-01-07

### Added
- YouTube Channel Tracking - track which channels you watch on YouTube videos and Shorts
- New setting to enable/disable YouTube tracking (off by default)
- YouTube Channels section in Overview showing top watched channels
- YouTube Channels section in Metrics with full channel breakdown

## [0.7.0] - 2026-01-07

### Added
- Dark mode support with three options: Light, Dark, and System (follows OS preference)
- Theme selector in Settings under new "Appearance" section
- Automatic theme switching when OS preference changes (in System mode)

### Fixed
- Blocked sites list now properly follows dark mode theme

## [0.6.1] - 2026-01-07

### Changed
- Activity timeline now merges overlapping sessions for cleaner visualization

## [0.6.0] - 2026-01-07

### Added
- Site Categories - domains automatically categorized (Social, Entertainment, News, etc.)
- Category breakdown view in Metrics and Overview pages
- Pre-built category mappings for ~300 popular domains
- Daily Time Limits - set maximum daily browsing time per site
- New "Daily Limits" page for managing time limits
- Bypass options for daily limits: wait timer, password, or no bypass
- Limits approaching warning on Overview page
- Blocked page shows daily limit exceeded UI with bypass options

## [0.5.1] - 2026-01-07

### Fixed
- Sidebar now stays fixed while scrolling, keeping version and "What's New" visible on all pages
- Back button on changelog page now returns to previous page instead of settings

## [0.5.0] - 2026-01-07

### Added
- Multi-window session tracking - tracks activity across all visible browser windows
- Activity Timeline visualization showing when sites were visited throughout the day
- Timeline preview on Overview page with link to full view
- Full timeline on Metrics page with date navigation and calendar picker
- Date range mode to view aggregated data across multiple days
- Slide animations when navigating between dates
- Multiple windows indicator on timeline rows

### Changed
- Refactored time tracking from single-session to multi-session model
- "Time today" now represents union of all browsing sessions (no double-counting)

## [0.4.2] - 2026-01-07

### Added
- Smooth expand/collapse animation for folder sections

## [0.4.1] - 2026-01-07

### Changed
- New tab greeting is now deterministic based on day of year

## [0.4.0] - 2026-01-07

### Added
- Folder organization for blocked sites
- Drag-and-drop support for moving sites between folders
- Collapsible folder sections
- Group-level enable/disable controls per folder
- Folder selector when adding/editing blocked sites

### Changed
- Blocked Sites page refactored from table to grouped folder view

## [0.3.2] - 2026-01-07

### Changed
- Content script runs at document_start for faster blocking
- Blocked attempts tracked from content script fallback

### Fixed
- Scheduled blocking now correctly checks if current time is within the blocking window
- Sites with service workers that bypass declarativeNetRequest are now blocked

## [0.3.1] - 2026-01-07

### Fixed
- Blocked site metrics now properly increment

## [0.3.0] - 2026-01-07

### Added
- Content script heartbeat system for accurate time tracking
- Page Visibility API integration for true visibility detection
- Session state persistence across service worker restarts
- Media detection - continues tracking when audio is playing

### Fixed
- UTC date bug - all date calculations now use local timezone
- Maximum tracking data loss reduced from 60+ seconds to ~15 seconds

## [0.2.1] - 2026-01-07

### Changed
- Quick links now auto-fetch favicons
- Simplified add link modal - just enter URL
- Auto-extract site name from domain

## [0.2.0] - 2026-01-07

### Added
- Custom new tab page with time-based greetings
- Personalized name display in settings
- Large clock with date on new tab
- Quick links with emoji icons

## [0.1.1] - 2026-01-06

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
