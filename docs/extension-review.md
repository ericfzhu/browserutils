# Chrome extension review

Reviewed 17 September 2026. This is a source review, not a CPU/battery benchmark. Existing uncommitted blocked-site rule changes were present before this work and have been retained.

## Assessment

A capable personal extension with a good storage foundation, but lifecycle coordination and module size need attention before adding more tracking features. Strengths include typed runtime messages, sender checks, queued history writes, compact interval storage, local-day splitting, retention, native declarative blocking, and focused regression tests. `src/background/index.ts` handles startup, tracking, authorization, import/export, blocking and messaging in one large module; content tracking mixes general activity and YouTube extraction. These are the most valuable boundaries to separate.

## Prioritized findings

1. **Tracking transitions were not atomic (now addressed).** `handleHeartbeat`, `startSession`, `endSession`, and the `saveSession` alarm read active state and later replace/remove it across multiple awaits. Storage helpers serialize individual writes, but not the entire transition. A heartbeat can read a session, a tab switch can remove it, and the heartbeat can then add the old session back. Similarly, checkpoint writes can revive an ended session. Interval union reduces duplicate duration but does not fix stale state or visit counts. Whole tracking transitions now share a worker queue at event/message boundaries, including startup, checkpoints, browsing/playback events, settings writers and reset/import. Internal helpers run directly to avoid nested-queue deadlocks. Queued content messages re-read the live tab and reject closed or navigated tabs; browsing heartbeats reject inactive tabs. Disabling a tracker closes its sessions. A failed operation does not poison the queue.

2. **Disabled trackers still do page work (medium).** `src/content/index.ts` starts visible-page heartbeats and YouTube listeners without consulting tracker preferences. The worker rejects disabled tracking messages, but page timers, DOM queries and message delivery have already happened. Send a minimal tracking configuration to content scripts and start/stop their listeners and timers when preferences change. Keep blocking checks independent.

