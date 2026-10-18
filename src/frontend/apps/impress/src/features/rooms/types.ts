export type Status = 'available' | 'busy' | 'away';

export interface Occupant {
  user_id: string;
  name: string;
  status?: Status;
}

/** {room id: people in the room} */
export type PresenceByRoom = Record<string, Occupant[]>;

export interface RoomAccess {
  url: string;
  room: string;
  token: string;
}
