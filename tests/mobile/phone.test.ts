import { describe, it, expect, beforeAll, afterAll, afterEach, inject } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

type Screen = 'editor' | 'stadium' | 'grooves' | 'improv';
const SCREENS: Screen[] = ['editor', 'stadium', 'grooves', 'improv'];

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
  // The grid is drawn whichever screen opens first (Stadium on a first visit, AD-030)
  await page.waitForSelector('#grid-container .step-cell', { state: 'attached' });
  await switchScreen(page, screen);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page;
}

// Taps a screen's tab and waits for its view to show
async function switchScreen(page: Page, screen: Screen) {
  await page.click(`#nav-${screen}`);
  await page.waitForSelector(`#${screen}-view:not(.hidden)`);
}

// Waits two frames, so layout and the observers that react to it have run
async function twoFrames(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

// Loads a song and opens the trainer, so the Editor controls it folds away are measured too
async function openEditorTrainer(page: Page) {
  await page.evaluate(() => {
    const preset = document.querySelector<HTMLSelectElement>('#preset-selector')!;
    preset.value = 'song:song_battery';
    preset.dispatchEvent(new Event('change'));
    const body = document.getElementById('trainer-body')!;
    if (body.getBoundingClientRect().height === 0) document.getElementById('trainer-toggle')!.click();
  });
  await page.waitForSelector('#bar-selector:not([hidden])');
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
  await twoFrames(page);
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

// What a select draws as its value: the chosen option's text, measured in the select's own font, against the room its box leaves for text
function selectFit(page: Page, selector: string) {
  return page.evaluate(selector => {
    const select = document.querySelector<HTMLSelectElement>(selector)!;
    const style = getComputedStyle(select);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = select.options[select.selectedIndex].text;
    return {
      text,
      needed: context.measureText(text).width,
      room: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    };
  }, selector);
}

// Every control a thumb taps that the screen draws, with the box it answers to: a checkbox answers to the label around it
function targets(page: Page) {
  return page.evaluate(() => {
    const drawn = (element: Element) => {
      const { width, height } = element.getBoundingClientRect();
      return width > 0 && height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const name = (element: Element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className} ${(element as HTMLElement).innerText?.trim().slice(0, 20) ?? ''}`;
    const controls = [...document.querySelectorAll('button, select, .view-link, input[type=range], input[type=checkbox]')].filter(drawn).map(element => {
      const target = element.matches('input[type=checkbox]') ? element.closest('label') ?? element : element;
      const { width, height } = target.getBoundingClientRect();
      return { control: name(element), width, height };
    });
    // A range thumb is a pseudo-element no box reports: its size is the last width and height the page's styles give it
    const thumbSize = (range: HTMLInputElement) => {
      let width = 0, height = 0;
      const visit = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if (rule instanceof CSSMediaRule) {
            if (matchMedia(rule.conditionText).matches) visit(rule.cssRules);
          } else if (rule instanceof CSSStyleRule) {
            for (const selector of rule.selectorText.split(',').map(part => part.trim())) {
              if (!selector.endsWith('::-webkit-slider-thumb') || !range.matches(selector.replace('::-webkit-slider-thumb', ''))) continue;
              if (rule.style.width) width = parseFloat(rule.style.width);
              if (rule.style.height) height = parseFloat(rule.style.height);
            }
          }
        }
      };
      for (const sheet of document.styleSheets) {
        // The Google Fonts sheet is cross-origin and holds no thumb
        let rules: CSSRuleList | null = null;
        try { rules = sheet.cssRules; } catch { /* not readable */ }
        if (rules) visit(rules);
      }
      return { width, height };
    };
    const thumbs = [...document.querySelectorAll<HTMLInputElement>('input[type=range]')].filter(drawn).map(range => ({
      control: `thumb of #${range.id}`,
      ...thumbSize(range),
    }));
    const cells = [...document.querySelectorAll('.step-cell')].filter(drawn).map(cell => {
      const { width, height } = cell.getBoundingClientRect();
      return { control: 'step-cell', width, height };
    });
    return { controls: [...controls, ...thumbs], cells };
  });
}

