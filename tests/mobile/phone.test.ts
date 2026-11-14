import { describe, it, expect, beforeAll, afterAll, afterEach, inject } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

type Screen = 'editor' | 'stadium' | 'grooves' | 'improv';

let browser: Browser;
const pages: Page[] = [];

// The system Chrome: playwright-core downloads no browser
beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true });
});
afterEach(async () => {
  await Promise.all(pages.splice(0).map(page => page.context().close()));
});
afterAll(async () => {
  await browser?.close();
});

// Opens MetroRig on a screen at a window width, as a phone with touch would below 768 px, once its fonts have rendered
async function openScreen(screen: Screen, width: number, height = 800): Promise<Page> {
  const phone = width < 768;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  pages.push(page);
  await page.goto(inject('baseUrl'));
  await page.waitForSelector('#grid-container .step-cell');
  if (screen !== 'editor') {
    await page.click(`#nav-${screen}`);
    await page.waitForSelector(`#${screen}-view:not(.hidden)`);
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page;
}

describe('Mobile App', () => {
  it('harness opens the editor at 375', async () => {
    const page = await openScreen('editor', 375);
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.locator('#editor-view').isVisible()).toBe(true);
    expect(await page.locator('#grid-container .step-cell').count()).toBeGreaterThan(0);
  });
});
