# Extension verification

Verified 18 September 2026: 156 Vitest tests, TypeScript and production Vite build pass. Tracking, blocking and history operation-count benchmarks were rerun. Results and tradeoffs are in [benchmarks](../benchmarks/README.md).

## Real Chromium

The built unpacked extension was checked in Chromium 151.0.7922.34 with an isolated persistent profile and synthetic data. The repeatable [CLI script](../scripts/verify-extension-lifecycle.js) passed:

- Real tab navigation starts tracking.
- Tracking disables and re-enables in existing tabs without reload.
- UI-saved domain exclusions prevent navigation/heartbeat recording (observed across one real 15-second heartbeat period).
- Chromium's worker controls confirm STOPPED, then a runtime request restarts the worker to RUNNING. History summaries and native blocking rules survive.
- Confirmed date deletion removes the selected synthetic history, updates summaries, and preserves settings and blocking rules.
- The privacy card renders in light and dark mode. Screenshots are written to `output/playwright/`.

Use a fresh disposable profile; the script changes settings and deletes synthetic history. It must not target your personal Chrome profile. Build first (`yarn tsc --noEmit && yarn vite build`). With Playwright CLI and its Chromium installed, create a local configuration with absolute paths:

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "channel": "chromium",
      "headless": true,
      "args": [
        "--disable-extensions-except=/absolute/path/browserutils/dist",
        "--load-extension=/absolute/path/browserutils/dist"
      ]
    }
  }
}
```

```sh
mkdir -p output/playwright
playwright-cli -s=extension-check open --config output/playwright/config.json --profile /tmp/browserutils-fresh-test-profile
playwright-cli -s=extension-check run-code --filename scripts/verify-extension-lifecycle.js
playwright-cli -s=extension-check close
```

An explicit `launchOptions.executablePath` can select an already installed Playwright Chromium. This run used that option because the cached CLI expected a different Chromium revision.

Worker termination uses `chrome://serviceworker-internals` and checks its actual status. Playwright's worker `close` event and target closing did not reliably indicate extension worker termination in this environment. See [Chrome's termination-testing guidance](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer) for why restart resilience needs explicit testing.

This is a functional smoke test with forced termination, not natural suspension, crash-at-every-write, live YouTube playback or energy profiling. Playback races and content lifecycle have deterministic tests. Real CPU, memory and battery changes remain unmeasured. Chromium emitted module-preload warnings but no page console errors during the successful run.
