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

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };

// The box an element draws in the window, or null when it draws none
function box(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
    return width === 0 && height === 0 ? null : { top, bottom, left, right, width, height };
  }, selector);
}

async function scrollToEnd(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

// What the tab bar shows: each tab's name, whether it draws an icon, and its box
function tabs(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.view-link')].map(tab => {
    const icon = tab.querySelector('svg')?.getBoundingClientRect();
    const { top, bottom, left, right } = tab.getBoundingClientRect();
    return { name: tab.textContent!.trim(), icon: !!icon && icon.width > 0 && icon.height > 0, top, bottom, left, right };
  }));
}

// A padding with the window's safe-area insets set as a notched phone reports them
async function paddingWithInsets(page: Page, selector: string, side: 'top' | 'bottom', inset: number): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as any, { insets: { top: inset, bottom: inset, left: 0, right: 0 } });
  return page.evaluate(([selector, side]) => parseFloat(getComputedStyle(document.querySelector(selector)!).getPropertyValue(`padding-${side}`)), [selector, side] as const);
}


// Waits until a scroller has stopped moving: the same scrollLeft over several frames
async function settle(page: Page, selector: string) {
  await page.evaluate(selector => new Promise<void>(resolve => {
    const element = document.querySelector(selector)!;
    let last = -1, still = 0;
    const check = () => {
      still = element.scrollLeft === last ? still + 1 : 0;
      last = element.scrollLeft;
      if (still >= 10) resolve(); else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }), selector);
}

// The grid as drawn: the scroller's content edge, the track names' boxes and each beat's first cell
function grid(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('.grid-scroller')!;
    const frame = scroller.getBoundingClientRect();
    const names = [...document.querySelectorAll<HTMLElement>('.track-label')].map(label => {
      const { left, right, top, bottom } = label.getBoundingClientRect();
      // On top at its centre: no step cell drawn over the name
      const onTop = label.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
      return { name: label.innerText, left, right, onTop };
    });
    const beats = [...document.querySelectorAll<HTMLElement>('.step-count.beat-start')].map(count => count.getBoundingClientRect().left);
    return {
      edge: frame.left + scroller.clientLeft + parseFloat(getComputedStyle(scroller).paddingLeft),
      scrollLeft: scroller.scrollLeft,
      maxScroll: scroller.scrollWidth - scroller.clientWidth,
      names,
      beats,
    };
  });
}

// A finger dragging the grid sideways by a distance, holding still, then lifting
async function dragGrid(page: Page, distance: number) {
  const scroller = (await box(page, '.grid-scroller'))!;
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(scroller.right - 20), y = Math.round(scroller.top + 60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let move = 1; move <= 15; move++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - (distance * move) / 15, y }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(100);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page, '.grid-scroller');
}

// Whether a fade is drawn over the grid's left or right step edge: the edge's pixels brighten once every mask and overlay on the scroller is taken away
async function fadeDrawn(page: Page, side: 'left' | 'right'): Promise<boolean> {
  const strip = await page.evaluate(side => {
    const scroller = document.querySelector<HTMLElement>('.grid-scroller')!.getBoundingClientRect();
    const labels = [...document.querySelectorAll<HTMLElement>('.track-label')].map(label => label.getBoundingClientRect());
    // The step area starts where beat 1 sits at rest: past the names column and its gap
    const stepArea = labels[0].right + parseFloat(getComputedStyle(document.getElementById('grid-container')!).columnGap);
    const left = side === 'left' ? stepArea : scroller.right - 16;
    return { x: Math.round(left), y: Math.round(labels[0].top), width: 16, height: Math.round(labels[labels.length - 1].bottom - labels[0].top) };
  }, side);
  const shown = await page.screenshot({ clip: strip });
  const bare = await page.addStyleTag({ content: `
    .grid-scroller, .grid-scroller * { mask-image: none !important; -webkit-mask-image: none !important; }
    .grid-scroller::before, .grid-scroller::after, .sequencer-grid::before, .sequencer-grid::after { display: none !important; }` });
  const unfaded = await page.screenshot({ clip: strip });
  await bare.evaluate(style => style.remove());
  // A mask that changes nothing still shifts a few pixels by one level as it composites; a fade dims them by far more
  const largest = await page.evaluate(async ([shown, unfaded]) => {
    const pixels = (png: string) => new Promise<Uint8ClampedArray>(resolve => {
      const image = new Image();
      image.onload = () => {
        const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        resolve(context.getImageData(0, 0, image.width, image.height).data);
      };
      image.src = `data:image/png;base64,${png}`;
    });
    const [a, b] = await Promise.all([pixels(shown), pixels(unfaded)]);
    let largest = 0;
    for (let i = 0; i < a.length; i++) largest = Math.max(largest, Math.abs(a[i] - b[i]));
    return largest;
  }, [shown.toString('base64'), unfaded.toString('base64')]);
  return largest > 16;
}

