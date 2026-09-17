# Dashboard consistency review

Reviewed and implemented 18 September 2026.

## Changes

- All seven routes use one page header: title, metadata/actions toolbar, subtle divider and consistent spacing. Removed decorative section labels. Settings uses the shared content width; “What’s New” matches its navigation label.
- A fixed-width sidebar and a single scrolling main area prevent width shifts. Route changes reset the main area's scroll position. Narrow windows use an icon sidebar with accessible link names.
- Page actions use shared buttons; theme choices now distinguish selected and unselected states. Theme, palette and date-period choices expose their selected state to assistive technology.
- Settings controls wrap; long blocked domains and daily-limit rows keep their actions visible. Category headings use readable name/summary rows and keyboard-operable expand buttons. Removed repetitive “default” badges. Edit/delete controls have accessible names.
- The calendar uses the existing Radix popover for viewport positioning, Escape, outside-click dismissal and focus restoration. Shared dialogs scroll within short windows. The limit dialog has a description and a labeled domain input.

## Verification

Actual built extension, isolated Chromium profile, synthetic blocked-domain and limit records. The [layout script](../scripts/verify-dashboard-layout.js) checks all seven routes at 1280×900 and 390×900, in both light/dark modes and monochrome/blue palettes: 56 combinations. Desktop titles start at (256, 32), and content starts at y=157 across every route. All measured pages have zero horizontal overflow and reset scrolling on navigation. Narrow toolbars wrap naturally, so their heights can differ.

Additional checks at 390×640 confirm that the calendar and limit dialog fit, Escape restores focus to the calendar trigger, and Enter toggles category expansion. Screenshots were visually reviewed, including long domain names and selected theme states. The existing 156 tests, TypeScript and production build pass.

Tracking, blocking and history benchmarks were captured before changes and rerun after each implementation batch. Final JSON reports are byte-for-byte identical to the initial reports: these UI changes do not alter measured tracker operations or storage payloads. No browser rendering or battery improvement is claimed.

Run the layout script through `playwright-cli run-code --filename scripts/verify-dashboard-layout.js` after building and opening the dashboard in a disposable extension profile; see [extension verification setup](extension-verification.md). It changes that profile's theme preferences and writes screenshots to `output/playwright/`.
