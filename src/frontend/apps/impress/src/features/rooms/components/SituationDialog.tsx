import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import Picker from '@emoji-mart/react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { getEmojidata } from '@/components/Emoji/initEmojiCallout';

import { SITUATION_QUICK_EMOJIS, SITUATION_TEXT_MAX_LENGTH } from '../statuses';
import { Situation } from '../types';

const EMOJI_BUTTON = {
  fontSize: '1.3rem',
  padding: '2px 6px',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
} as const;

const SELECTED = '2px solid var(--c--globals--colors--brand-500, #3558a2)';

interface SituationDialogProps {
  initial: Situation;
  isPending?: boolean;
  onConfirm: (situation: Situation) => void;
  onClose: () => void;
}

/** Writes one's own situation: an emoji and a short text. */
export const SituationDialog = ({
  initial,
  isPending = false,
  onConfirm,
  onClose,
}: SituationDialogProps) => {
  const { t, i18n } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [text, setText] = useState(initial.text);
  const canConfirm = (!!emoji || text.trim().length > 0) && !isPending;
  const heading = t('Custom status', {
    description: 'Title of the dialog writing one’s own status',
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canConfirm) {
      onConfirm({ emoji, text: text.trim() });
    }
  };

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.SMALL}
      title={heading}
      aria-label={heading}
      rightActions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            data-testid="situation-confirm"
            disabled={!canConfirm}
            onClick={() => submit()}
          >
            {t('Save', { description: 'Button saving the status' })}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Box $gap="sm">
          <Box $gap="4xs">
            <label htmlFor="situation-text" style={{ fontWeight: 500 }}>
              {t('What are you up to?', {
                description: 'Label of the field writing one’s own status',
              })}
            </label>
            <input
              id="situation-text"
              data-testid="situation-text"
              autoFocus
              value={text}
              maxLength={SITUATION_TEXT_MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              style={{ padding: '8px', fontSize: '1rem' }}
            />
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {text.length}/{SITUATION_TEXT_MAX_LENGTH}
            </span>
          </Box>
          <Box $gap="4xs">
            <span style={{ fontWeight: 500 }}>
              {t('Emoji', { description: 'Label of the emoji field' })}
            </span>
            <Box $direction="row" $gap="4xs" $wrap="wrap" $align="center">
              {SITUATION_QUICK_EMOJIS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  aria-label={quick}
                  aria-pressed={emoji === quick}
                  onClick={() => setEmoji(emoji === quick ? '' : quick)}
                  style={{
                    ...EMOJI_BUTTON,
                    border: emoji === quick ? SELECTED : '1px solid #ddd',
                  }}
                >
                  {quick}
                </button>
              ))}
              {emoji && !SITUATION_QUICK_EMOJIS.includes(emoji) && (
                <button
                  type="button"
                  aria-label={emoji}
                  aria-pressed="true"
                  onClick={() => setEmoji('')}
                  style={{ ...EMOJI_BUTTON, border: SELECTED }}
                >
                  {emoji}
                </button>
              )}
              <button
                type="button"
                aria-expanded={showPicker}
                aria-label={t('More emojis', {
                  description: 'Button opening the full list of emojis',
                })}
                title={t('More emojis', {
                  description: 'Button opening the full list of emojis',
                })}
                onClick={() => setShowPicker((open) => !open)}
                style={{
                  ...EMOJI_BUTTON,
                  border: '1px solid #ddd',
                  fontWeight: 600,
                  color: '#555',
                }}
              >
                +
              </button>
            </Box>
            {showPicker && (
              <>
                <style>{`em-emoji-picker { height: 300px; min-height: 0; width: 100%; max-width: 100%; }`}</style>
                <Picker
                  data={getEmojidata()}
                  locale={i18n.resolvedLanguage}
                  autoFocus
                  theme="light"
                  perLine={8}
                  previewPosition="none"
                  skinTonePosition="none"
                  onEmojiSelect={({ native }: { native: string }) => {
                    setEmoji(native);
                    setShowPicker(false);
                  }}
                />
              </>
            )}
          </Box>
        </Box>
        {/* lets Enter validate the form */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
};
