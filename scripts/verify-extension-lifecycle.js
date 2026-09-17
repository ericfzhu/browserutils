// Run with playwright-cli run-code --filename scripts/verify-extension-lifecycle.js
// Requires a fresh persistent Chromium profile with dist/ loaded as an extension.
async page => {
  page.setDefaultTimeout(10000);
  const context = page.context();
  const worker = context.serviceWorkers().find(worker => worker.url().startsWith('chrome-extension://'));
  if (!worker) throw new Error('Load dist/ in a disposable persistent profile first.');
  const origin = worker.url().replace('/background.js', '');
  await page.goto(`${origin}/dashboard.html#/settings`);
  const send = message => page.evaluate(message => chrome.runtime.sendMessage(message), message);
  const check = (value, description) => { if (!value) throw new Error(description); };
  const passed = [];
  await send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: true, idleThreshold: 0, excludedDomains: [] } });
  await context.route('https://activity.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Synthetic activity</title><h1>Activity fixture</h1>' }));
  const activity = await context.newPage();
  await activity.goto('https://activity.test/');
  await activity.bringToFront();
  await page.waitForFunction(async () => Object.values((await chrome.storage.session.get('activeSessions')).activeSessions ?? {}).some(session => session.domain === 'activity.test'));
  passed.push('Real tab navigation starts an activity session');
  await send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: false } });
  check(Object.keys(await page.evaluate(async () => (await chrome.storage.session.get('activeSessions')).activeSessions ?? {})).length === 0, 'Disabling tracking must close activity');
  await send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: true } });
  await page.waitForFunction(async () => Object.values((await chrome.storage.session.get('activeSessions')).activeSessions ?? {}).some(session => session.domain === 'activity.test'));
  passed.push('Live disable and re-enable work without a page reload');
  await page.bringToFront();
  await page.reload();
  await page.getByLabel('Excluded domains', { exact: true }).fill('activity.test');
  await page.getByRole('button', { name: 'Save exclusions', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Tracking exclusions saved.' }).waitFor();
  await activity.bringToFront();
  await activity.reload();
  await activity.waitForTimeout(16000); // One actual content heartbeat period.
  check(Object.keys(await page.evaluate(async () => (await chrome.storage.session.get('activeSessions')).activeSessions ?? {})).length === 0, 'Excluded domain was recorded');
  passed.push('Exclusion saved in UI prevents navigation and heartbeat tracking');
  await send({ type: 'ADD_BLOCKED_SITE', payload: { pattern: 'blocked.test', enabled: true, unlockType: 'none' } });
  const rules = await page.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
  check(rules.length > 0, 'No native blocking rules installed');
  const today = await page.evaluate(() => { const now = new Date(); now.setDate(now.getDate() - 1); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; });
  await page.evaluate(async date => {
    await chrome.storage.local.set({ [`dailyStats:${date}`]: { date, totalTime: 60, sites: { 'fixture.test': 60 }, visits: 1, blockedAttempts: 0, sessions: {}, youtubeSessions: {} } });
    await chrome.storage.local.remove('dailyStatsSummaryDates');
  }, today);
  const summary = await send({ type: 'GET_STATS_SUMMARY' });
  check(summary[today]?.totalTime === 60, 'Summary omitted seeded history');
  const internals = await context.newPage();
  await internals.goto('chrome://serviceworker-internals/');
  await internals.getByRole('button', { name: 'Stop', exact: true }).click();
  await internals.getByText('STOPPED', { exact: true }).waitFor();
  const recovered = await send({ type: 'GET_STATS_SUMMARY' });
  check(recovered[today]?.totalTime === 60, 'History lost after worker restart');
  await internals.getByText('RUNNING', { exact: true }).waitFor();
  await internals.close();
  check(JSON.stringify(await page.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())) === JSON.stringify(rules), 'Native rules changed across restart');
  passed.push('Forced service-worker termination recovers history and preserves native rules');
  await page.bringToFront();
  await page.getByLabel('Start date', { exact: true }).fill(today);
  await page.getByLabel('End date', { exact: true }).fill(today);
  await page.getByRole('button', { name: 'Delete selected history', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete history', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Deleted browsing and YouTube history' }).waitFor();
  check(!(await send({ type: 'GET_STATS_SUMMARY' }))[today], 'Deleted day remains in summary');
  check((await send({ type: 'GET_SETTINGS' })).excludedDomains.includes('activity.test'), 'Deletion changed exclusions');
  check((await page.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).length === rules.length, 'Deletion changed blocking rules');
  passed.push('Confirmed UI date deletion clears selected history and keeps settings/rules');
  for (const theme of ['Light', 'Dark']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.waitForTimeout(250); // Let the 200 ms theme transition finish.
    await page.getByRole('heading', { name: 'Tracking privacy', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/privacy-${theme.toLowerCase()}.png` });
  }
  await activity.close();
  return { passed, limitation: 'Forced worker restart and functional checks; not natural suspension, CPU or battery measurement.' };
}
