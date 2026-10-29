import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

// The gate is an inline script in index.html (it must run before first paint, ahead of any
// bundle), so the test runs the real script text against a fake document.
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const match = html.match(/<script id="mih-motion-gate">([\s\S]*?)<\/script>/);

interface Harness {
  classes: Set<string>;
  motionAdds: () => number;
  resolveFont: () => Promise<void>;
  rejectFont: () => Promise<void>;
  runTimers: (upTo: number) => void;
  fontRequests: string[];
}

function runGate(options: { fonts?: 'present' | 'missing' } = {}): Harness {
  const classes = new Set<string>();
  const added: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const fontRequests: string[] = [];
  let settle: { resolve: () => void; reject: (e: Error) => void } | undefined;

  const document = {
    documentElement: {
      classList: {
        add: (name: string) => {
          added.push(name);
          classes.add(name);
        },
      },
    },
    fonts:
      options.fonts === 'missing'
        ? undefined
        : {
            load: (font: string) => {
              fontRequests.push(font);
              return new Promise<void>((resolve, reject) => {
                settle = { resolve, reject };
              });
            },
          },
  };
  const setTimeout = (fn: () => void, ms: number) => {
    timers.push({ fn, ms });
  };

  runInNewContext(match![1], { document, setTimeout });

  const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
  return {
    classes,
    fontRequests,
    motionAdds: () => added.filter((name) => name === 'mih-motion').length,
    resolveFont: async () => {
      settle?.resolve();
      await flush();
    },
    rejectFont: async () => {
      settle?.reject(new Error('font failed'));
      await flush();
    },
    runTimers: (upTo) => {
      for (const timer of timers.filter((t) => t.ms <= upTo)) timer.fn();
    },
  };
}

describe('motion gate script', () => {
  test('is present in index.html', () => {
    expect(match).not.toBeNull();
  });

  test('adds mih-js synchronously', () => {
    const gate = runGate();
    expect(gate.classes.has('mih-js')).toBe(true);
    expect(gate.classes.has('mih-motion')).toBe(false);
  });

  test('adds mih-motion once Koulen has loaded', async () => {
    const gate = runGate();
    expect(gate.fontRequests).toEqual(['1em Koulen']);
    await gate.resolveFont();
    expect(gate.classes.has('mih-motion')).toBe(true);
  });

  test('adds mih-motion after 1500ms if the font never loads', () => {
    const gate = runGate();
    gate.runTimers(1499);
    expect(gate.classes.has('mih-motion')).toBe(false);
    gate.runTimers(1500);
    expect(gate.classes.has('mih-motion')).toBe(true);
  });

  test('adds mih-motion only once when both the font and the timeout fire', async () => {
    const gate = runGate();
    await gate.resolveFont();
    gate.runTimers(1500);
    expect(gate.motionAdds()).toBe(1);
  });

  test('adds mih-motion when the font fails to load', async () => {
    const gate = runGate();
    await gate.rejectFont();
    expect(gate.classes.has('mih-motion')).toBe(true);
  });

  test('adds mih-motion immediately when the font API is missing', () => {
    const gate = runGate({ fonts: 'missing' });
    expect(gate.classes.has('mih-js')).toBe(true);
    expect(gate.classes.has('mih-motion')).toBe(true);
  });
});
