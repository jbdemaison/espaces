import { create } from 'zustand';

interface RoomChatState {
  /** the chat column is open */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** Whether the chat of the video room is shown. Shared by the page header and the room. */
export const useRoomChat = create<RoomChatState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

export const CHAT_WIDTH = 360;
