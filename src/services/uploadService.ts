import { EvidenceItem } from '../types';

export interface UploadProgressCallback {
  (progress: number): void;
}

export const uploadService = {
  /**
   * Reads and processes uploaded file. For images, compresses them to a
   * lightweight persistent base64 data URL so evidence survives page refreshes and
   * can be shared across officers and citizens.
   */
  async uploadFile(
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<EvidenceItem> {
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File "${file.name}" exceeds the maximum 15MB upload limit.`);
    }

    let itemType: EvidenceItem['type'] = 'document';
    if (file.type.startsWith('image/')) {
      itemType = 'image';
    } else if (file.type.startsWith('video/')) {
      itemType = 'video';
    }

    if (onProgress) {
      onProgress(20);
    }

    // Convert to Data URL for persistent preview & storage
    let persistentUrl = '';

    if (itemType === 'image') {
      persistentUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Compress large images to max width/height 1000px
            const maxDim = 1000;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
              resolve((e.target?.result as string) || URL.createObjectURL(file));
            }
          };
          img.onerror = () => {
            resolve((e.target?.result as string) || URL.createObjectURL(file));
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    } else {
      // For docs/videos, read as base64 if small (< 2MB), else object URL
      if (file.size < 2 * 1024 * 1024) {
        persistentUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || URL.createObjectURL(file));
          reader.onerror = () => resolve(URL.createObjectURL(file));
          reader.readAsDataURL(file);
        });
      } else {
        persistentUrl = URL.createObjectURL(file);
      }
    }

    if (onProgress) {
      onProgress(80);
      await new Promise((r) => setTimeout(r, 60));
      onProgress(100);
    }

    return {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: file.name,
      type: itemType,
      url: persistentUrl,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
};
