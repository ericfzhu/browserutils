# Blocking rule synchronization: before and after

Measured on 18 September 2026. Run `yarn benchmark:blocking` or `node scripts/benchmark-blocking.mjs /tmp/blocking.json`.

The harness executes the real bundled background worker with mocked Chrome APIs, initializes it, then delivers 60 one-minute save alarms over one simulated hour. The browser has no active tracked tabs. Snapshots include source hashes and separate startup/install counts. This measures API operation counts, not CPU, memory or battery use.

| Scenario | Native rule reads | Native updates | Rules submitted | Local reads across save handlers |
| --- | ---: | ---: | ---: | ---: |
| No rules | 60 → 0 | 60 → 0 | 0 → 0 | 180 → 60 |
| 100 permanent rules | 60 → 0 | 60 → 0 | 6,000 → 0 | 180 → 60 |
| 100 timer rules expiring at minute 30 | 60 → 0 | 60 → 1 | 2,900 → 0 | 180 → 60 |

The timer scenario's single update removes expired rules, hence zero additions. Final rule counts are unchanged: 0, 100 and 0 respectively.

[Baseline](blocking-before.json) · [After](blocking-after.json)

## Implementation and tradeoffs

`src/background/blockingRuleSync.ts` owns serialized definition loading, compiled-rule caching, timed reevaluation and native synchronization. Actual settings/site/folder changes reload definitions; periodic checks use the cached snapshot. Native rules are read once after worker restart and reconciled with current settings. Identical rules are not resubmitted. Failed native updates invalidate the applied cache so the next attempt reconciles again.

Minute checkpoints continue checking schedules, timers and focus expiry in local time. Existing password-unlock alarms still run. This preserves existing timing, including inclusive schedule end minutes and reevaluation after wall-clock/timezone changes; it does not add precise alarms for every schedule boundary or remove worker wakeups. Unchanged compiled rule objects can be compared by reference, avoiding serialization on the steady-state path.

Startup/install together cost four more local reads in these scenarios (7 → 11), because rules are now also reconciled on worker startup rather than waiting for the next checkpoint. This is a correctness tradeoff. In-memory snapshots consume memory proportional to rule definitions and are reconstructed after restart. The remaining 60 local reads in the empty-session benchmark belong to the existing session-storage access path, not rule synchronization.

Verification: 143 tests pass, TypeScript and the production build pass. New integration cases cover unchanged checkpoints, timer/password boundaries, schedule start/end, folder focus expiry, failed native updates and module restart reconciliation. The existing content-tracking benchmark is unaffected by these worker-only changes.