async function scrollGridTo(page: Page, left: number) {
  await page.evaluate(left => document.querySelector('.grid-scroller')!.scrollTo({ left, behavior: 'instant' as ScrollBehavior }), left);
  await settle(page, '.grid-scroller');
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
  it('mob_06 tab bar fixed to the bottom with four icon tabs', async () => {
    for (const screen of ['editor', 'grooves'] as Screen[]) {
      const page = await openScreen(screen, 375);
      for (const scrolled of [false, true]) {
        if (scrolled) await scrollToEnd(page);
        if (scrolled) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        const bar = (await box(page, '.view-nav'))!;
        expect([screen, scrolled, bar.bottom, bar.left, bar.right]).toEqual([screen, scrolled, 800, 0, 375]);
        const shown = await tabs(page);
        expect(shown.map(tab => [tab.name, tab.icon])).toEqual([['Editor', true], ['Stadium', true], ['Grooves', true], ['Improv', true]]);
        for (const tab of shown) {
          expect(tab.top).toBeGreaterThanOrEqual(bar.top);
          expect(tab.bottom).toBeLessThanOrEqual(bar.bottom);
          // One row, side by side
          expect(tab.top).toBe(shown[0].top);
        }
        expect(shown.map(tab => tab.left)).toEqual([...shown.map(tab => tab.left)].sort((a, b) => a - b));
      }
    }
  });

  it('mob_09 tab bar pads the bottom safe area', async () => {
    const page = await openScreen('editor', 375);
    const base = await paddingWithInsets(page, '.view-nav', 'bottom', 0);
    expect(await paddingWithInsets(page, '.view-nav', 'bottom', 34)).toBe(base + 34);
    // Still flush with the window's bottom, its tabs above the inset
    const bar = (await box(page, '.view-nav'))!;
    expect(bar.bottom).toBe(800);
    for (const tab of await tabs(page)) expect(tab.bottom).toBeLessThanOrEqual(800 - 34);
  });

  it('mob_10 last element clears the fixed bars', async () => {
    for (const screen of ['editor', 'stadium', 'grooves', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      await scrollToEnd(page);
      // In the Editor the transport bar sits on top of the tab bar, so the page must clear both
      const bar = (await box(page, screen === 'editor' ? '#transport-bar' : '.view-nav'))!;
      const view = (await box(page, `#${screen}-view`))!;
      const footer = (await box(page, '.status-bar'))!;
      // The window scrolls in whole pixels, so a fractional page height may leave its end under a pixel low
      expect([screen, view.bottom <= bar.top + 0.5, footer.bottom <= bar.top + 0.5]).toEqual([screen, true, true]);
    }
  });

  it('mob_11 desktop keeps header links', async () => {
    for (const screen of ['editor', 'stadium', 'grooves', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 1280);
      const header = (await box(page, 'header'))!;
      const shown = await tabs(page);
      expect(shown.map(tab => tab.name)).toEqual(['Editor', 'Stadium', 'Grooves', 'Improv']);
      for (const tab of shown) {
        expect(tab.top).toBeGreaterThanOrEqual(header.top);
        expect(tab.bottom).toBeLessThanOrEqual(header.bottom);
      }
      // No bar of any kind pinned to the window
      const pinned = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(element => getComputedStyle(element).position === 'fixed' && element.getBoundingClientRect().height > 0)
        .map(element => element.id || element.className));
      expect([screen, pinned]).toEqual([screen, []]);
    }
  });

  it('mob_12 compact top bar rows', async () => {
    for (const screen of ['editor', 'stadium', 'grooves', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      const header = (await box(page, 'header'))!;
      const logo = (await box(page, '.logo'))!;
      const click = (await box(page, '#click-sound-selector'))!;
      const preset = (await box(page, '#preset-selector'))!;
      // The logo alone on the first row; both selectors on the row below it
      expect(click.top).toBeGreaterThanOrEqual(logo.bottom);
      expect(preset.top).toBeGreaterThanOrEqual(logo.bottom);
      expect(Math.abs(click.top - preset.top)).toBeLessThan(2);
      expect(click.right).toBeLessThanOrEqual(preset.left);
      expect(click.bottom).toBeLessThanOrEqual(header.bottom);
      expect(preset.bottom).toBeLessThanOrEqual(header.bottom);
      // No screen link drawn in the header
      for (const tab of await tabs(page)) expect([tab.name, tab.top >= header.bottom]).toEqual([tab.name, true]);
    }
  });

  it('mob_31 top bar pads the top safe area', async () => {
    const page = await openScreen('editor', 375);
    const base = await paddingWithInsets(page, 'header', 'top', 0);
    expect(base).toBeGreaterThan(0);
    expect(await paddingWithInsets(page, 'header', 'top', 47)).toBe(base + 47);
    expect((await box(page, '.logo'))!.top).toBeGreaterThanOrEqual(47);
  });
  it('mob_13 transport bar fixed above the tab bar', async () => {
    const page = await openScreen('editor', 375);
    for (const scrolled of [false, true]) {
      if (scrolled) await scrollToEnd(page);
      if (scrolled) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
      const tabBar = (await box(page, '.view-nav'))!;
      const transport = (await box(page, '#transport-bar'))!;
      expect([scrolled, transport.bottom, transport.left, transport.right]).toEqual([scrolled, tabBar.top, 0, 375]);
      // −, the tempo, + and Play, in that order, each drawn inside the bar
      const parts = await page.evaluate(() => ['#transport-bpm-down', '#transport-bpm', '#transport-bpm-up', '#transport-play'].map(selector => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const { top, bottom, left, right, width } = element.getBoundingClientRect();
        return { text: element.innerText.trim(), top, bottom, left, right, width };
      }));
      expect(parts.map(part => part.text)).toEqual(['−', '120', '+', '▶ PLAY']);
      for (const part of parts) {
        expect(part.width).toBeGreaterThan(0);
        expect(part.top).toBeGreaterThanOrEqual(transport.top);
        expect(part.bottom).toBeLessThanOrEqual(transport.bottom);
        expect(part.right).toBeLessThanOrEqual(375);
      }
      for (let i = 1; i < parts.length; i++) expect(parts[i].left).toBeGreaterThanOrEqual(parts[i - 1].right);
    }
  });

  it('mob_14 transport bar only in the editor', async () => {
    for (const screen of ['stadium', 'grooves', 'improv'] as Screen[]) {
      const page = await openScreen(screen, 375);
      expect([screen, await page.locator('#transport-bar').isVisible()]).toEqual([screen, false]);
      expect([screen, await box(page, '#transport-bar')]).toEqual([screen, null]);
      // Back on the Editor it returns
      await page.click('#nav-editor');
      expect(await page.locator('#transport-bar').isVisible()).toBe(true);
    }
  });

  it('mob_23 track names stay in view while steps scroll', async () => {
    // Tall enough that every row sits above the fixed bars
    const page = await openScreen('editor', 375, 1600);
    const start = await grid(page);
    expect(start.names.map(name => name.name)).toHaveLength(13);
    expect(start.maxScroll).toBeGreaterThan(0);
    await page.evaluate(() => document.querySelector('.grid-scroller')!.scrollTo({ left: 1e6, behavior: 'instant' as ScrollBehavior }));
    await settle(page, '.grid-scroller');
    const end = await grid(page);
    expect(end.scrollLeft).toBeGreaterThan(0);
    expect(Math.abs(end.scrollLeft - end.maxScroll)).toBeLessThan(1);
    for (const name of end.names) {
      expect([name.name, Math.abs(name.left - end.edge) < 0.5, name.onTop]).toEqual([name.name, true, true]);
    }
  });

  it('mob_24 grid snaps to beat starts', async () => {
    const page = await openScreen('editor', 375);
    const start = await grid(page);
    // The step area begins where beat 1 is drawn at rest
    const stepArea = start.beats[0];
    const beat = start.beats[1] - start.beats[0];
    expect(stepArea).toBeGreaterThan(start.names[0].right);
    // Released three quarters of a beat in: past the middle of the first beat, short of the scroll's end
    expect(start.maxScroll).toBeGreaterThan(beat);
    await dragGrid(page, beat * 0.75);
    const end = await grid(page);
    expect(end.scrollLeft).toBeGreaterThan(0);
    const aligned = end.beats.filter(left => Math.abs(left - stepArea) < 1);
    expect([end.scrollLeft, aligned.length]).toEqual([end.scrollLeft, 1]);
  });

  it('mob_27 figure palette is one scrolling row', async () => {
    const page = await openScreen('editor', 375);
    const palette = await page.evaluate(() => {
      const element = document.getElementById('figure-palette')!;
      const frame = element.getBoundingClientRect();
      const chips = [...element.querySelectorAll<HTMLElement>('.figure-btn')].map(chip => chip.getBoundingClientRect().top);
      return { chips, overflow: getComputedStyle(element).overflowX, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, right: frame.right };
    });
    expect(palette.chips).toHaveLength(11);
    for (const top of palette.chips) expect(top).toBe(palette.chips[0]);
    expect(['auto', 'scroll']).toContain(palette.overflow);
    expect(palette.scrollWidth).toBeGreaterThan(palette.clientWidth);
    // It scrolls by itself: the page stays put
    await page.evaluate(() => document.getElementById('figure-palette')!.scrollTo({ left: 1e6, behavior: 'instant' as ScrollBehavior }));
    expect(await page.evaluate(() => document.getElementById('figure-palette')!.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  });

  it('mob_25 right fade marks more steps', async () => {
    const page = await openScreen('editor', 375, 1600);
    const start = await grid(page);
    expect(start.maxScroll).toBeGreaterThan(0);
    expect(await fadeDrawn(page, 'right')).toBe(true);
    await scrollGridTo(page, 1e6);
    expect(await fadeDrawn(page, 'right')).toBe(false);
    // Back with steps beyond the edge, the fade returns
    await scrollGridTo(page, 0);
    expect(await fadeDrawn(page, 'right')).toBe(true);
    // A one-beat bar fits the grid: no fade on either edge
    await page.fill('#time-sig-num', '1');
    await page.locator('#time-sig-num').dispatchEvent('change');
    await page.waitForFunction(() => document.querySelectorAll('.step-count').length === 4);
    expect((await grid(page)).maxScroll).toBe(0);
    expect(await fadeDrawn(page, 'right')).toBe(false);
    expect(await fadeDrawn(page, 'left')).toBe(false);
  });

  it('mob_26 left fade marks hidden steps', async () => {
    const page = await openScreen('editor', 375, 1600);
    expect(await fadeDrawn(page, 'left')).toBe(false);
    const start = await grid(page);
    await scrollGridTo(page, start.beats[1] - start.beats[0]);
    expect((await grid(page)).scrollLeft).toBeGreaterThan(0);
    expect(await fadeDrawn(page, 'left')).toBe(true);
    await scrollGridTo(page, 0);
    expect(await fadeDrawn(page, 'left')).toBe(false);
  });
});
