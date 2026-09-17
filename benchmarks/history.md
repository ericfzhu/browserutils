# History summary measurements

Measured 18 September 2026 using the actual bundled storage module with deterministic synthetic data: 20 domains and 30 intervals per domain per day. Run `yarn benchmark:history`, or pass an output filename to `node scripts/benchmark-history.mjs`. Original [baseline](history-before.json) and [current result](history-after.json) are retained.

| Retained days | Warm summary bytes read before | After | Reduction |
| --- | ---: | ---: | ---: |
| 30 | 459,652 | 16,109 | 96.5% |
| 365 | 5,591,852 | 195,669 | 96.5% |

The first summary request still reads full history, then creates compact derived summaries. Subsequent requests read the date index and summaries only. Detailed intervals remain authoritative; summary updates share the same write as their day. Retention and selective deletion invalidate the index. Derived summaries are excluded from backups.

Costs: first use adds one storage read and a cache write (16 KB / 196 KB for these datasets). A checkpoint after cache creation adds one date-index read; total checkpoint read payload grows from 15,347 to 15,765 bytes at 30 days and 20,120 at 365 days. Its write grows from 15,345 to 15,868 bytes, still one write. Thus long-range summary queries improve substantially, with a small ongoing recording cost and additional retained cache storage.

These are JSON payload bytes across mocked storage, not Chrome quota bytes, timings, CPU, memory or battery measurements. Measurements do not prove a battery percentage. Tracking and blocking operation-count benchmarks were rerun after the privacy and module-separation changes; their steady-state counts remain unchanged.
