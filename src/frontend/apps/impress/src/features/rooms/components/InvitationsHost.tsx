import {
  Button,
  Modal,
  ModalSize,
  VariantType,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useToast } from '@/hooks/useToast';

import {
  answerInvitation,
  getInvitationStatus,
  sendInvitation,
  useSpaceRooms,
  withEmoji,
} from '../api';
import { useInvitations } from '../stores/useInvitations';
import { IncomingInvitation, InvitationAnswer } from '../types';
import { playInvitationBeep } from '../utils/beep';

/** How often the person who invited asks what became of the invitation. */
const FOLLOW_INTERVAL_MS = 2000;
/** The server forgets an invitation after a minute: a little more is waited here. */
const INVITATION_LIFETIME_MS = 60_000;

/** Longest reason that can be written with an invitation. */
const INVITATION_MESSAGE_MAX = 140;

/** Asks the user where to invite somebody who is reachable from a space. */
const InviteDialog = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const request = useInvitations((state) => state.request);
  const cancelAsk = useInvitations((state) => state.cancelAsk);
  const follow = useInvitations((state) => state.follow);
  const [isSending, setIsSending] = useState(false);
  const [chosenRoom, setChosenRoom] = useState<string>();
  const [message, setMessage] = useState('');
  const { data: spaceRooms = [] } = useSpaceRooms(
    request?.spaceId ?? '',
    !!request,
  );

  if (!request) {
    return null;
  }
  const { person } = request;
  // somebody who is in a room is not invited to it
  const rooms = spaceRooms.filter((room) => room.id !== request.excludeRoomId);
  // the sub-space where the user is, if it is in this space; else the first one
  const currentRoomId = router.query.id;
  const roomId =
    chosenRoom && rooms.some((room) => room.id === chosenRoom)
      ? chosenRoom
      : (rooms.find((room) => room.id === currentRoomId) ?? rooms[0])?.id;
  const heading = t('Invite to join', {
    description: 'Title of the dialog asking to invite somebody to a sub-space',
  });

  const close = () => {
    setChosenRoom(undefined);
    setMessage('');
    cancelAsk();
  };

  const send = async () => {
    if (!roomId) {
      return;
    }
    setIsSending(true);
    try {
      const result = await sendInvitation(
        roomId,
        person.user_id,
        message.trim(),
      );
      if ('refusal' in result) {
        toast(
          result.refusal === 'busy'
            ? t('{{name}} already has several invitations waiting.', {
                name: person.name,
                description: 'Toast when somebody has too many invitations',
              })
            : result.refusal === 'already_there'
              ? t('{{name}} is already in this sub-space.', {
                  name: person.name,
                  description: 'Toast when the person invited is in the room',
                })
              : result.refusal === 'not_reachable'
                ? t('{{name}} can no longer be reached here.', {
                    name: person.name,
                    description: 'Toast when the person is no longer reachable',
                  })
                : t('The invitation could not be sent.', {
                    description: 'Toast when an invitation cannot be delivered',
                  }),
          VariantType.WARNING,
        );
      } else {
        follow({
          id: result.id,
          name: person.name,
          roomId,
          deadline: Date.now() + INVITATION_LIFETIME_MS + FOLLOW_INTERVAL_MS,
        });
        toast(
          t('Invitation sent to {{name}}.', {
            name: person.name,
            description: 'Toast after inviting somebody',
          }),
          VariantType.INFO,
        );
      }
    } catch {
      toast(
        t('The invitation could not be sent.', {
          description: 'Toast when an invitation cannot be delivered',
        }),
        VariantType.ERROR,
      );
    } finally {
      setIsSending(false);
      close();
    }
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={close}
      size={ModalSize.LARGE}
      title={heading}
      aria-label={heading}
      rightActions={
        <>
          <Button variant="secondary" onClick={close}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button disabled={isSending || !roomId} onClick={() => void send()}>
            {t('Invite', {
              description: 'Button sending an invitation to join a sub-space',
            })}
          </Button>
        </>
      }
    >
      <Text data-testid="invite-dialog-text">
        {t('Invite {{name}} to join:', {
          name: person.name,
          description:
            'Question in the dialog inviting somebody to a sub-space',
        })}
      </Text>
      <select
        data-testid="invite-dialog-room"
        aria-label={t('Sub-space', {
          description: 'Column of the favorites: the sub-space',
        })}
        value={roomId ?? ''}
        onChange={(event) => setChosenRoom(event.target.value)}
        style={{
          marginTop: 12,
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 48px 10px 16px',
          font: 'inherit',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: `#fff url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%23161616' stroke-width='2'><path d='M3 6l5 5 5-5'/></svg>") no-repeat right 16px center`,
          appearance: 'none',
        }}
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {withEmoji(room.title, room.emoji)}
          </option>
        ))}
      </select>
      <label
        htmlFor="invite-dialog-message"
        style={{ display: 'block', marginTop: 16 }}
      >
        <Text $size="sm" as="span">
          {t('Message (optional)', {
            description: 'Field of the invitation dialog: why you invite',
          })}
        </Text>
      </label>
      <textarea
        id="invite-dialog-message"
        data-testid="invite-dialog-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={INVITATION_MESSAGE_MAX}
        rows={3}
        placeholder={t('Why do you invite them?', {
          description: 'Placeholder of the message of an invitation',
        })}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          padding: '8px 12px',
          font: 'inherit',
          border: '1px solid #ccc',
          borderRadius: 4,
          resize: 'none',
        }}
      />
      <Text $size="xs" $variation="secondary" $align="flex-end">
        {message.length}/{INVITATION_MESSAGE_MAX}
      </Text>
    </Modal>
  );
};

