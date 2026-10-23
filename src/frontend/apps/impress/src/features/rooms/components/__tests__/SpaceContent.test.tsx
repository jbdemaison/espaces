import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsOffline } from '@/features/service-worker';
import { AppWrapper } from '@/tests/utils';

import { SpaceContent } from '../SpaceContent';

vi.mock('@/docs/doc-header', () => ({
  DocHeader: () => <div data-testid="doc-header" />,
}));
vi.mock('../RoomStage', () => ({ RoomStage: () => <div /> }));

const room = { id: 'r1', kind: 'room', abilities: {} } as never;
const space = { id: 's1', kind: 'folder', abilities: {} } as never;

describe('<SpaceContent />', () => {
  beforeEach(() => {
    useIsOffline.setState({ isOffline: false });
  });

  it('shows no banner while online', () => {
    render(<SpaceContent doc={room} />, { wrapper: AppWrapper });

    expect(document.querySelector('.--docs--alert-offline')).toBeNull();
  });

  it('shows the offline banner of a room above its header, away from the Chat button', () => {
    useIsOffline.setState({ isOffline: true });
    render(<SpaceContent doc={room} />, { wrapper: AppWrapper });

    const banner = document.querySelector('.--docs--alert-offline');
    const header = screen.getByTestId('doc-header');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('video');
    // the banner comes before the header, which holds the Chat button
    expect(
      banner!.compareDocumentPosition(header) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(header.parentElement?.contains(banner)).toBe(false);
  });

  it('leaves the banner of a space to its header', () => {
    useIsOffline.setState({ isOffline: true });
    render(<SpaceContent doc={space} />, { wrapper: AppWrapper });

    expect(document.querySelector('.--docs--alert-offline')).toBeNull();
  });
});
