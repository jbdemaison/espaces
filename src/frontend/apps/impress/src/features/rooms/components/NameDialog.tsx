import { Button, Modal, ModalSize } from '@gouvfr-lasuite/ui-components';
import Picker from '@emoji-mart/react';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { getEmojidata } from '@/components/Emoji/initEmojiCallout';

const QUICK_EMOJIS = [
  '💬',
  '🎧',
  '🎮',
  '📣',
  '☕',
  '🧠',
  '🚀',
  '🏢',
  '🎉',
  '📚',
];

const EMOJI_BUTTON = {
  fontSize: '1.3rem',
  padding: '2px 6px',
  borderRadius: 6,
  border: '1px solid #ddd',
  background: 'transparent',
  cursor: 'pointer',
} as const;

interface NameDialogProps {
  heading: string;
  confirmLabel: string;
  initialName?: string;
  initialEmoji?: string;
  isPending?: boolean;
  onConfirm: (value: { title: string; emoji: string }) => void;
  onClose: () => void;
}

/** Asks for the name and the emoji of a space or of a sub-space. */
export const NameDialog = ({
  heading,
  confirmLabel,
  initialName = '',
  initialEmoji = '',
  isPending = false,
  onConfirm,
  onClose,
}: NameDialogProps) => {
  const { t, i18n } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [title, setTitle] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);
  const canConfirm = title.trim().length > 0 && !isPending;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (canConfirm) {
      onConfirm({ title: title.trim(), emoji: emoji.trim() });
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
          <Button disabled={!canConfirm} onClick={() => submit()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Box $gap="sm">
          <Box $gap="4xs">
            <label htmlFor="space-name" style={{ fontWeight: 500 }}>
              {t('Name', { description: 'Label of a name field' })}
            </label>
            <input
              id="space-name"
              autoFocus
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              style={{ padding: '8px', fontSize: '1rem' }}
            />
          </Box>
          <Box $gap="4xs">
            <label htmlFor="space-emoji" style={{ fontWeight: 500 }}>
              {t('Emoji', { description: 'Label of the emoji field' })}
            </label>
            <Box $direction="row" $gap="4xs" $wrap="wrap" $align="center">
              {QUICK_EMOJIS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  aria-label={quick}
                  aria-pressed={emoji === quick}
                  onClick={() => setEmoji(quick)}
                  style={{
                    fontSize: '1.3rem',
                    padding: '2px 6px',
                    borderRadius: 6,
                    border:
                      emoji === quick
                        ? '2px solid var(--c--globals--colors--brand-500, #3558a2)'
                        : '1px solid #ddd',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {quick}
                </button>
              ))}
              {emoji && !QUICK_EMOJIS.includes(emoji) && (
                <button
                  type="button"
                  aria-label={emoji}
                  aria-pressed="true"
                  style={{
                    ...EMOJI_BUTTON,
                    border:
                      '2px solid var(--c--globals--colors--brand-500, #3558a2)',
                  }}
                >
                  {emoji}
                </button>
              )}
              <button
                type="button"
                id="space-emoji"
                aria-expanded={showPicker}
                aria-label={t('More emojis', {
                  description: 'Button opening the full list of emojis',
                })}
                title={t('More emojis', {
                  description: 'Button opening the full list of emojis',
                })}
                onClick={() => setShowPicker((open) => !open)}
                style={{ ...EMOJI_BUTTON, fontWeight: 600, color: '#555' }}
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
