import { useEffect } from 'react';

// What react-arborist assumes, as configured by the `TreeView` of `ui-components`:
// rows of 34 px and a padding of 10 px above the first one.
const ROW_HEIGHT = 34;
const PADDING_TOP = 10;
// `TreeViewSeparator` draws the line 2 px above the place it is given
const CURSOR_OFFSET = 2;

/**
 * Puts the drop line of the tree where the dragged item will land.
 *
 * react-arborist places the line at `index × 34 px`, which is only right when every
 * row is 34 px tall. The rooms with people connected are taller, so the line showed
 * far above the place where the room would be dropped. The index of the place is
 * read back from that position, and the line is moved to the matching row.
 */
export const useDropCursorPlacement = (treeRoot: HTMLElement | null) => {
  useEffect(() => {
    if (!treeRoot) {
      return;
    }

    const place = () => {
      const cursor = treeRoot.querySelector<HTMLElement>(
        '.c__tree-view__cursor',
      );
      const parent = cursor?.offsetParent;
      if (!cursor || !parent || cursor.dataset.placed === cursor.style.top) {
        return;
      }
      const rows = Array.from(
        treeRoot.querySelectorAll<HTMLElement>('.c__tree-view--row'),
      );
      const given = parseFloat(cursor.style.top);
      if (rows.length === 0 || Number.isNaN(given)) {
        return;
      }

      const index = Math.round(
        (given + CURSOR_OFFSET - PADDING_TOP) / ROW_HEIGHT,
      );
      const parentTop = parent.getBoundingClientRect().top;
      const y =
        index < rows.length
          ? rows[Math.max(index, 0)].getBoundingClientRect().top - parentTop
          : rows[rows.length - 1].getBoundingClientRect().bottom - parentTop;

      cursor.style.top = `${y - CURSOR_OFFSET}px`;
      cursor.dataset.placed = cursor.style.top;
    };

    const observer = new MutationObserver(place);
    observer.observe(treeRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, [treeRoot]);
};
