import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';

export interface UploadImageResponseDto {
  url: string;
  publicId: string;
}

export const uploadsService = {
  image: async (file: File, folder = 'aarohcare/doctors'): Promise<UploadImageResponseDto> => {
    const body = new FormData();
    body.append('image', file);
    body.append('folder', folder);
    const { data } = await apiClient.post<UploadImageResponseDto>(API_PATHS.UPLOADS.IMAGE, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /** Fetch an existing S3 file via backend so preview/download works without S3 CORS. */
  proxyBlob: async (fileUrl: string, opts?: { download?: boolean; filename?: string }): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(API_PATHS.UPLOADS.PROXY, {
      params: {
        url: fileUrl,
        ...(opts?.download ? { download: '1' } : {}),
        ...(opts?.filename ? { filename: opts.filename } : {}),
      },
      responseType: 'blob',
    });
    return data;
  },

  /** Force-save a remote S3 file through the API (never navigates to Amazon). */
  downloadFile: async (fileUrl: string, fileName: string) => {
    const blob = await uploadsService.proxyBlob(fileUrl, {
      download: true,
      filename: fileName,
    });
    if (!blob || blob.size === 0) {
      throw new Error('Download failed');
    }
    // Backend errors may arrive as JSON blobs when responseType is "blob".
    if (blob.type.includes('application/json') || blob.type.includes('text/')) {
      const text = await blob.text();
      try {
        const parsed = JSON.parse(text) as { message?: string };
        throw new Error(parsed.message || 'Download failed');
      } catch (error) {
        if (error instanceof Error && error.message !== 'Download failed') throw error;
        throw new Error('Download failed');
      }
    }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
  },
};
