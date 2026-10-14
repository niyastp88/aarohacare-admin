import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/Button';
import { getCroppedImageFile } from '@/utils/cropImage';

interface ImageCropModalProps {
  imageSrc: string;
  aspect: number;
  title?: string;
  confirmLabel?: string;
  /** Show “Choose different photo” for re-crop or replace flows. */
  allowReplace?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}

export const ImageCropModal = ({
  imageSrc,
  aspect,
  title = 'Crop photo',
  confirmLabel = 'Use photo',
  allowReplace = true,
  onCancel,
  onConfirm,
}: ImageCropModalProps) => {
  const [src, setSrc] = useState(imageSrc);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const localBlobRef = useRef<string | null>(null);

  useEffect(() => {
    setSrc(imageSrc);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError('');
  }, [imageSrc]);

  useEffect(
    () => () => {
      if (localBlobRef.current) URL.revokeObjectURL(localBlobRef.current);
    },
    [],
  );

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleReplace = (file: File | null) => {
    if (!file) return;
    if (localBlobRef.current) URL.revokeObjectURL(localBlobRef.current);
    const url = URL.createObjectURL(file);
    localBlobRef.current = url;
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError('');
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    setError('');
    try {
      const file = await getCroppedImageFile(src, croppedAreaPixels);
      await onConfirm(file);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Could not crop this image. Try another photo.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-muted">
            Drag to reposition · zoom · or choose a different photo
          </p>
        </div>

        <div className="relative h-[340px] bg-gray-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            restrictPosition={false}
          />

          {/* Quick On-Screen Up / Down Overlay Buttons */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
            <button
              type="button"
              onClick={() => setCrop((c) => ({ ...c, y: c.y - 20 }))}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/80 transition"
              title="Move photo up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => setCrop((c) => ({ ...c, y: c.y + 20 }))}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/80 transition"
              title="Move photo down"
            >
              ▼
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
              <span className="flex items-center justify-between">
                <span>Zoom</span>
                <span className="text-xs text-muted font-mono">{Math.round(zoom * 100)}%</span>
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </label>

            <div className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
              <div className="flex items-center justify-between">
                <span>Position Up / Down</span>
                <button
                  type="button"
                  onClick={() => setCrop({ x: 0, y: 0 })}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  Reset Center
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold">▲ Up</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={crop.y}
                  onChange={(e) => setCrop((c) => ({ ...c, y: Number(e.target.value) }))}
                  className="w-full accent-[var(--color-primary)]"
                />
                <span className="text-xs text-gray-500 font-bold">▼ Down</span>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {allowReplace ? (
              <>
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReplace(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  Choose different photo
                </Button>
              </>
            ) : (
              <span />
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" loading={busy} onClick={() => void handleConfirm()}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