/** What somebody who invites you shows: a beep, and three ways to answer. */
const IncomingInvitationModal = ({
  invitation,
}: {
  invitation: IncomingInvitation;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const dismiss = useInvitations((state) => state.dismiss);

  useEffect(() => {
    playInvitationBeep();
    const timer = setTimeout(
      () => dismiss(invitation.id),
      Math.max(invitation.deadline - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [dismiss, invitation.deadline, invitation.id]);

  const reply = async (answer: InvitationAnswer) => {
    dismiss(invitation.id);
    try {
      const result = await answerInvitation(invitation.id, answer);
      if (answer === 'accept') {
        if (result?.status === 'accepted') {
          void router.push(`/docs/${invitation.room.id}`);
        } else {
          toast(
            t('This invitation has expired.', {
              description: 'Toast when accepting an invitation too late',
            }),
            VariantType.WARNING,
          );
        }
      }
    } catch {
      // the invitation is gone anyway
    }
  };

  const heading = t('Invitation', {
    description: 'Title of the dialog showing an invitation received',
  });

  return (
    <Modal
      isOpen
      onClose={() => void reply('ignore')}
      size={ModalSize.LARGE}
      title={heading}
      aria-label={heading}
      rightActions={
        <>
          <Button variant="tertiary" onClick={() => void reply('ignore')}>
            {t('Ignore', {
              description: 'Button dismissing an invitation without answering',
            })}
          </Button>
          <Button variant="secondary" onClick={() => void reply('unavailable')}>
            {t('Unavailable', {
              description: 'Button telling the inviter you are unavailable',
            })}
          </Button>
          <Button onClick={() => void reply('accept')}>
            {t('Join', {
              description: 'Button accepting an invitation to join a sub-space',
            })}
          </Button>
        </>
      }
    >
      <Text data-testid={`invitation-${invitation.id}`}>
        {t(
          '{{name}} invites you to connect to « {{room}} » in « {{space}} ».',
          {
            name: invitation.from.name,
            room: withEmoji(invitation.room.title, invitation.room.emoji),
            space: withEmoji(invitation.space.title, invitation.space.emoji),
            description: 'Text of an invitation received to join a sub-space',
          },
        )}
      </Text>
      {invitation.message && (
        <Text
          data-testid={`invitation-message-${invitation.id}`}
          $margin={{ top: 'sm' }}
          style={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            borderLeft: '3px solid #000091',
            paddingLeft: 12,
          }}
        >
          {invitation.message}
        </Text>
      )}
    </Modal>
  );
};

/** Follows the invitations sent, and tells how each one ended. */
const useFollowOutgoing = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const hasOutgoing = useInvitations((state) => state.outgoing.length > 0);

  useEffect(() => {
    if (!hasOutgoing) {
      return;
    }
    const check = async () => {
      const { outgoing, unfollow } = useInvitations.getState();
      for (const invitation of outgoing) {
        const noAnswer = () => {
          unfollow(invitation.id);
          toast(
            t('No answer from {{name}}.', {
              name: invitation.name,
              description: 'Toast when an invitation was not answered',
            }),
            VariantType.INFO,
          );
        };
        if (Date.now() > invitation.deadline) {
          noAnswer();
          continue;
        }
        try {
          const status = await getInvitationStatus(invitation.id);
          if (status === null) {
            unfollow(invitation.id);
          } else if (status === 'expired') {
            noAnswer();
          } else if (status === 'unavailable') {
            unfollow(invitation.id);
            toast(
              t('{{name}} is unavailable.', {
                name: invitation.name,
                description: 'Toast when the invited person declined',
              }),
              VariantType.INFO,
            );
          } else if (status === 'accepted') {
            unfollow(invitation.id);
            toast(
              t('{{name}} is joining you.', {
                name: invitation.name,
                description: 'Toast when the invited person accepted',
              }),
              VariantType.SUCCESS,
            );
          }
        } catch {
          // a network hiccup: ask again at the next round
        }
      }
    };
    const timer = setInterval(() => void check(), FOLLOW_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasOutgoing, t, toast]);
};

/**
 * Everything about invitations that floats above the pages: the confirmation, the
 * invitations received (one dialog each) and the follow-up of those sent.
 *
 * It sits once in the application.
 */
export const InvitationsHost = () => {
  const incoming = useInvitations((state) => state.incoming);
  useFollowOutgoing();

  return (
    <>
      <InviteDialog />
      {incoming.map((invitation) => (
        <IncomingInvitationModal key={invitation.id} invitation={invitation} />
      ))}
    </>
  );
};
