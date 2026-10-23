import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDropCursorPlacement } from '../useDropCursorPlacement';

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height }) as DOMRect;

/** A tree of three rows of 100 px, the first one starting at y = 200. */
const buildTree = () => {
  const root = document.createElement('div');
  const parent = document.createElement('div');
  parent.getBoundingClientRect = () => rect(200, 300);
  root.appendChild(parent);
  [200, 300, 400].forEach((top) => {
    const row = document.createElement('div');
    row.className = 'c__tree-view--row';
    row.getBoundingClientRect = () => rect(top, 100);
    parent.appendChild(row);
  });
  const cursor = document.createElement('div');
  cursor.className = 'c__tree-view__cursor';
  Object.defineProperty(cursor, 'offsetParent', { value: parent });
  return { root, parent, cursor };
};

describe('useDropCursorPlacement', () => {
  it('moves the line to the row where the item will land', async () => {
    const { root, parent, cursor } = buildTree();
    renderHook(() => useDropCursorPlacement(root));

    // what react-arborist computes for the place 1: 1 × 34 + 10 - 2
    cursor.style.top = '42px';
    parent.appendChild(cursor);

    // the second row starts 100 px below the top, and the line is 2 px above
    await waitFor(() => expect(cursor.style.top).toBe('98px'));
  });

  it('puts the line under the last row for the last place', async () => {
    const { root, parent, cursor } = buildTree();
    renderHook(() => useDropCursorPlacement(root));

    // place 3: 3 × 34 + 10 - 2
    cursor.style.top = '110px';
    parent.appendChild(cursor);

    await waitFor(() => expect(cursor.style.top).toBe('298px'));
  });

  it('puts the line above the first row for the first place', async () => {
    const { root, parent, cursor } = buildTree();
    renderHook(() => useDropCursorPlacement(root));

    cursor.style.top = '8px';
    parent.appendChild(cursor);

    await waitFor(() => expect(cursor.style.top).toBe('-2px'));
  });

  it('follows the line when the place changes, and then leaves it alone', async () => {
    const { root, parent, cursor } = buildTree();
    renderHook(() => useDropCursorPlacement(root));
    cursor.style.top = '42px';
    parent.appendChild(cursor);
    await waitFor(() => expect(cursor.style.top).toBe('98px'));

    cursor.style.top = '76px';
    await waitFor(() => expect(cursor.style.top).toBe('198px'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cursor.style.top).toBe('198px');
  });

  it('does nothing without a tree', () => {
    expect(() => renderHook(() => useDropCursorPlacement(null))).not.toThrow();
  });
});
