import type { Area } from 'react-easy-crop';
import { uploadsService } from '@/api/services/uploads';

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Could not load image for cropping')));
    // Needed so canvas export works for remote URLs (S3 must allow CORS).
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

/**
 * Prepare an image URL for the cropper.
 * Remote photos go through the backend proxy to avoid browser ↔ S3 CORS failures.
 */
export async function loadImageForCrop(
  source: string,
): Promise<{ url: string; shouldRevoke: boolean }> {
  if (source.startsWith('blob:') || source.startsWith('data:')) {
    return { url: source, shouldRevoke: false };
  }

  const blob = await uploadsService.proxyBlob(source);
  if (
    blob.type &&
    !blob.type.startsWith('image/') &&
    blob.type !== 'application/octet-stream' &&
    blob.type !== ''
  ) {
    throw new Error('Could not load photo for editing');
  }
  return { url: URL.createObjectURL(blob), shouldRevoke: true };
}

/** Crop the source image to the selected pixel area and return a JPEG File. */
export async function getCroppedImageFile(
  imageSrc: string,
  crop: Area,
  fileName = 'cropped.jpg',
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not crop image');
  }

  const width = Math.max(1, Math.round(crop.width));
  const height = Math.max(1, Math.round(crop.height));
  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

  const outBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Could not export cropped image'));
      },
      'image/jpeg',
      0.92,
    );
  });

  return new File([outBlob], fileName, { type: 'image/jpeg' });
}
