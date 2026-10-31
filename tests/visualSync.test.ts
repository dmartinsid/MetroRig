import { describe, it, expect, vi, afterEach } from 'vitest';
import { visualDelayMs, VisualScheduler } from '../src/visualSync';

describe('Visual sync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sums the valid reported latencies in milliseconds', () => {
    expect(visualDelayMs(0.05, 0.15)).toBeCloseTo(200);
    expect(visualDelayMs(undefined, 0.15)).toBeCloseTo(150);
    expect(visualDelayMs(0.05, NaN)).toBeCloseTo(50);
  });

  it('vis_02 invalid latency gives zero', () => {
    [undefined, null, NaN, Infinity, -Infinity, -0.1, 0, '0.2'].forEach(invalid => {
      expect(visualDelayMs(invalid, invalid)).toBe(0);
    });
  });

  it('runs a render only after its delay', () => {
    vi.useFakeTimers();
    const scheduler = new VisualScheduler();
    const render = vi.fn();

    scheduler.schedule(render, 200);

    vi.advanceTimersByTime(199);
    expect(render).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(render).toHaveBeenCalledOnce();
  });

  it('runs a render synchronously with no delay', () => {
    const scheduler = new VisualScheduler();
    const render = vi.fn();

    scheduler.schedule(render, 0);

    expect(render).toHaveBeenCalledOnce();
  });

  it('cancels every pending render', () => {
    vi.useFakeTimers();
    const scheduler = new VisualScheduler();
    const first = vi.fn();
    const second = vi.fn();
    const afterCancel = vi.fn();

    scheduler.schedule(first, 100);
    scheduler.schedule(second, 200);
    scheduler.cancelAll();
    scheduler.schedule(afterCancel, 50);

    vi.advanceTimersByTime(300);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(afterCancel).toHaveBeenCalledOnce();
  });
});
