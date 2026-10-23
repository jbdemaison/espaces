import { CropState, clampOffset, scaleOf, sourceRect } from '../avatar';

const base: CropState = {
  width: 400,
  height: 200,
  viewport: 100,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

describe('profile picture crop', () => {
  it('covers the window at zoom 1: the short side fits exactly', () => {
    expect(scaleOf(base)).toBe(0.5);
    const { sx, sy, side } = sourceRect(base);
    expect(side).toBe(200);
    expect(sx).toBe(100);
    expect(sy).toBe(0);
  });

  it('shows a smaller part of the picture when zoomed in', () => {
    const { side } = sourceRect({ ...base, zoom: 2 });
    expect(side).toBe(100);
  });

  it('never leaves an empty corner', () => {
    const clamped = clampOffset({ ...base, offsetX: 999, offsetY: 999 });
    // at zoom 1 the picture is 200×100 in the window: it can move 50 px sideways only
    expect(clamped).toEqual({ offsetX: 50, offsetY: 0 });
    const { sx } = sourceRect({ ...base, offsetX: 999 });
    expect(sx).toBe(0);
  });

  it('follows the drag: moving the picture right shows its left part', () => {
    const { sx } = sourceRect({ ...base, offsetX: 25 });
    expect(sx).toBe(50);
  });
});
