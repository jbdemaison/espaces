import {
  Button,
  Modal,
  ModalSize,
  VariantType,
} from '@gouvfr-lasuite/ui-components';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components';
import { useAuth } from '@/features/auth';
import { useToast } from '@/hooks/useToast';

import { useMyStatus, useSetMyStatus } from '../api';
import { playInvitationBeep } from '../utils/beep';

/** Someone "reachable" who did nothing for this long is asked to confirm. */
export const IDLE_MS = 60 * 60_000;
/** Time given to answer before the person stops being reachable. */
export const CONFIRM_MS = 3 * 60_000;
const CHECK_MS = 10_000;

const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;

/**
 * Keeps "reachable" honest: when the person has been inactive for an hour, a dialog
 * asks them to confirm. Without an answer, they stop being reachable so nobody
 * invites somebody who is no longer there. Their situation is left as it is.
 */
export const InactivityHost = ({
  idleMs = IDLE_MS,
  confirmMs = CONFIRM_MS,
  checkMs = CHECK_MS,
}: {
  idleMs?: number;
  confirmMs?: number;
  checkMs?: number;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const notify = useRef<() => void>(() => undefined);
  const { data: status } = useMyStatus(!!user);
  const { mutate: setStatus } = useSetMyStatus();
  notify.current = () =>
    toast(
      t('You were inactive: you are no longer reachable.', {
        description: 'Shown when the status changed by itself',
      }),
      VariantType.INFO,
    );
  const lastActivity = useRef(Date.now());
  const [deadline, setDeadline] = useState<number>();
  const deadlineRef = useRef<number | undefined>(undefined);
  deadlineRef.current = deadline;
  const reachable = !!status?.reachable;

  // Being active only counts while no question is waiting for an answer
  useEffect(() => {
    if (!reachable) {
      return;
    }
    lastActivity.current = Date.now();
    const onActivity = () => {
      if (deadlineRef.current === undefined) {
        lastActivity.current = Date.now();
      }
    };
    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, onActivity, { passive: true }),
    );
    return () =>
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, onActivity),
      );
  }, [reachable]);

  useEffect(() => {
    if (!reachable) {
      setDeadline(undefined);
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      if (deadlineRef.current !== undefined) {
        if (now >= deadlineRef.current) {
          setDeadline(undefined);
          setStatus({ reachable: false });
          notify.current();
        }
      } else if (now - lastActivity.current >= idleMs) {
        setDeadline(now + confirmMs);
        playInvitationBeep();
      }
    }, checkMs);
    return () => clearInterval(timer);
  }, [reachable, idleMs, confirmMs, checkMs, setStatus]);

  if (!reachable || deadline === undefined) {
    return null;
  }

  const confirm = () => {
    lastActivity.current = Date.now();
    setDeadline(undefined);
  };
  const later = () => {
    setDeadline(undefined);
    setStatus({ reachable: false });
  };

  return (
    <StillReachableModal
      deadline={deadline}
      onConfirm={confirm}
      onLater={later}
    />
  );
};

const StillReachableModal = ({
  deadline,
  onConfirm,
  onLater,
}: {
  deadline: number;
  onConfirm: () => void;
  onLater: () => void;
}) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const title = t('Are you still reachable?', {
    description: 'Title of the dialog asking an inactive person to confirm',
  });

  return (
    <Modal
      isOpen
      onClose={onConfirm}
      size={ModalSize.MEDIUM}
      title={title}
      aria-label={title}
      rightActions={
        <>
          <Button variant="secondary" onClick={onLater}>
            {t('Stop being reachable', {
              description: 'Button of the dialog asking an inactive person',
            })}
          </Button>
          <Button data-testid="still-reachable-confirm" onClick={onConfirm}>
            {t('I am still here', {
              description: 'Button confirming the person is still reachable',
            })}
          </Button>
        </>
      }
    >
      <Text data-testid="still-reachable-text">
        {t(
          'You have been inactive for a while. Without an answer in {{seconds}} s, you will no longer be reachable.',
          {
            seconds,
            description:
              'Text of the dialog asking an inactive person to confirm',
          },
        )}
      </Text>
    </Modal>
  );
};
