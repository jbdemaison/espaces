"""
Invitations to join a video room, sent to people who are "reachable".

An invitation lives one minute. The person invited receives it at once, pushed through
their personal inbox room; the person who invites follows its fate by asking for it.
Only a small Redis record is kept: nothing about an invitation is stored for good.
"""

import json
import time
import uuid

from core.services.livekit_presence import redis_client

INVITATION_PREFIX = "livekit-invitation"
PENDING_PREFIX = "livekit-invitations-to"
INVITATION_TTL_SECONDS = 60
# The inviter can still learn the answer a little after the invitation expired
RECORD_KEEP_SECONDS = 5 * 60
# Beyond this many invitations waiting for an answer, nobody else can invite them
MAX_PENDING = 3

ANSWERS = {"accept": "accepted", "unavailable": "unavailable", "ignore": "ignored"}


class TooManyInvitations(Exception):
    """The person already has `MAX_PENDING` invitations waiting for an answer."""


def _key(invitation_id):
    invitation_id = str(invitation_id)
    return f"{INVITATION_PREFIX}:{invitation_id}"


def _pending_key(user_id):
    return f"{PENDING_PREFIX}:{user_id}"


def pending_counts(user_ids):
    """How many invitations wait for an answer, for several people: {user id: count}."""
    user_ids = [str(user_id) for user_id in user_ids if user_id]
    if not user_ids:
        return {}
    now = time.time()
    pipe = redis_client().pipeline()
    for user_id in user_ids:
        pipe.zremrangebyscore(_pending_key(user_id), "-inf", now)
        pipe.zcard(_pending_key(user_id))
    answers = pipe.execute()[1::2]
    return dict(zip(user_ids, answers, strict=True))


def create(*, to_user_id, **details):
    """
    Record an invitation sent to somebody and return it.

    `details` is whatever the person invited needs to see (who invites, to which room).
    Raises `TooManyInvitations` when they already have `MAX_PENDING` of them waiting.
    """
    to_user_id = str(to_user_id)
    if pending_counts([to_user_id]).get(to_user_id, 0) >= MAX_PENDING:
        raise TooManyInvitations()

    now = time.time()
    invitation = {
        "id": str(uuid.uuid4()),
        "to_user_id": to_user_id,
        "status": "pending",
        "created_at": now,
        "expires_at": now + INVITATION_TTL_SECONDS,
        **details,
    }
    pipe = redis_client().pipeline()
    pipe.set(_key(invitation["id"]), json.dumps(invitation), ex=RECORD_KEEP_SECONDS)
    pipe.zadd(_pending_key(to_user_id), {invitation["id"]: invitation["expires_at"]})
    pipe.expire(_pending_key(to_user_id), RECORD_KEEP_SECONDS)
    pipe.execute()
    return invitation


def get(invitation_id):
    """An invitation, or None. A pending one past its time reads as "expired"."""
    raw = redis_client().get(_key(invitation_id))
    if raw is None:
        return None
    invitation = json.loads(raw)
    if invitation["status"] == "pending" and invitation["expires_at"] <= time.time():
        invitation["status"] = "expired"
    return invitation


def discard(invitation_id):
    """Forget an invitation that could not be delivered."""
    invitation_id = str(invitation_id)
    invitation = get(invitation_id)
    if invitation is None:
        return
    pipe = redis_client().pipeline()
    pipe.delete(_key(invitation_id))
    pipe.zrem(_pending_key(invitation["to_user_id"]), invitation_id)
    pipe.execute()


def answer(invitation_id, user_id, choice):
    """
    The person invited answers: one of `ANSWERS`.

    Returns the invitation, or None when it does not exist (any more) or is not theirs.
    An invitation already answered or expired is returned untouched.
    """
    invitation_id = str(invitation_id)
    invitation = get(invitation_id)
    if invitation is None or invitation["to_user_id"] != str(user_id):
        return None
    if invitation["status"] != "pending":
        return invitation

    invitation["status"] = ANSWERS[choice]
    pipe = redis_client().pipeline()
    pipe.set(_key(invitation_id), json.dumps(invitation), ex=RECORD_KEEP_SECONDS)
    pipe.zrem(_pending_key(invitation["to_user_id"]), invitation_id)
    pipe.execute()
    return invitation
