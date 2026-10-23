import { create } from 'zustand';

import { IncomingInvitation, Occupant } from '../types';

/** A person who is reachable from a space, whom the user is about to invite. */
export interface InviteRequest {
  spaceId: string;
  person: Occupant;
  /** the room the person is in: no point in inviting them there */
  excludeRoomId?: string;
}

/** An invitation the user sent, whose fate is followed until it ends. */
export interface OutgoingInvitation {
  id: string;
  name: string;
  roomId: string;
  deadline: number;
}

interface InvitationsState {
  /** the dialog asking to confirm an invitation */
  request?: InviteRequest;
  incoming: IncomingInvitation[];
  outgoing: OutgoingInvitation[];
  ask: (request: InviteRequest) => void;
  cancelAsk: () => void;
  receive: (invitation: IncomingInvitation) => void;
  dismiss: (id: string) => void;
  follow: (invitation: OutgoingInvitation) => void;
  unfollow: (id: string) => void;
}

/** Invitations sent and received by this browser: shown by `InvitationsHost`. */
export const useInvitations = create<InvitationsState>((set) => ({
  request: undefined,
  incoming: [],
  outgoing: [],
  ask: (request) => set({ request }),
  cancelAsk: () => set({ request: undefined }),
  receive: (invitation) =>
    set((state) =>
      state.incoming.some((item) => item.id === invitation.id)
        ? state
        : { incoming: [...state.incoming, invitation] },
    ),
  dismiss: (id) =>
    set((state) => ({
      incoming: state.incoming.filter((item) => item.id !== id),
    })),
  follow: (invitation) =>
    set((state) => ({ outgoing: [...state.outgoing, invitation] })),
  unfollow: (id) =>
    set((state) => ({
      outgoing: state.outgoing.filter((item) => item.id !== id),
    })),
}));
