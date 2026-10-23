import {
  Button,
  Modal,
  ModalSize,
  VariantType,
} from '@gouvfr-lasuite/ui-components';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { useToast } from '@/hooks/useToast';

import { useRemoveAvatar, useUploadAvatar } from '../api';
import {
  CropState,
  avatarSrc,
  clampOffset,
  cropToBlob,
  scaleOf,
} from '../avatar';
import { User } from '../api/types';

const VIEWPORT = 260;
const MAX_ZOOM = 4;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * Choose a profile picture and place it in a round window: drag it to move it, use
 * the slider or the buttons to make it bigger or smaller. What the window shows is
 * what everybody sees instead of the initials.
 */
export const ProfilePhotoModal = ({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { mutateAsync: upload, isPending: isSaving } = useUploadAvatar();
  const { mutateAsync: remove, isPending: isRemoving } = useRemoveAvatar();
  const fileInput = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const [source, setSource] = useState<string>();
  const [natural, setNatural] = useState<{ width: number; height: number }>();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(
    () => () => {
      if (source) {
        URL.revokeObjectURL(source);
      }
    },
    [source],
  );

  const state = (nextZoom = zoom, nextOffset = offset): CropState | undefined =>
    natural && {
      ...natural,
      viewport: VIEWPORT,
      zoom: nextZoom,
      offsetX: nextOffset.x,
      offsetY: nextOffset.y,
    };

  const place = (nextZoom: number, nextOffset: { x: number; y: number }) => {
    const current = state(nextZoom, nextOffset);
    if (!current) {
      return;
    }
    const clamped = clampOffset(current);
    setZoom(nextZoom);
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  };

  const failed = () =>
    toast(
      t('This picture cannot be used.', {
        description: 'Error when the chosen profile picture cannot be read',
      }),
      VariantType.ERROR,
    );

  const onFile = (file?: File) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/') || file.size > MAX_FILE_BYTES) {
      failed();
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setNatural({ width: image.naturalWidth, height: image.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setSource(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      failed();
    };
    image.src = url;
  };

  const save = async () => {
    const current = state();
    if (!current || !imageRef.current) {
      return;
    }
    try {
      await upload(await cropToBlob(imageRef.current, current));
      onClose();
    } catch {
      toast(
        t('The picture could not be saved.', {
          description: 'Error when the profile picture cannot be sent',
        }),
        VariantType.ERROR,
      );
    }
  };

  const removePhoto = async () => {
    try {
      await remove();
      onClose();
    } catch {
      toast(
        t('The picture could not be removed.', {
          description: 'Error when the profile picture cannot be deleted',
        }),
        VariantType.ERROR,
      );
    }
  };

  const current = state();
  const scale = current ? scaleOf(current) : 1;
  const hasPhoto = !!user.avatar_version;
  const busy = isSaving || isRemoving;

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={t('Profile picture', {
        description: 'Title of the dialog choosing the profile picture',
      })}
      aria-label={t('Profile picture', {
        description: 'Title of the dialog choosing the profile picture',
      })}
      rightActions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            data-testid="profile-photo-save"
            disabled={!source || busy}
            onClick={() => void save()}
          >
            {t('Save', { description: 'Button saving the profile picture' })}
          </Button>
        </>
      }
    >
      <Box $align="center" $gap="sm" data-testid="profile-photo-modal">
        <Text $variation="secondary" $size="sm">
          {t(
            'Choose a picture, then drag it and zoom to frame it in the circle.',
            { description: 'Help text of the profile picture dialog' },
          )}
        </Text>

        <div
          data-testid="profile-photo-window"
          role="img"
          aria-label={t('Preview of the profile picture', {
            description: 'Accessible name of the round preview',
          })}
          onPointerDown={(event) => {
            if (!source) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            if (!drag.current) {
              return;
            }
            const dx = event.clientX - drag.current.x;
            const dy = event.clientY - drag.current.y;
            drag.current = { x: event.clientX, y: event.clientY };
            place(zoom, { x: offset.x + dx, y: offset.y + dy });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          style={{
            position: 'relative',
            width: VIEWPORT,
            height: VIEWPORT,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#ececec',
            border: '1px solid #bdbdbd',
            cursor: source ? 'grab' : 'default',
            touchAction: 'none',
          }}
        >
          {source && natural ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: VIEWPORT / 2 + offset.x - (natural.width * scale) / 2,
                top: VIEWPORT / 2 + offset.y - (natural.height * scale) / 2,
                width: natural.width * scale,
                height: natural.height * scale,
                maxWidth: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ) : hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc(user.id, user.avatar_version as number)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
        </div>

        <Box $direction="row" $align="center" $gap="xs" $width="100%">
          <button
            type="button"
            aria-label={t('Smaller', { description: 'Button zooming out' })}
            title={t('Smaller', { description: 'Button zooming out' })}
            disabled={!source}
            onClick={() => place(Math.max(1, zoom - 0.25), offset)}
            style={zoomButton}
          >
            −
          </button>
          <input
            type="range"
            data-testid="profile-photo-zoom"
            aria-label={t('Zoom', { description: 'Slider changing the zoom' })}
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!source}
            onChange={(event) => place(Number(event.target.value), offset)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            aria-label={t('Bigger', { description: 'Button zooming in' })}
            title={t('Bigger', { description: 'Button zooming in' })}
            disabled={!source}
            onClick={() => place(Math.min(MAX_ZOOM, zoom + 0.25), offset)}
            style={zoomButton}
          >
            +
          </button>
        </Box>

        <Box $direction="row" $gap="xs">
          <Button
            variant="secondary"
            size="small"
            onClick={() => fileInput.current?.click()}
          >
            {source || hasPhoto
              ? t('Choose another picture', {
                  description: 'Button choosing a picture file',
                })
              : t('Choose a picture', {
                  description: 'Button choosing a picture file',
                })}
          </Button>
          {hasPhoto && (
            <Button
              variant="tertiary"
              size="small"
              color="error"
              disabled={busy}
              onClick={() => void removePhoto()}
            >
              {t('Remove the picture', {
                description: 'Button going back to the initials',
              })}
            </Button>
          )}
        </Box>
        <input
          ref={fileInput}
          data-testid="profile-photo-file"
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </Box>
    </Modal>
  );
};

const zoomButton = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid #000091',
  background: '#fff',
  color: '#000091',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
} as const;
