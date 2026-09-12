import { EvidenceItem } from '../types';
import { storage, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface UploadProgressCallback {
  (progress: number): void;
}

export const uploadService = {
  /**
   * Uploads file to Firebase Storage. Validates size, mime-type, and security boundaries.
   * Gracefully falls back to optimized compressed client preview if offline or storage unavailable.
   */
  async uploadFile(
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<EvidenceItem> {
    // 15MB Maximum Size Validation
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File "${file.name}" exceeds the maximum 15MB limit.`);
    }

    // Determine and validate evidence type
    let itemType: EvidenceItem['type'] = 'document';
    if (file.type.startsWith('image/')) {
      itemType = 'image';
    } else if (file.type.startsWith('video/')) {
      itemType = 'video';
    } else if (
      file.type === 'application/pdf' ||
      file.type.includes('word') ||
      file.type.includes('document') ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.doc') ||
      file.name.endsWith('.docx')
    ) {
      itemType = 'document';
    } else {
      throw new Error(
        `Unsupported file type "${file.type || file.name}". Allowed formats: Images (JPEG, PNG, WEBP), Videos (MP4, WEBM), and Documents (PDF, DOC).`
      );
    }

    if (onProgress) {
      onProgress(10);
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const userUid = auth.currentUser?.uid || 'guest';
    const storagePath = `evidence/${userUid}/${timestamp}_${sanitizedName}`;

    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          uploadedBy: userUid,
          originalName: file.name,
          category: itemType,
        },
      });

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 90;
            if (onProgress) onProgress(Math.round(progress));
          },
          (error) => {
            console.warn('Firebase Storage upload warning, falling back to persistent client URL:', error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      if (onProgress) onProgress(100);

      return {
        id: `ev-${timestamp}-${Math.floor(Math.random() * 1000)}`,
        name: file.name,
        type: itemType,
        url: downloadUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    } catch (storageErr) {
      console.warn('Using client-side persistent evidence fallback:', storageErr);
      // Fallback to local DataURL so user is not blocked
      let fallbackUrl = '';
      if (itemType === 'image') {
        fallbackUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
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
            img.onerror = () => resolve((e.target?.result as string) || URL.createObjectURL(file));
            img.src = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
      } else {
        fallbackUrl = URL.createObjectURL(file);
      }

      if (onProgress) onProgress(100);

      return {
        id: `ev-${timestamp}-${Math.floor(Math.random() * 1000)}`,
        name: file.name,
        type: itemType,
        url: fallbackUrl,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    }
  },

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
};
