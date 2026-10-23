import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { AppWrapper } from '@/tests/utils';

import { Doc } from '../../types';
import { ModalRemoveDoc } from '../ModalRemoveDoc';

const removeMock = vi.fn();
vi.mock('../../api/useRemoveDoc', () => ({
  useRemoveDoc: () => ({ mutate: removeMock, isError: false, error: null }),
}));
vi.mock('@/core', () => ({ useConfig: () => ({ data: {} }) }));
vi.mock('../../hooks', () => ({ useDocUtils: () => ({ hasChildren: false }) }));

const doc = (kind: string) =>
  ({ id: 'd1', kind, title: 'X' }) as unknown as Doc;

const deleteButton = () =>
  screen.getByRole('button', { name: /Delete document|Supprimer le document/ });

describe('<ModalRemoveDoc />', () => {
  test('a space is only deleted after answering a small sum', async () => {
    removeMock.mockClear();
    render(<ModalRemoveDoc doc={doc('folder')} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });

    const label = screen.getByText(/\d \+ \d/).textContent ?? '';
    const [, a, b] = /(\d) \+ (\d)/.exec(label) ?? [];
    expect(Number(a) + Number(b)).toBeLessThanOrEqual(9);
    expect(deleteButton()).toBeDisabled();

    const input = screen.getByTestId('remove-doc-sum');
    await userEvent.type(input, String(Number(a) + Number(b) + 1));
    expect(deleteButton()).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, String(Number(a) + Number(b)));
    expect(deleteButton()).toBeEnabled();
    await userEvent.click(deleteButton());
    expect(removeMock).toHaveBeenCalledWith({ docId: 'd1' });
  });

  test('a plain document is deleted without the sum', () => {
    render(<ModalRemoveDoc doc={doc('document')} onClose={vi.fn()} />, {
      wrapper: AppWrapper,
    });
    expect(screen.queryByTestId('remove-doc-sum')).toBeNull();
    expect(deleteButton()).toBeEnabled();
  });
});
