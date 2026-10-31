const latencyOrZero = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

// Delay between a tick and its sound leaving the device, from what the browser reports
export function visualDelayMs(baseLatency: unknown, outputLatency: unknown): number {
  return (latencyOrZero(baseLatency) + latencyOrZero(outputLatency)) * 1000;
}

export class VisualScheduler {
  private timers = new Set<ReturnType<typeof setTimeout>>();

  schedule(render: () => void, delayMs: number): void {
    if (delayMs === 0) {
      render();
      return;
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      render();
    }, delayMs);
    this.timers.add(timer);
  }

  cancelAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}
