// Run with playwright-cli run-code --filename scripts/verify-dashboard-layout.js.
// Use a disposable extension profile: this changes its appearance preferences.
async page => {
  const names = ['Overview', 'Blocked Sites', 'Daily Limits', 'Metrics', 'Categories', 'Settings', 'What’s New'];
  const results = [];
  for (const colorTheme of ['monochrome', 'blue']) {
    await page.evaluate(colorTheme => chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { colorTheme } }), colorTheme);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: { theme } }), theme);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const name of names) {
          await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
          await page.getByRole('heading', { name, exact: true, level: 1 }).waitFor();
          await page.waitForTimeout(250); // Allow appearance transitions to settle.
          const result = await page.evaluate(({ name, width, theme, colorTheme }) => {
            const main = document.querySelector('main');
            const header = main.querySelector('header');
            const title = header.querySelector('h1').getBoundingClientRect();
            return {
              name, width, theme, colorTheme,
              title: { x: title.x, y: title.y },
              bodyY: header.nextElementSibling?.getBoundingClientRect().y,
              overflow: main.scrollWidth - main.clientWidth,
              scrollTop: main.scrollTop,
            };
          }, { name, width, theme, colorTheme });
          if (result.overflow > 0 || result.scrollTop !== 0) throw Error(JSON.stringify(result));
          if (width === 1280 && (result.title.x !== 256 || result.title.y !== 32 || result.bodyY !== 157)) {
            throw Error('Desktop alignment: ' + JSON.stringify(result));
          }
          results.push(result);
          await page.screenshot({ path: `output/playwright/ui-${name.replaceAll(' ', '-')}-${width}-${theme}-${colorTheme}.png` });
          await page.locator('main').evaluate(element => { element.scrollTop = 300; });
        }
      }
    }
  }
  return results;
}
