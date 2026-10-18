"""
Who is in each video room right now.

LiveKit only knows a room while someone is in it, and a browser only knows the room it
joined. To show the people connected under every room of the left panel, the backend
keeps a small Redis hash per room, fed by LiveKit's webhooks.

The hash is keyed by LiveKit identity, and each entry remembers the participant session
(`sid`): when the same person reconnects, LiveKit can report the departure of the old
session after the arrival of the new one, and only a departure of the current session
must remove the entry.
"""

import json
from functools import lru_cache

from django.conf import settings

import redis

KEY_PREFIX = "livekit-presence"
STATUS_PREFIX = "livekit-status"
CURRENT_ROOM_PREFIX = "livekit-current-room"
STATUSES = ("available", "busy", "away")
DEFAULT_STATUS = "available"
# A status is forgotten after a long absence: nobody stays "busy" for days
STATUS_TTL_SECONDS = 12 * 3600


@lru_cache(maxsize=4)
def _connect(url):
    """One client (and its connection pool) per Redis url and process."""
    return redis.Redis.from_url(url)


def _key(room_name):
    return f"{KEY_PREFIX}:{room_name}"


def _decode(raw_entries):
    """Turn a Redis hash into a list of participants, sorted by name."""
    participants = []
    for identity, raw in raw_entries.items():
        entry = json.loads(raw)
        entry["identity"] = (
            identity.decode() if isinstance(identity, bytes) else identity
        )
        participants.append(entry)
    return sorted(participants, key=lambda p: (p.get("name") or "").lower())


class PresenceStore:
    """Read and write the participants of the video rooms."""

    @staticmethod
    def _redis():
        return _connect(settings.LIVEKIT_PRESENCE_REDIS_URL)

    def join(  # noqa: PLR0913, PLR0917
        self, room_name, identity, sid, name, user_id=None, moderator=False
    ):
        """Record that a participant entered a room."""
        redis = self._redis()
        key = _key(room_name)
        entry = {"sid": sid, "name": name, "user_id": user_id, "moderator": moderator}
        pipe = redis.pipeline()
        pipe.hset(key, identity, json.dumps(entry))
        # A lost webhook must not leave someone "connected" forever
        pipe.expire(key, settings.LIVEKIT_PRESENCE_TTL_SECONDS)
        pipe.execute()

    def leave(self, room_name, identity, sid):
        """
        Record that a participant session ended.

        Nothing happens when the entry belongs to a more recent session of the same
        identity: the person reconnected and is still there.
        """
        redis = self._redis()
        key = _key(room_name)
        raw = redis.hget(key, identity)
        if raw is None:
            return
        if json.loads(raw).get("sid") not in (sid, None, ""):
            return
        redis.hdel(key, identity)

    def clear_room(self, room_name):
        """Forget everybody in a room, once LiveKit has closed it."""
        self._redis().delete(_key(room_name))

    def participants(self, room_name):
        """People in a room: dicts with identity, sid, name, user_id and moderator."""
        return _decode(self._redis().hgetall(_key(room_name)))

    def participants_many(self, room_names):
        """People in several rooms, in one round trip: {room name: participants}."""
        room_names = list(room_names)
        pipe = self._redis().pipeline()
        for room_name in room_names:
            pipe.hgetall(_key(room_name))
        return {
            room_name: _decode(raw_entries)
            for room_name, raw_entries in zip(room_names, pipe.execute(), strict=True)
        }

    def set_status(self, user_id, status):
        """Remember the status a person chose (one of `STATUSES`)."""
        if status not in STATUSES:
            raise ValueError(f"Unknown status: {status}")
        self._redis().set(f"{STATUS_PREFIX}:{user_id}", status, ex=STATUS_TTL_SECONDS)

    def statuses(self, user_ids):
        """The status of several people, in one round trip: {user id: status}."""
        user_ids = [str(user_id) for user_id in user_ids if user_id]
        if not user_ids:
            return {}
        values = self._redis().mget(
            [f"{STATUS_PREFIX}:{user_id}" for user_id in user_ids]
        )
        result = {}
        for user_id, value in zip(user_ids, values, strict=True):
            status = value.decode() if isinstance(value, bytes) else value
            result[user_id] = status if status in STATUSES else DEFAULT_STATUS
        return result

    def set_current_room(self, user_id, room_name):
        """
        Remember the room a person just joined: they are in one room at a time.

        Returns the room they were in before, if any.
        """
        key = f"{CURRENT_ROOM_PREFIX}:{user_id}"
        client = self._redis()
        # GET then SET: "SET … GET" does not exist on the Redis 5 of the compose file
        previous = client.get(key)
        client.set(key, room_name, ex=STATUS_TTL_SECONDS)
        if isinstance(previous, bytes):
            previous = previous.decode()
        return previous

    def current_rooms(self, user_ids):
        """The last room joined by several people, in one round trip."""
        user_ids = [str(user_id) for user_id in user_ids if user_id]
        if not user_ids:
            return {}
        values = self._redis().mget(
            [f"{CURRENT_ROOM_PREFIX}:{user_id}" for user_id in user_ids]
        )
        return {
            user_id: (value.decode() if isinstance(value, bytes) else value)
            for user_id, value in zip(user_ids, values, strict=True)
            if value
        }
