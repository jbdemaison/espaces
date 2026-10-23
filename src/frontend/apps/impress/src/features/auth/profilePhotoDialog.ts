import { create } from 'zustand';

/** Whether the dialog choosing the profile picture is open (shown by `ProfilePhotoHost`). */
export const useProfilePhotoDialog = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
