/** What a person says about their situation: an emoji and a short text. */
export interface Situation {
  emoji: string;
  text: string;
}

/**
 * What a person chose about themselves: their situation, and whether others may
 * invite them to join a room ("reachable"), whatever the situation.
 */
export interface MyStatus extends Situation {
  reachable: boolean;
}

export interface Occupant {
  user_id: string;
  name: string;
  /** seen by the people of the space only; missing when there is none */
  situation?: Situation | null;
  /** can be invited from the space of the room, from its other rooms */
  reachable?: boolean;
  /** changes with the profile picture; missing without one */
  avatar_version?: number | null;
  /** reachable people only: too many invitations already wait for them */
  busy?: boolean;
}

/** {room id: people in the room} */
export type PresenceByRoom = Record<string, Occupant[]>;

/** A sub-space of a favorite space, as listed on the favorites page. */
export interface FavoriteSpaceRoom {
  id: string;
  title: string;
  emoji: string;
  favorite: boolean;
}

/**
 * A space of the favorites page: starred itself, or holding a starred sub-space.
 * `reachable` says whether the person can be invited from the space.
 */
export interface FavoriteSpace {
  id: string;
  title: string;
  emoji: string;
  favorite: boolean;
  reachable: boolean;
  rooms: FavoriteSpaceRoom[];
}

export interface RoomAccess {
  url: string;
  room: string;
  token: string;
}

/** What an invitation names, as pushed to the person invited. */
export interface IncomingInvitation {
  id: string;
  from: { user_id: string; name: string };
  room: { id: string; title: string; emoji: string };
  space: { id: string | null; title: string; emoji: string };
  /** the reason given by the person who invites, if any */
  message?: string;
  /** when the invitation stops being valid here, in milliseconds */
  deadline: number;
}

/** What becomes of an invitation, for the person who sent it. */
export type InvitationStatus =
  'pending' | 'accepted' | 'unavailable' | 'expired';

export type InvitationAnswer = 'accept' | 'unavailable' | 'ignore';

/** Why an invitation could not be sent. */
export type InvitationRefusal =
  'not_reachable' | 'busy' | 'unreachable' | 'already_there';
