# Changelog

All notable changes to BrowserUtils will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-01-08

### Added
- Path-based site blocking - block specific URL paths like `reddit.com/r/funny/*`
- URL input normalization - automatically strips `https://` and formats patterns correctly

### Changed
- Entering `https://example.com/` now normalizes to `example.com`
- Entering `https://example.com/path/` now normalizes to `example.com/path/*`

## [0.8.2] - 2026-01-08

### Added
- Folders can now be reordered by dragging in Blocked Sites
- Sites can now be reordered within folders by dragging in Blocked Sites

### Changed
- Folder headers in Blocked Sites can now be clicked anywhere to expand/collapse (not just the chevron)

### Fixed
- Fixed missing gap between YouTube Channels section and other sections in Overview and Metrics tabs
- Fixed drag and drop not working properly when folders are collapsed in Blocked Sites
- Improved visual distinction between folder headers and site rows in Blocked Sites

## [0.8.1] - 2026-01-07

### Added
- Dark mode with Light, Dark, and System theme options

### Fixed
- YouTube tracking improvements

## [0.6.1] - 2026-01-07

### Changed
- Activity timeline now merges overlapping sessions for cleaner visualization

## [0.6.0] - 2026-01-07

### Added
- Site Categories - domains automatically categorized (Social Media, Entertainment, News, Shopping, Productivity, Development, Education, Communication)
- Category breakdown view in Metrics page showing time spent per category
- Category summary on Overview page
- Pre-built category mappings for ~300 popular domains
- User can override category assignments
- Daily Time Limits - set maximum daily browsing time per site
- New "Daily Limits" page accessible from sidebar navigation
- Configurable bypass options per limit: wait timer, password, or no bypass
- Limits approaching warning on Overview page (shows limits >70% used)
- Blocked page shows daily limit exceeded UI with time info and bypass options

## [0.5.1] - 2026-01-07

### Fixed
- Sidebar now stays fixed while scrolling, keeping version and "What's New" visible on all pages
- Back button on changelog page now returns to previous page instead of settings

## [0.5.0] - 2026-01-07

### Added
- Multi-window session tracking - now tracks activity across all visible browser windows simultaneously
- Activity Timeline visualization showing when sites were visited throughout the day
- Timeline preview on Overview page with link to full view
- Full timeline on Metrics page with:
  - Date navigation (prev/next day arrows)
  - Calendar picker for jumping to any date
  - Date range mode to view aggregated data across multiple days
  - Slide animations when navigating between dates
- Sessions are recorded with start/end timestamps and window IDs
- Time calculations now use interval union to avoid double-counting overlapping sessions
- Multiple windows indicator (layers icon) on timeline rows

### Changed
- Refactored time tracking from single-session to multi-session model
- "Time today" now accurately represents union of all browsing sessions

## [0.4.2] - 2026-01-07

### Added
- Smooth expand/collapse animation for folder sections using CSS grid transitions

## [0.4.1] - 2026-01-07

### Changed
- New tab greeting is now deterministic based on day of year (same greeting all day)

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

### Fixed
- Scheduled blocking now correctly checks if current time is within the blocking window
- Sites with service workers that bypass declarativeNetRequest are now blocked via content script fallback

### Changed
- Content script now runs at document_start for faster blocking
- Blocked attempts are tracked from content script fallback

## [0.3.1] - 2026-01-07

### Fixed
- Blocked site metrics now properly increment (counter was broken due to redirect timing)

## [0.3.0] - 2026-01-07

### Added
- Content script heartbeat system for accurate time tracking
- Page Visibility API integration for true visibility detection
- Session state persistence across service worker restarts
- Media detection - continues tracking when audio is playing (e.g., YouTube)

### Fixed
- UTC date bug - all date calculations now use local timezone
- Maximum tracking data loss reduced from 60+ seconds to ~15 seconds

## [0.2.1] - 2026-01-07

### Changed
- Quick links now auto-fetch favicons from Google's favicon service
- Simplified add link modal - just enter URL
- Auto-extract site name from domain
- Enter key submits the add link form

## [0.2.0] - 2026-01-07

### Added
- Custom new tab page with:
  - Time-based greetings with varied phrases
  - Personalized name display (configurable in settings)
  - Large clock with date
  - Quick links with emoji icons
  - Today's browsing stats
- Display name setting for new tab greeting
- Quick links management

## [0.1.1] - 2026-01-06

### Added
- Percentage display in daily breakdown hover tooltip
- Included dist folder for easy extension loading

## [0.1.0] - 2026-01-06

### Added
- Initial release
- Website time tracking with per-site breakdowns
- Site blocking with multiple unlock methods:
  - Password protection
  - Timer-based temporary unlock
  - Schedule-based blocking
- Dashboard with Overview and Metrics pages
- Popup for quick stats access
- Blocked page with unlock options
- Settings for tracking, blocking, theme, and data retention
- Idle detection to pause tracking when inactive
