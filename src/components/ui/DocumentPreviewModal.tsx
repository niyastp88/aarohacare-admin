import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getApiErrorMessage } from '@/api/client';
import { uploadsService } from '@/api/services/uploads';

type DocumentPreviewModalProps = {
  open: boolean;
  url: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
};

const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url);

const guessFileName = (title: string, url: string) => {
  const base = (title || 'lab-report').replace(/[^\w.\-()+ ]+/g, '_').slice(0, 80);
  if (isPdfUrl(url)) return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
  const match = url.match(/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i);
  const ext = match?.[1] ? `.${match[1].toLowerCase()}` : '.jpg';
  if (/\.(png|jpe?g|gif|webp|bmp|pdf)$/i.test(base)) return base;
  return `${base}${ext}`;
};

export const DocumentPreviewModal = ({
  open,
  url,
  title,
  subtitle,
  onClose,
}: DocumentPreviewModalProps) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const pdf = useMemo(() => isPdfUrl(url), [url]);

  useEffect(() => {
    if (!open) return;
    setError('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const onDownload = async () => {
    if (downloading || !url) return;
    setDownloading(true);
    setError('');
    try {
      await uploadsService.downloadFile(url, guessFileName(title, url));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0B2A4A]/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Document preview'}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(920px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E8EEF4] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-[#0B2A4A]">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[12px] text-[#64748B]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-[50vh] flex-1 bg-[#F8FAFC]">
          {pdf ? (
            <iframe title={title} src={url} className="h-[min(70vh,720px)] w-full border-0 bg-white" />
          ) : (
            <div className="flex h-[min(70vh,720px)] items-center justify-center overflow-auto p-4">
              <img
                src={url}
                alt={title}
                className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                onError={() => setError('Could not load this document preview.')}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EEF4] px-4 py-3 sm:px-5">
          <p className="text-[12px] text-[#94A3B8]">
            {error || 'Preview stays in this window. Download saves the file to your device.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-semibold text-[#334155] hover:bg-[#F8FAFC]"
            >
              Close
            </button>
            <button
              type="button"
              disabled={downloading || !url}
              onClick={() => void onDownload()}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
