import { useTranslation } from 'react-i18next';

import { useRoomChat } from '../stores/useRoomChat';

/**
 * The "Chat" button: opens or closes the column of the chat of the video room.
 * In the page it sits by the title; in full screen it joins the control bar of the room.
 */
export const RoomChatButton = ({
  inControlBar = false,
}: {
  inControlBar?: boolean;
}) => {
  const { t } = useTranslation();
  const open = useRoomChat((state) => state.open);
  const toggle = useRoomChat((state) => state.toggle);
  const label = t('Chat', {
    description: 'Button opening the chat of the video room',
  });

  if (inControlBar) {
    return (
      <button
        type="button"
        className="lk-button"
        onClick={toggle}
        aria-pressed={open}
        data-testid="room-chat-button-stage"
        style={open ? { background: 'var(--lk-control-active-bg, #333)' } : {}}
      >
        <span aria-hidden="true">💬</span> {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={open}
      data-testid="room-chat-button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '0 12px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
        fontFamily: 'inherit',
        border: '1px solid #000091',
        color: open ? '#fff' : '#000091',
        background: open ? '#000091' : 'transparent',
      }}
    >
      <span aria-hidden="true">💬</span>
      {label}
    </button>
  );
};
