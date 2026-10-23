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
# Former single status (available, busy, away, reachable): only read, for "reachable",
# so that nobody loses it when the new model is deployed
STATUS_PREFIX = "livekit-status"
# What the person says about their situation: an emoji and a short text
SITUATION_PREFIX = "livekit-situation"
# "Reachable" is a separate choice, whatever the situation
REACHABLE_PREFIX = "livekit-reachable"
CURRENT_ROOM_PREFIX = "livekit-current-room"
SITUATION_EMOJI_MAX_LENGTH = 16
SITUATION_TEXT_MAX_LENGTH = 40
# A situation is forgotten after 12 h without the page being open (the page renews
# it while it is): nobody stays "in a meeting" until the next morning
STATUS_TTL_SECONDS = 12 * 3600
# "Reachable" is a standing choice: it holds until the person changes it
REACHABLE_TTL_SECONDS = 30 * 24 * 3600
INBOX_READY_PREFIX = "livekit-inbox-ready"
# The page of a reachable person says every ~25 s that its inbox works; once it
# stops, they are no longer shown as reachable after this long
INBOX_READY_TTL_SECONDS = 60


@lru_cache(maxsize=4)
def _connect(url):
    """One client (and its connection pool) per Redis url and process."""
    return redis.Redis.from_url(url)


def redis_client():
    """The Redis client shared by everything that keeps short-lived state about calls."""
    return _connect(settings.LIVEKIT_PRESENCE_REDIS_URL)


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

    def set_situation(self, user_id, emoji, text):
        """
        Remember the situation a person chose: an emoji and a short text.

        Both empty means "no situation": the previous one is forgotten.
        """
        emoji = (emoji or "").strip()
        text = (text or "").strip()
        key = f"{SITUATION_PREFIX}:{user_id}"
        if not emoji and not text:
            self._redis().delete(key)
            return
        self._redis().set(
            key, json.dumps({"emoji": emoji, "text": text}), ex=STATUS_TTL_SECONDS
        )

    def touch_situation(self, user_id):
        """Renew the situation of a person whose page is open: it is not forgotten."""
        self._redis().expire(f"{SITUATION_PREFIX}:{user_id}", STATUS_TTL_SECONDS)

    def situations(self, user_ids):
        """
        The situation of several people, in one round trip: {user id: situation}.

        Only the people who have one are in the answer.
        """
        user_ids = [str(user_id) for user_id in user_ids if user_id]
        if not user_ids:
            return {}
        values = self._redis().mget(
            [f"{SITUATION_PREFIX}:{user_id}" for user_id in user_ids]
        )
        result = {}
        for user_id, value in zip(user_ids, values, strict=True):
            if not value:
                continue
            try:
                situation = json.loads(value)
            except ValueError:
                continue
            result[user_id] = {
                "emoji": situation.get("emoji", ""),
                "text": situation.get("text", ""),
            }
        return result

    def set_reachable(self, user_id, reachable):
        """Remember whether a person accepts to be invited to join a room."""
        key = f"{REACHABLE_PREFIX}:{user_id}"
        if reachable:
            self._redis().set(key, 1, ex=REACHABLE_TTL_SECONDS)
        else:
            self._redis().delete(key)
            # the former status could still say "reachable"
            self._redis().delete(f"{STATUS_PREFIX}:{user_id}")

    def reachable(self, user_ids):
        """Among the users, the ids of those who accept to be invited."""
        user_ids = [str(user_id) for user_id in user_ids if user_id]
        if not user_ids:
            return set()
        pipe = self._redis().pipeline()
        pipe.mget([f"{REACHABLE_PREFIX}:{user_id}" for user_id in user_ids])
        pipe.mget([f"{STATUS_PREFIX}:{user_id}" for user_id in user_ids])
        current, former = pipe.execute()
        return {
            user_id
            for user_id, value, old in zip(user_ids, current, former, strict=True)
            if value is not None or old in (b"reachable", "reachable")
        }

    def mark_inbox_ready(self, user_id):
        """
        Remember that the page of a person is connected to their inbox *and able to
        receive*: being listed by LiveKit is not enough, a browser whose connection
        never completes is listed for a while too.
        """
        self._redis().set(
            f"{INBOX_READY_PREFIX}:{user_id}", 1, ex=INBOX_READY_TTL_SECONDS
        )

    def inbox_ready(self, user_ids):
        """Among the users, the ids of those whose page says its inbox works."""
        user_ids = [str(user_id) for user_id in user_ids if user_id]
        if not user_ids:
            return set()
        values = self._redis().mget(
            [f"{INBOX_READY_PREFIX}:{user_id}" for user_id in user_ids]
        )
        return {
            user_id
            for user_id, value in zip(user_ids, values, strict=True)
            if value is not None
        }

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
