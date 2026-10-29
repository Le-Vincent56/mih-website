import { describe, expect, test } from 'vitest';
import { FRONT_ROW, HEADER_DELAY, ROW_COUNT, ROW_STAGGER, ROW_TEXT, heroRows } from './rows';

describe('heroRows', () => {
  const rows = heroRows();

  test('renders enough rows for phones', () => {
    expect(ROW_COUNT).toBe(7);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('alternates solid rows entering from the right with outline rows entering from the left', () => {
    expect(rows.map((row) => row.style)).toEqual([
      'solid',
      'outline',
      'solid',
      'outline',
      'solid',
      'outline',
      'solid',
    ]);
    for (const row of rows) {
      expect(row.enters).toBe(row.style === 'solid' ? 'right' : 'left');
    }
  });

  test('staggers every row equally from the top', () => {
    expect(ROW_STAGGER).toBe(0.15);
    expect(rows.map((row) => row.delay)).toEqual([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);
  });

  test('marks the outline-crossing row for each breakpoint, both solid', () => {
    expect(FRONT_ROW).toEqual({ desktop: 2, phone: 4 });
    expect(rows[FRONT_ROW.desktop].style).toBe('solid');
    expect(rows[FRONT_ROW.phone].style).toBe('solid');
  });

  test('keeps the row text and header timing', () => {
    expect(ROW_TEXT).toBe('MADE IN HOUSE');
    expect(HEADER_DELAY).toBe(1.7);
  });
});
