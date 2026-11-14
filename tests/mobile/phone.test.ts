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

// Every button, tab, step cell and pad on the page: the controls a thumb taps or long-presses
const TAPPED = 'button, .view-link, .step-cell, .chord-btn';

// The computed value of a style property on each element a selector matches, as [description, value]
function computed(page: Page, selector: string, property: string): Promise<[string, string][]> {
  return page.evaluate(([selector, property]) => [...document.querySelectorAll<HTMLElement>(selector)].map(element => {
    const style = getComputedStyle(element) as any;
    const value = style.getPropertyValue(property) || style.getPropertyValue(`-webkit-${property}`);
    return [`${element.tagName.toLowerCase()}#${element.id}.${element.className}`, value] as [string, string];
  }), [selector, property] as const);
}

describe('Mobile App', () => {
  it('harness opens the editor at 375', async () => {
    const page = await openScreen('editor', 375);
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.locator('#editor-view').isVisible()).toBe(true);
    expect(await page.locator('#grid-container .step-cell').count()).toBeGreaterThan(0);
  });
  it('mob_05 fields use 16 px text', async () => {
    for (const screen of ['editor', 'stadium', 'grooves', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      const sizes = await computed(page, 'input, select', 'font-size');
      expect(sizes.length).toBeGreaterThan(10);
      for (const [field, size] of sizes) expect([field, parseFloat(size) >= 16]).toEqual([field, true]);
    }
  });

  it('mob_36 no tap highlight', async () => {
    for (const screen of ['editor', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      const colors = await computed(page, TAPPED, 'tap-highlight-color');
      // The editor draws step cells; Improv draws the pads
      expect(colors.some(([control]) => control.includes(screen === 'editor' ? 'step-cell' : 'chord-btn'))).toBe(true);
      for (const [control, color] of colors) expect([control, color]).toEqual([control, 'rgba(0, 0, 0, 0)']);
    }
  });

  it('mob_37 double tap does not zoom', async () => {
    const page = await openScreen('editor', 375);
    expect(await computed(page, 'html, body', 'touch-action')).toEqual([['html#.', 'manipulation'], ['body#.', 'manipulation']]);
  });

  it('mob_38 long press selects no text', async () => {
    for (const screen of ['editor', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      const values = await computed(page, TAPPED, 'user-select');
      expect(values.some(([control]) => control.includes(screen === 'editor' ? 'step-cell' : 'chord-btn'))).toBe(true);
      for (const [control, value] of values) expect([control, value]).toEqual([control, 'none']);
    }
  });

  it('mob_39 pull past the top does not reload', async () => {
    const page = await openScreen('editor', 375);
    expect(await computed(page, 'html, body', 'overscroll-behavior-y')).toEqual([['html#.', 'none'], ['body#.', 'none']]);
  });
});
