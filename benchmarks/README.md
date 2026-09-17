# Content tracking measurements

Measured before and after preference-gated content tracking on 17 September 2026.

Run `yarn benchmark:tracking` to print a fresh report, or `node scripts/benchmark-tracking.mjs /tmp/tracking-result.json` to save one. Keep the original baseline instead of overwriting it for subsequent changes. The harness bundles the actual content entry with esbuild, then runs it with deterministic timers and mocked Chrome/DOM surfaces. Each scenario has five simulated seconds of setup and 600 simulated seconds of observation. Hidden scenarios become hidden after setup. Reports include a SHA-256 fingerprint of the bundled source.

## Results

Each row represents one document over ten simulated minutes. Message counts below exclude setup and include all tracking messages during observation.

| Scenario | Timer callbacks before → after | Messages before → after | DOM queries before → after |
| --- | ---: | ---: | ---: |
| Visible page, tracking disabled | 40 → 0 | 40 → 0 | 0 → 0 |
| Visible YouTube playing, both trackers disabled | 40 → 0 | 80 → 0 | 80 → 0 |
| Hidden YouTube paused, playback tracking enabled | 40 → 0 | 0 → 0 | 40 → 0 |
| Visible page, browsing tracking enabled | 40 → 40 | 40 → 40 | 0 → 0 |
| Hidden YouTube playing, playback tracking enabled | 40 → 40 | 40 → 40 | 80 → 80 |
| Visible YouTube playing, both trackers enabled | 40 → 40 | 80 → 80 | 80 → 80 |

Raw snapshots: [before](tracking-before.json), [after](tracking-after.json).

## Changes and costs

- Content scripts request two tracking flags at startup and receive settings updates through a passive runtime listener. They never need direct access to extension storage for this configuration.
- Disabled trackers do not initialize page listeners, timers, video discovery or metadata queries. The blocking check still runs independently.
- Background settings changes and reset/import notify existing tabs, so enabling tracking does not require a page reload. Unrelated settings changes do not broadcast.
- Hidden playback polling stops on pause and resumes on play. Navigation/disable detaches old video and popstate listeners and cancels discovery retries.
- A passive capturing play listener discovers late-loading videos in hidden tabs without polling while paused. Enabled YouTube therefore has one additional page listener (six → seven); every initialized document has one additional runtime listener. Disabled pages have zero tracking page listeners.
- There is one additional startup configuration request for enabled pages and one broadcast per eligible open tab when tracking settings change. These one-time/event-driven costs are explicit; the steady-state table does not include them. `setupMessages` in each report records initialization traffic.
- Active browsing and playback retain the existing 15-second cadence. Visible YouTube with playback tracking enabled still performs discovery checks at that cadence even while paused; this change removes hidden paused polling, not all possible idle work.

## Correctness and limitations

All 136 tests pass, including ten content-lifecycle tests and three new worker configuration tests. TypeScript and the production build pass. Tests cover runtime enable/disable, blocking independence, separate browsing/playback flags, hidden pause/resume, late video discovery, SPA listener detachment, retry cancellation, stale initial settings responses, extension-context teardown, settings broadcasts and reset defaults.

These are deterministic operation counts, not measurements of real CPU, energy, memory, Chrome timer throttling or service-worker suspension. Worker alarms and rule rebuilds are unchanged and still run. No battery improvement or complete worker idleness is claimed. A real-Chrome CPU/power comparison would need a controlled profile and repeated workloads; do not infer a battery percentage from these counts.

## Subsequent changes

- [Blocking rule synchronization](blocking.md): measured separately on 18 September 2026; eliminates unchanged native rule submissions and repeated definition reads.
- [History summaries](history.md): measured cold and warm reads plus the additional checkpoint cost.