3. **Repeated wakeups and blocking-rule replacement (medium).** A visible page sends a heartbeat every 15 seconds: 240 messages/hour per visible document, with another playback stream on YouTube. Visibility is not the same as owning the focused Chrome window. The worker also runs 30-second window checks, minute checkpoints and replaces all dynamic blocking rules every minute. Use focus/tab/idle events as the primary clock, bounded checkpoints for recovery, and exact expiry alarms for rules. Cache compiled rules and only update DNR when they change. Do not simply increase the heartbeat interval: the 45-second freshness test and 30-second end cap must change coherently. Chrome API calls/events reset the worker idle timer, so this is also a worker-lifetime concern: [Chrome lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

4. **Summary queries read the full history payload (medium).** `getAllDailyStatsSummary()` calls `getAllDailyStats()`, which reads all local storage before stripping sessions. The daily-key layout is good, but this defeats selective reading for long-range summaries. Store/read compact daily summaries separately from detailed intervals when real usage measurements justify it. `recordSession()` also recomputes unions across the day; measure long-session/high-tab-switch workloads before replacing the simple implementation with incremental aggregates or IndexedDB.

5. **Playback lifecycle and diagnostics need cleanup (medium).** YouTube navigation clears `currentVideoElement` without first detaching its old listeners, and `popstate` uses an anonymous callback that cleanup cannot remove. The hidden-page playback timer can run while paused. Production console logging includes channel details and runs frequently. Extract a playback controller with explicit attach/detach, cancellable retries, pause-aware timers, and opt-in diagnostics. Add coverage for SPA navigation, video replacement, background playback and disabling tracking mid-session.

6. **UI theme consistency (addressed in this change).** Literal gray/status colors bypassed the shared palettes; full CSS color tokens did not support Tailwind opacity modifiers; several Radix components used unsupported state shorthands. The system-theme watcher could not actually unsubscribe, switching to system mode later did not reliably subscribe, and other open pages did not follow saved theme changes. Shared semantic colors and a single theme lifecycle now handle these cases.

## Activity history design

Keep the domain + interval model for this product. It answers “where did my time go?” while avoiding full URLs, query strings and page titles. It is activity history, not Chrome navigation history. A “visit” currently represents a counted activity session, not every page load; label this clearly or rename it to “sessions.” Compact merged intervals cannot reconstruct individual navigation visits.

General browsing should have exactly one owner: the active tab of the focused window, subject to the explicit idle/media policy. YouTube playback is an independent track that may overlap browsing and may run in several tabs. Never add playback time to browsing time; clearly distinguish elapsed playback union from summed channel time. Keep category assignments as a presentation layer over recorded domains.

Persist checkpoints and completed intervals; close on focus loss, tab switch, domain change, idle and tab removal. Recover conservatively after worker restart and browser shutdown. Record duration with timestamps, using alarms only to checkpoint, not as an exact clock. Document the acceptable loss/overcount window and test it under suspend/resume, midnight, DST, clock changes and rapid tab switching.

Next privacy controls: excluded domains, pause tracking, range/domain deletion, and an explicit retention explanation. Do not introduce full-URL history unless searchable page history becomes a separate, explicitly requested feature.

## Suggested sequence

1. Completed: serialize session transitions and add race/lifecycle tests.
2. Gate content work by settings; detach playback listeners reliably; remove verbose production logs.
3. Update blocking rules only on relevant changes/expiry; instrument messages, storage operations and worker wakes.
4. Profile daily writes and summary reads with realistic retained data, then optimize measured hotspots.

Lifecycle coordination is now implemented. Twelve new integration tests cover overlapping checkpoints, heartbeat/close and tab-switch races, focus loss, idle, disabling tracking, reset, playback closure, stale navigation snapshots and recovery after a failed operation. Storage mocks clone values to match Chrome snapshot semantics. Ten race tests fail when the transition queue is deliberately bypassed and pass with it enabled. The full suite passes (123 tests), as do TypeScript and the production build.

This serializes operations within a running worker; it is not a cross-storage transaction or a guarantee against abrupt process termination between durable and session writes. Existing checkpoint/recovery behavior remains. Timer frequency and other cost optimizations are still pending; no battery or CPU savings are claimed.


## Follow-up: content tracking overhead

Preference-gated content tracking is now implemented, along with cancellable YouTube discovery retries, removable navigation listeners, old-video detachment and pause-aware hidden playback timers. Existing tabs receive configuration changes without reloading. The before/after operation-count benchmark and its limitations are documented in [benchmarks/README.md](../benchmarks/README.md). Disabled scenarios drop to zero steady-state tracking messages/timer callbacks; active tracking cadence is unchanged. Real CPU and battery measurements remain outstanding.

## Follow-up: blocking synchronization

Blocking synchronization now lives in its own module, caches compiled definitions, reevaluates timed state without rereading storage, and only updates Chrome when effective rules change. Startup reconciles persisted native rules; failed updates are retried on the next check. Minute checks and existing unlock alarms retain their timing. [Before/after measurements](../benchmarks/blocking.md) show 60 → 0 native updates per simulated hour for unchanged rules, and 60 → 1 for the timer-expiry scenario. The suite now has 143 passing tests.

## Follow-up: summaries, module boundaries and privacy

Daily summary queries now use a derived per-day cache, updated alongside authoritative history writes. Measured warm annual summary payloads fall from 5.59 MB to 196 KB, with an additional date-index read per checkpoint and a small larger write. The [measurement report](../benchmarks/history.md) records both gains and costs. Summary creation participates in the lifecycle queue so clearing/importing data cannot race cache creation.

Playback session handling, session freshness and optional content-script registration now have separate background modules. The entry point retains event routing and orchestration.

Settings now includes domain exclusions (including subdomains) and confirmed date-range deletion. Exclusions stop future browsing/playback recording without changing blocking definitions. Deletion removes selected browsing/playback/blocked-attempt days, invalidates summaries and resumes enabled tracking from now; it keeps focus-session history and settings. Deleting today's history resets recorded usage toward daily limits, stated in the confirmation. Lockdown authorization applies to deletion.

The initial improvement sequence is implemented. Broader YouTube extraction resilience, domain-specific deletion, natural worker-suspension profiling and controlled CPU/power measurements remain separate future investigations, not measured benefits of this work.
