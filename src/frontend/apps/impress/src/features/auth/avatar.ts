import { baseApiUrl } from '@/api';

/** Address of the profile picture of a user; `version` busts the cache when it changes. */
export const avatarSrc = (userId: string, version: number) =>
  `${baseApiUrl()}users/${encodeURIComponent(userId)}/avatar/?v=${encodeURIComponent(String(version))}`;

/** Size, in pixels, of the stored picture. */
export const AVATAR_OUTPUT_SIZE = 256;

export interface CropState {
  /** natural size of the picture */
  width: number;
  height: number;
  /** side of the square window showing the result */
  viewport: number;
  /** 1 = the picture just covers the window; more = zoomed in */
  zoom: number;
  /** how far the center of the picture is from the center of the window, in window pixels */
  offsetX: number;
  offsetY: number;
}

/** Scale at which the whole window is covered by the picture. */
const coverScale = ({ width, height, viewport }: CropState) =>
  viewport / Math.min(width, height);

/** Pixels per natural pixel with the current zoom. */
export const scaleOf = (state: CropState) => coverScale(state) * state.zoom;

/** Keeps the picture covering the window: no empty corner can be left. */
export const clampOffset = (state: CropState) => {
  const scale = scaleOf(state);
  const maxX = Math.max(0, (state.width * scale - state.viewport) / 2);
  const maxY = Math.max(0, (state.height * scale - state.viewport) / 2);
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, state.offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, state.offsetY)),
  };
};

/** The part of the picture seen in the window, in natural pixels. */
export const sourceRect = (state: CropState) => {
  const { offsetX, offsetY } = clampOffset(state);
  const scale = scaleOf(state);
  const side = state.viewport / scale;
  return {
    sx: state.width / 2 - offsetX / scale - side / 2,
    sy: state.height / 2 - offsetY / scale - side / 2,
    side,
  };
};

/** Draws the chosen part of the picture into a small square image (WebP, else JPEG). */
export const cropToBlob = (
  image: HTMLImageElement,
  state: CropState,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Canvas is not available'));
      return;
    }
    const { sx, sy, side } = sourceRect(state);
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      sx,
      sy,
      side,
      side,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE,
    );
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === 'image/webp') {
          resolve(webp);
          return;
        }
        canvas.toBlob(
          (jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('Crop failed'))),
          'image/jpeg',
          0.88,
        );
      },
      'image/webp',
      0.88,
    );
  });
