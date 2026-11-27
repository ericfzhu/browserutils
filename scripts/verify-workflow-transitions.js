// Run through playwright-cli in a disposable profile with the built extension loaded.
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (!origin.startsWith('chrome-extension://')) throw new Error('Open the extension dashboard first.');
  await page.addInitScript(() => {
    const limit = { id: 'fixture', pattern: 'example.test', enabled: true, limitSeconds: 60, bypassType: 'cooldown', cooldownSeconds: 1 };
    window.workflow = { attempts: 0, updates: 0 };
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = async message => {
      switch (message.type) {
        case 'GET_DAILY_LIMITS': return [limit];
        case 'BYPASS_DAILY_LIMIT':
          window.workflow.attempts++;
          return window.workflow.attempts === 1 ? { success: false, error: 'Temporary failure' } : { success: true };
        case 'LOCKDOWN_GET_STATUS': return { lockdownEnabled: true, sessionValid: false, authMethod: 'password' };
        case 'LOCKDOWN_AUTHENTICATE':
          return new Promise(resolve => { window.workflow.finishAuth = () => resolve({ success: true }); });
        case 'UPDATE_DAILY_LIMIT':
          window.workflow.updates++;
          limit.enabled = message.payload.enabled;
          return { success: true };
        default: return send(message);
      }
    };
  });
  const limits = origin + '/dashboard.html#/limits';
  await page.goto(limits);
  await page.goto(origin + '/blocked.html?type=limit&limitId=fixture');
  await page.getByRole('button', { name: 'Wait 1s to continue' }).click();
  await page.getByText('Temporary failure').waitFor();
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.waitForURL(limits);

  async function submit() {
    await page.getByRole('button', { name: 'Disable limit for example.test' }).click();
    await page.getByPlaceholder('Master password').fill('fixture');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await page.waitForFunction(() => typeof window.workflow.finishAuth === 'function');
  }
  await submit();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => window.workflow.finishAuth());
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  if (await page.evaluate(() => window.workflow.updates !== 0)) throw new Error('Cancelled action ran');
  await page.evaluate(() => { delete window.workflow.finishAuth; });
  await submit();
  await page.evaluate(() => window.workflow.finishAuth());
  await page.getByRole('button', { name: 'Enable limit for example.test' }).waitFor();
  if (await page.evaluate(() => window.workflow.updates !== 1)) throw new Error('Expected exactly one action');
  return 'Cooldown retry, cancellation during authentication, and single execution passed';
}
