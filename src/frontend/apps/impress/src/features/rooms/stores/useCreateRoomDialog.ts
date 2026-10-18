import { create } from 'zustand';

interface CreateRoomDialogState {
  /** Set while the dialog is open: `parentId` is empty to create a space. */
  request?: { parentId?: string };
  open: (parentId?: string) => void;
  close: () => void;
}

/** One dialog for every "New" of the product: the button, the tree, the menus. */
export const useCreateRoomDialog = create<CreateRoomDialogState>((set) => ({
  request: undefined,
  open: (parentId) => set({ request: { parentId } }),
  close: () => set({ request: undefined }),
}));
