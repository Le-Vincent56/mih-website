// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { createRunner, write } from './animation';

const timing = { duration: 300, delay: 0, easing: 'linear' };
let calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
const cancel = vi.fn();

beforeEach(() => {
  calls = [];
  cancel.mockClear();
  Element.prototype.animate = function (keyframes, options) {
    calls.push({
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
    });
    return { cancel, finished: Promise.resolve() } as unknown as Animation;
  };
});

test('write commits clip-path and translate, and skips offset', () => {
  const el = document.createElement('div');
  write(el, { clipPath: 'polygon(0px 0px, 1px 0px, 1px 1px)', translate: '10% 0px', offset: 0.3 });
  expect(el.style.clipPath).toBe('polygon(0px 0px, 1px 0px, 1px 1px)');
  expect(el.style.translate).toBe('10% 0px');
  expect(el.getAttribute('style')).not.toContain('offset');
});

test('play commits the last frame and cancels once finished', async () => {
  const el = document.createElement('div');
  const runner = createRunner();
  const frames: Keyframe[] = [
    { opacity: 0, transform: 'translateY(110%)' },
    { opacity: 1, offset: 0.3 },
    { opacity: 1, transform: 'none' },
  ];
  const animation = runner.play(el, frames, timing);

  expect(el.style.opacity).toBe('1');
  expect(el.style.transform).toBe('none');
  expect(calls[0]).toEqual({ keyframes: frames, options: { fill: 'both', ...timing } });
  await animation.finished;
  await Promise.resolve();
  expect(cancel).toHaveBeenCalled();
  expect(runner.running.size).toBe(0);
});

test('run is play with two frames', () => {
  const el = document.createElement('div');
  createRunner().run(el, { opacity: 0 }, { opacity: 1 }, timing);
  expect(calls[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  expect(el.style.opacity).toBe('1');
});