// Every control on a screen is a 44 px target and, on the Editor, every step cell 32 px; `where` names the case in a failure
async function expectTargets(page: Page, screen: Screen, where: unknown[]): Promise<string[]> {
  const { controls, cells } = await targets(page);
  expect(controls.length).toBeGreaterThan(3);
  for (const { control, width, height } of controls) {
    expect([...where, screen, control, width >= 44, height >= 44]).toEqual([...where, screen, control, true, true]);
  }
  if (screen === 'editor') {
    expect(cells.length).toBeGreaterThan(0);
    for (const { width, height } of cells) expect([...where, width >= 32, height >= 32]).toEqual([...where, true, true]);
  }
  return controls.map(({ control }) => control);
}

describe('Mobile App', () => {
  it('harness opens the editor at 375', async () => {
    const page = await openScreen('editor', 375);
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    expect(await page.locator('#editor-view').isVisible()).toBe(true);
    expect(await page.locator('#grid-container .step-cell').count()).toBeGreaterThan(0);
  });
  it('mob_05 fields use 16 px text', async () => {
    for (const screen of SCREENS) {
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
        expect(shown.map(tab => [tab.name, tab.icon])).toEqual([['Stadium', true], ['Editor', true], ['Grooves', true], ['Improv', true]]);
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
    for (const screen of SCREENS) {
      const page = await openScreen(screen, 375);
      await scrollToEnd(page);
      // In the Editor the transport bar, and on Stadium its Play button, sit on top of the tab bar, so the page must clear both
      const bar = (await box(page, screen === 'editor' ? '#transport-bar' : screen === 'stadium' ? '#btn-stadium-play' : '.view-nav'))!;
      const view = (await box(page, `#${screen}-view`))!;
      const footer = (await box(page, '.status-bar'))!;
      // The window scrolls in whole pixels, so a fractional page height may leave its end under a pixel low
      expect([screen, view.bottom <= bar.top + 0.5, footer.bottom <= bar.top + 0.5]).toEqual([screen, true, true]);
    }
  });

  it('mob_11 desktop keeps header links', async () => {
    // 768 is the first desktop width, where the header is tightest
    for (const [screen, width] of SCREENS.flatMap(screen => [768, 1280].map(width => [screen, width] as const))) {
      const page = await openScreen(screen, width);
      const header = (await box(page, 'header'))!;
      const shown = await tabs(page);
      expect(shown.map(tab => tab.name)).toEqual(['Stadium', 'Editor', 'Grooves', 'Improv']);
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

  it('mob_40 stadium is the first screen link', async () => {
    for (const width of [375, 1280]) {
      const page = await openScreen('editor', width);
      const shown = await tabs(page);
      // In reading order on screen, not only in the markup
      const onScreen = [...shown].sort((a, b) => a.left - b.left).map(tab => tab.name);
      expect([width, onScreen]).toEqual([width, ['Stadium', 'Editor', 'Grooves', 'Improv']]);
    }
  });

  it('mob_12 compact top bar rows', async () => {
    for (const screen of SCREENS) {
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
  it('mob_43 stadium play fixed above the tab bar', async () => {
    // The narrowest phone, a common one, and the widest window the phone layout applies to
    for (const [width, height] of [[360, 640], [375, 667], [767, 1024]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const scrolled of [false, true]) {
        if (scrolled) await scrollToEnd(page);
        if (scrolled) expect([width, await page.evaluate(() => window.scrollY) > 0]).toEqual([width, true]);
        const tabBar = (await box(page, '.view-nav'))!;
        const play = (await box(page, '#btn-stadium-play'))!;
        // Directly above: no more than the 0.5 rem gap between them, inside the window's width, the full 44 px tall at least
        expect([width, scrolled, play.bottom <= tabBar.top, tabBar.top - play.bottom <= 8.5, play.left >= 0, play.right <= width, play.height >= 44])
          .toEqual([width, scrolled, true, true, true, true, true]);
        // The button is the one on top at its centre, so a tap reaches it rather than what scrolls beneath
        const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#btn-stadium-play') !== null,
          { x: (play.left + play.right) / 2, y: (play.top + play.bottom) / 2 });
        expect([width, scrolled, hit]).toEqual([width, scrolled, true]);
      }
      // It stays with Stadium: on another screen it draws nothing
      await page.click('#nav-grooves');
      expect([width, await box(page, '#btn-stadium-play')]).toEqual([width, null]);
    }
  });

  it('mob_44 desktop stadium play stays in the panel', async () => {
    for (const width of [768, 1280]) {
      const page = await openScreen('stadium', width);
      const panel = (await box(page, '.stadium-panel'))!;
      const play = (await box(page, '#btn-stadium-play'))!;
      expect([width, play.top >= panel.top, play.bottom <= panel.bottom, play.left >= panel.left, play.right <= panel.right])
        .toEqual([width, true, true, true, true]);
      expect([width, await page.evaluate(() => getComputedStyle(document.getElementById('btn-stadium-play')!).position)]).toEqual([width, 'static']);
    }
  });

  // The Stadium parts the tempo screen reads from, top to bottom
  const STADIUM_CONTROLS = ['#stadium-preset-selector', '#stadium-timer', '#btn-stadium-bpm-down', '#stadium-bpm', '#btn-stadium-bpm-up', '#stadium-status-pill', '.orb-row'];

  it('mob_45 stadium controls above the clock', async () => {
    for (const [width, height] of [[360, 640], [375, 667], [390, 844], [430, 932]] as const) {
      const page = await openScreen('stadium', width, height);
      const clock = (await box(page, '.beat-clock'))!;
      for (const selector of STADIUM_CONTROLS) {
        const part = (await box(page, selector))!;
        expect([width, selector, part.bottom <= clock.top]).toEqual([width, selector, true]);
      }
    }
  });

  it('mob_46 stadium fits one screen on taller phones', async () => {
    for (const [width, height] of [[390, 844], [393, 852], [412, 915], [430, 932]] as const) {
      const page = await openScreen('stadium', width, height);
      expect([width, await page.evaluate(() => window.scrollY)]).toEqual([width, 0]);
      const play = (await box(page, '#btn-stadium-play'))!;
      for (const selector of ['#btn-stadium-bpm-down', '#stadium-bpm', '#btn-stadium-bpm-up', '.orb-row', '.beat-clock', '.clock-legend']) {
        const part = (await box(page, selector))!;
        expect([width, selector, part.top >= 0, part.left >= 0, part.right <= width, part.bottom <= play.top])
          .toEqual([width, selector, true, true, true, true]);
      }
      const clock = (await box(page, '.beat-clock'))!;
      expect([width, clock.width >= 200]).toEqual([width, true]);
    }
  });

  it('mob_47 stadium tempo first on short phones', async () => {
    for (const [width, height] of [[360, 640], [375, 667]] as const) {
      const page = await openScreen('stadium', width, height);
      expect([width, await page.evaluate(() => window.scrollY)]).toEqual([width, 0]);
      const play = (await box(page, '#btn-stadium-play'))!;
      for (const selector of ['#btn-stadium-bpm-down', '#stadium-bpm', '#btn-stadium-bpm-up']) {
        const part = (await box(page, selector))!;
        expect([width, selector, part.top >= 0, part.bottom <= play.top]).toEqual([width, selector, true, true]);
      }
      const orbs = (await box(page, '.orb-row'))!;
      const clock = (await box(page, '.beat-clock'))!;
      expect([width, clock.width >= 240, clock.top >= orbs.bottom]).toEqual([width, true, true]);
    }
  });

  it('mob_48 stadium clock never shrinks under its floor', async () => {
    // Between the named sizes, installed iPhones with their insets, and a Trainer status that wraps to two lines
    const cases = [
      { width: 360, height: 780, top: 0, bottom: 0, trainer: false },
      { width: 412, height: 800, top: 0, bottom: 0, trainer: false },
      { width: 390, height: 844, top: 47, bottom: 34, trainer: false },
      { width: 375, height: 812, top: 44, bottom: 34, trainer: false },
      { width: 390, height: 844, top: 0, bottom: 0, trainer: true },
      // The narrowest phones, where the legend wraps to two rows
      { width: 320, height: 815, top: 0, bottom: 0, trainer: false },
      { width: 335, height: 819, top: 0, bottom: 0, trainer: false },
    ];
    for (const { width, height, top, bottom, trainer } of cases) {
      const label = `${width}x${height} insets ${top}/${bottom}${trainer ? ' trainer' : ''}`;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      pages.push(page);
      if (top || bottom) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride' as any, { insets: { top, bottom, left: 0, right: 0 } });
      }
      await page.goto(inject('baseUrl'));
      await page.click('#nav-stadium');
      await page.waitForSelector('#stadium-view:not(.hidden)');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      if (trainer) {
        await page.evaluate(() => {
          const routine = document.querySelector<HTMLSelectElement>('#stadium-preset-selector')!;
          routine.value = [...routine.options].find(option => option.value && !option.disabled)!.value;
          routine.dispatchEvent(new Event('change'));
        });
      }
      await twoFrames(page);
      const clock = (await box(page, '.beat-clock'))!;
      expect([label, clock.width >= 200]).toEqual([label, true]);
      await scrollToEnd(page);
      const play = (await box(page, '#btn-stadium-play'))!;
      const legend = (await box(page, '.clock-legend'))!;
      expect([label, legend.bottom <= play.top]).toEqual([label, true]);
    }
  });

  it('mob_48 stadium clock follows a bottom inset that changes after load', async () => {
    for (const [width, height] of [[390, 844], [412, 860]] as const) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      pages.push(page);
      await page.goto(inject('baseUrl'));
      await page.click('#nav-stadium');
      await page.waitForSelector('#stadium-view:not(.hidden)');
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      // Only the bottom inset changes, with no resize of the window
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride' as any, { insets: { top: 0, bottom: 34, left: 0, right: 0 } });
      await page.waitForTimeout(300);
      const clock = (await box(page, '.beat-clock'))!;
      expect([width, clock.width >= 200]).toEqual([width, true]);
      await scrollToEnd(page);
      const play = (await box(page, '#btn-stadium-play'))!;
      const legend = (await box(page, '.clock-legend'))!;
      expect([width, legend.bottom <= play.top]).toEqual([width, true]);
    }
  });

  it('mob_49 trainer status never covers the timer', async () => {
    for (const width of [320, 360, 375, 390, 430]) {
      const page = await openScreen('stadium', width, 844);
      const routines = await page.$$eval('#stadium-preset-selector option', options =>
        options.filter(option => option.value && !option.disabled).map(option => option.value));
      expect(routines.length).toBeGreaterThan(0);
      // The Trainer off first, then every routine
      for (const routine of [null, ...routines]) {
        if (routine) await page.selectOption('#stadium-preset-selector', routine);
        const { timer, status, panel, text, scrollWidth } = await page.evaluate(() => {
          const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect().toJSON();
          // The status words themselves, line by line, not the pill that holds them
          const range = document.createRange();
          range.selectNodeContents(document.getElementById('stadium-status')!);
          const lines = [...range.getClientRects()].filter(r => r.width > 0);
          const status = {
            left: Math.min(...lines.map(r => r.left)), right: Math.max(...lines.map(r => r.right)),
            top: Math.min(...lines.map(r => r.top)), bottom: Math.max(...lines.map(r => r.bottom)),
          };
          return {
            timer: rect('stadium-timer'), status, panel: document.querySelector('.stadium-panel')!.getBoundingClientRect().toJSON(),
            text: document.getElementById('stadium-status')!.textContent, scrollWidth: document.documentElement.scrollWidth,
          };
        });
        const apart = timer.right <= status.left || status.right <= timer.left || timer.bottom <= status.top || status.bottom <= timer.top;
        const inside = [timer, status].every(r => r.left >= panel.left && r.right <= panel.right);
        expect([width, text, apart, inside, scrollWidth]).toEqual([width, text, true, true, width]);
      }
    }
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

  it('mob_01 no sideways page scroll at 360 375 390 430', async () => {
    for (const width of [360, 375, 390, 430]) {
      for (const screen of SCREENS) {
        const page = await openScreen(screen, width);
        const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        expect([width, screen, scrollWidth]).toEqual([width, screen, width]);
        await page.context().close();
      }
    }
  });

  it('mob_02 header selectors show their value in full at 360', async () => {
    const page = await openScreen('editor', 360);
    const sounds = await page.evaluate(() => [...document.querySelectorAll<HTMLOptionElement>('#click-sound-selector option')].map(option => option.value));
    expect(sounds).toHaveLength(5);
    for (const sound of sounds) {
      await page.selectOption('#click-sound-selector', sound);
      const fit = await selectFit(page, '#click-sound-selector');
      expect([fit.text, fit.needed <= fit.room]).toEqual([fit.text, true]);
    }
    await page.selectOption('#preset-selector', { label: '4/4 Metronome' });
    const preset = await selectFit(page, '#preset-selector');
    expect([preset.text, preset.needed <= preset.room]).toEqual(['4/4 Metronome', true]);
    // Still side by side, inside the window
    const click = (await box(page, '.click-field'))!;
    const presets = (await box(page, '#preset-selector'))!;
    expect(Math.abs(click.top - presets.top)).toBeLessThan(2);
    expect(click.right).toBeLessThanOrEqual(presets.left);
    expect(click.left).toBeGreaterThanOrEqual(0);
    expect(presets.right).toBeLessThanOrEqual(360);
  });

  it('mob_03 stadium orbs and tempo buttons inside the panel at 360', async () => {
    const page = await openScreen('stadium', 360);
    const panel = (await box(page, '.stadium-panel'))!;
    const parts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.stadium-panel .orb, .stadium-panel .orb-name, #btn-stadium-bpm-down, #btn-stadium-bpm-up')].map(element => {
      const { left, right, top, bottom, width } = element.getBoundingClientRect();
      // Text cut by its box draws wider than the box
      return { part: element.id || element.innerText || element.className, left, right, top, bottom, width, cut: element.scrollWidth > element.clientWidth };
    }));
    expect(parts.filter(part => /^orb-\d$/.test(part.part))).toHaveLength(4);
    expect(parts.map(part => part.part).filter(part => /^[A-Z/]+$/.test(part))).toEqual(['CLICK', 'KICK', 'SNARE/TOMS', 'CYMBALS']);
    for (const part of parts) {
      expect([part.part, part.width > 0, part.left >= panel.left, part.right <= panel.right, part.top >= panel.top, part.bottom <= panel.bottom, part.cut])
        .toEqual([part.part, true, true, true, true, true, false]);
    }
    // Each name reads on its own: none runs into the next
    const names = parts.filter(part => /^[A-Z/]+$/.test(part.part));
    for (let i = 1; i < names.length; i++) expect([names[i].part, names[i].left >= names[i - 1].right]).toEqual([names[i].part, true]);
  });

  it('mob_04 touch targets 44 px and step cells 32 px', async () => {
    // 360 is the narrowest phone, 767 the widest window the phone layout applies to
    for (const [screen, width] of SCREENS.flatMap(screen => [360, 375, 767].map(width => [screen, width] as const))) {
      const page = await openScreen(screen, width);
      // Open what a screen folds away, so its controls are measured too
      if (screen === 'editor') {
        await openEditorTrainer(page);
        await page.waitForTimeout(400);
      }
      await expectTargets(page, screen, [width]);
    }
  });

  it('prt_01 no sideways page scroll on portrait desktop windows', async () => {
    for (const [width, height] of [[540, 960], [720, 1280], [900, 1600], [1080, 1800], [1080, 1920], [768, 1024]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const screen of SCREENS) {
        await switchScreen(page, screen);
        const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
        expect([width, height, screen, scrollWidth]).toEqual([width, height, screen, width]);
      }
      await page.context().close();
    }
  });

  it('prt_02 compact header and fixed bottom tab bar on portrait desktop', async () => {
    for (const [width, height] of [[768, 1024], [900, 1600], [1080, 1800], [1080, 1920]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const screen of SCREENS) {
        await switchScreen(page, screen);
        const header = (await box(page, 'header'))!;
        const logo = (await box(page, '.logo'))!;
        const click = (await box(page, '#click-sound-selector'))!;
        const preset = (await box(page, '#preset-selector'))!;
        expect([width, height, screen, click.top >= logo.bottom, preset.top >= logo.bottom]).toEqual([width, height, screen, true, true]);
        expect(Math.abs(click.top - preset.top)).toBeLessThan(2);
        expect(click.right).toBeLessThanOrEqual(preset.left);
        expect(click.bottom).toBeLessThanOrEqual(header.bottom);
        expect(preset.bottom).toBeLessThanOrEqual(header.bottom);
        for (const tab of await tabs(page)) expect([screen, tab.name, tab.top >= header.bottom]).toEqual([screen, tab.name, true]);

        for (const scrolled of [false, true]) {
          if (scrolled) await scrollToEnd(page);
          const bar = (await box(page, '.view-nav'))!;
          expect([width, height, screen, scrolled, bar.bottom, bar.left, bar.right]).toEqual([width, height, screen, scrolled, height, 0, width]);
          const shown = await tabs(page);
          expect(shown.map(tab => [tab.name, tab.icon])).toEqual([['Stadium', true], ['Editor', true], ['Grooves', true], ['Improv', true]]);
          for (const tab of shown) {
            expect(tab.top).toBeGreaterThanOrEqual(bar.top);
            expect(tab.bottom).toBeLessThanOrEqual(bar.bottom);
            expect(tab.top).toBe(shown[0].top);
          }
          expect(shown.map(tab => tab.left)).toEqual([...shown.map(tab => tab.left)].sort((a, b) => a - b));
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.context().close();
    }
  });

  it('prt_03 stadium full-width panel, square clock and fixed play on 9:16 desktop', async () => {
    for (const [width, height] of [[900, 1600], [1080, 1800], [1080, 1920]] as const) {
      const page = await openScreen('stadium', width, height);
      await twoFrames(page);
      expect([width, height, await page.evaluate(() => window.scrollY)]).toEqual([width, height, 0]);
      const layout = await page.evaluate(() => {
        const display = document.querySelector<HTMLElement>('.stadium-display')!;
        const style = getComputedStyle(display);
        const rect = display.getBoundingClientRect();
        const panel = document.querySelector<HTMLElement>('.stadium-panel')!.getBoundingClientRect();
        return {
          innerLeft: rect.left + parseFloat(style.paddingLeft),
          innerRight: rect.right - parseFloat(style.paddingRight),
          panelLeft: panel.left,
          panelRight: panel.right,
        };
      });
      expect(Math.abs(layout.panelLeft - layout.innerLeft)).toBeLessThan(1);
      expect(Math.abs(layout.panelRight - layout.innerRight)).toBeLessThan(1);

      const clock = (await box(page, '.beat-clock'))!;
      for (const selector of STADIUM_CONTROLS) {
        const part = (await box(page, selector))!;
        expect([width, height, selector, part.bottom <= clock.top]).toEqual([width, height, selector, true]);
      }

      const playAtZero = (await box(page, '#btn-stadium-play'))!;
      for (const selector of ['#btn-stadium-bpm-down', '#stadium-bpm', '#btn-stadium-bpm-up', '.orb-row', '.beat-clock', '.clock-legend']) {
        const part = (await box(page, selector))!;
        expect([width, height, selector, part.top >= 0, part.left >= 0, part.right <= width, part.bottom <= playAtZero.top])
          .toEqual([width, height, selector, true, true, true, true]);
      }
      const legend = (await box(page, '.clock-legend'))!;
      expect([width, height, clock.width >= 200, Math.abs(clock.width - clock.height) <= 1, legend.top >= clock.bottom && legend.top - clock.bottom <= 8])
        .toEqual([width, height, true, true, true]);

      for (const scrolled of [false, true]) {
        if (scrolled) await scrollToEnd(page);
        const tabBar = (await box(page, '.view-nav'))!;
        const play = (await box(page, '#btn-stadium-play'))!;
        expect([width, height, scrolled, play.bottom <= tabBar.top, tabBar.top - play.bottom <= 8.5, play.left >= 0, play.right <= width, play.height >= 44])
          .toEqual([width, height, scrolled, true, true, true, true, true]);
      }
      await page.context().close();
    }
  });

  it('prt_04 editor single column, transport bar, one-row palette and sticky grid on portrait desktop', async () => {
    for (const [width, height] of [[768, 1024], [900, 1600], [1080, 1800], [1080, 1920]] as const) {
      const page = await openScreen('editor', width, height);
      const seq = (await box(page, '.sequencer-column'))!;
      const controls = (await box(page, '.controls-container'))!;
      expect([width, height, controls.top >= seq.bottom, Math.abs(seq.left - controls.left) < 1, Math.abs(seq.width - controls.width) < 1])
        .toEqual([width, height, true, true, true]);

      for (const scrolled of [false, true]) {
        if (scrolled) await scrollToEnd(page);
        const tabBar = (await box(page, '.view-nav'))!;
        const transport = (await box(page, '#transport-bar'))!;
        expect([width, height, scrolled, transport.bottom, transport.left, transport.right]).toEqual([width, height, scrolled, tabBar.top, 0, width]);
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
          expect(part.right).toBeLessThanOrEqual(width);
        }
        for (let i = 1; i < parts.length; i++) expect(parts[i].left).toBeGreaterThanOrEqual(parts[i - 1].right);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await twoFrames(page);

      const palette = await page.evaluate(() => {
        const element = document.getElementById('figure-palette')!;
        const chips = [...element.querySelectorAll<HTMLElement>('.figure-btn')].map(chip => chip.getBoundingClientRect().top);
        return { chips, overflow: getComputedStyle(element).overflowX };
      });
      expect(palette.chips).toHaveLength(11);
      for (const top of palette.chips) expect(top).toBe(palette.chips[0]);
      expect(['auto', 'scroll']).toContain(palette.overflow);

      if (width === 1080 && height === 1920) {
        expect((await grid(page)).maxScroll).toBe(0);
        expect(await fadeDrawn(page, 'left')).toBe(false);
        expect(await fadeDrawn(page, 'right')).toBe(false);
      }

      await page.fill('#time-sig-num', '8');
      await page.locator('#time-sig-num').dispatchEvent('change');
      await page.waitForFunction(() => document.querySelectorAll('.step-count').length === 32);
      // Filling #time-sig-num below the sequencer scrolls the page down, so return to the top before clipping the grid
      await page.evaluate(() => window.scrollTo(0, 0));
      await twoFrames(page);
      await settle(page, '.grid-scroller');
      const wideStart = await grid(page);
      expect([width, height, wideStart.maxScroll > 0]).toEqual([width, height, true]);
      expect(await fadeDrawn(page, 'left')).toBe(false);
      expect(await fadeDrawn(page, 'right')).toBe(true);
      await scrollGridTo(page, 1e6);
      const wideEnd = await grid(page);
      expect(wideEnd.scrollLeft).toBeGreaterThan(0);
      expect(Math.abs(wideEnd.scrollLeft - wideEnd.maxScroll)).toBeLessThan(1);
      for (const name of wideEnd.names) {
        expect([width, height, name.name, Math.abs(name.left - wideEnd.edge) < 0.5, name.onTop]).toEqual([width, height, name.name, true, true]);
      }
      expect(await fadeDrawn(page, 'left')).toBe(true);
      expect(await fadeDrawn(page, 'right')).toBe(false);

      await page.context().close();
    }
  });

  it('prt_05 touch targets 44 px, step cells 32 px and fields 16 px on portrait desktop', async () => {
    for (const [width, height] of [[768, 1024], [900, 1600], [1080, 1920]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const screen of SCREENS) {
        await switchScreen(page, screen);
        if (screen === 'editor') {
          await openEditorTrainer(page);
          await page.evaluate(() => document.querySelector<HTMLElement>('#grid-container .step-cell')!.click());
          await page.waitForFunction(() => document.getElementById('save-toast')!.getBoundingClientRect().height > 0);
          await page.waitForTimeout(400);
        }
        const controls = await expectTargets(page, screen, [width, height]);
        if (screen === 'editor') expect(controls.some(control => control.includes('btn-save'))).toBe(true);
        const sizes = await computed(page, 'input, select', 'font-size');
        expect(sizes.length).toBeGreaterThan(10);
        for (const [field, size] of sizes) expect([width, height, screen, field, parseFloat(size) >= 16]).toEqual([width, height, screen, field, true]);
      }
      await page.context().close();
    }
  });

  it('prt_06 last element clears the fixed bars on portrait desktop', async () => {
    for (const [width, height] of [[768, 1024], [900, 1600], [1080, 1920]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const screen of SCREENS) {
        await switchScreen(page, screen);
        await scrollToEnd(page);
        const bar = (await box(page, screen === 'editor' ? '#transport-bar' : screen === 'stadium' ? '#btn-stadium-play' : '.view-nav'))!;
        const view = (await box(page, `#${screen}-view`))!;
        const footer = (await box(page, '.status-bar'))!;
        expect([width, height, screen, view.bottom <= bar.top + 0.5, footer.bottom <= bar.top + 0.5]).toEqual([width, height, screen, true, true]);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.context().close();
    }
  });

  it('prt_07 desktop windows wider than 3:4 keep the desktop layout', async () => {
    for (const [width, height] of [[768, 800], [769, 1024], [900, 600], [1280, 800], [1920, 1080]] as const) {
      const page = await openScreen('stadium', width, height);
      for (const screen of SCREENS) {
        await switchScreen(page, screen);
        const header = (await box(page, 'header'))!;
        const shown = await tabs(page);
        expect(shown.map(tab => [tab.name, tab.icon])).toEqual([['Stadium', false], ['Editor', false], ['Grooves', false], ['Improv', false]]);
        for (const tab of shown) {
          expect(tab.top).toBeGreaterThanOrEqual(header.top);
          expect(tab.bottom).toBeLessThanOrEqual(header.bottom);
        }
        const pinned = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')]
          .filter(element => getComputedStyle(element).position === 'fixed' && element.getBoundingClientRect().height > 0)
          .map(element => element.id || element.className));
        expect([width, height, screen, pinned]).toEqual([width, height, screen, []]);
        expect([width, height, screen, await box(page, '#transport-bar')]).toEqual([width, height, screen, null]);
        if (screen === 'stadium') {
          const panel = (await box(page, '.stadium-panel'))!;
          const play = (await box(page, '#btn-stadium-play'))!;
          expect([width, height, play.top >= panel.top, play.bottom <= panel.bottom, play.left >= panel.left, play.right <= panel.right])
            .toEqual([width, height, true, true, true, true]);
          expect([width, height, await page.evaluate(() => getComputedStyle(document.getElementById('btn-stadium-play')!).position)]).toEqual([width, height, 'static']);
        }
      }
      await page.context().close();
    }
  });
});
