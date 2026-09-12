import { EvidenceItem } from '../types';
import { storage, auth } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export interface UploadProgressCallback {
  (progress: number): void;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
];

export const uploadService = {
  /**
   * Uploads file to Firebase Storage. Validates size, mime-type, and authentication.
   * Strictly avoids DataURL/objectURL fallbacks. If upload fails, bubbles up error for user retry.
   */
  async uploadFile(
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<EvidenceItem> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required: Please sign in with your account to upload evidence.');
    }

    // 15MB Maximum Size Validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File "${file.name}" (${this.formatFileSize(file.size)}) exceeds the maximum allowed 15MB limit.`
      );
    }

    // Mime-type validation
    const isMimeAllowed = ALLOWED_MIME_TYPES.some((type) => {
      if (file.type === type) return true;
      if (file.type.startsWith('image/') && type.startsWith('image/')) return true;
      return false;
    });

    if (!isMimeAllowed) {
      throw new Error(
        `File format "${file.type || file.name}" is not supported. Permitted formats: JPEG, PNG, WEBP, MP4, and PDF documents.`
      );
    }

    // Determine category
    let itemType: EvidenceItem['type'] = 'document';
    if (file.type.startsWith('image/')) {
      itemType = 'image';
    } else if (file.type.startsWith('video/')) {
      itemType = 'video';
    }

    if (onProgress) {
      onProgress(5);
    }

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `evidence/${currentUser.uid}/${timestamp}_${sanitizedName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
      customMetadata: {
        uploadedBy: currentUser.uid,
        originalName: file.name,
        category: itemType,
      },
    });

    return new Promise<EvidenceItem>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Firebase Storage upload error:', error);
          let userMessage = `Upload failed for "${file.name}". Please check network connection and retry.`;
          if (error.code === 'storage/unauthorized') {
            userMessage = 'Storage permission denied. Ensure you are signed in and attaching permitted file formats.';
          } else if (error.code === 'storage/canceled') {
            userMessage = 'Upload was canceled.';
          }
          reject(new Error(userMessage));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              id: `ev-${timestamp}-${Math.floor(Math.random() * 1000)}`,
              name: file.name,
              type: itemType,
              url: downloadUrl,
              size: file.size,
              uploadedAt: new Date().toISOString(),
            });
          } catch (err: any) {
            reject(new Error(`Failed to retrieve file download URL: ${err.message}`));
          }
        }
      );
    });
  },

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
