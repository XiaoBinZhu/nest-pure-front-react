import { parseDataUri } from '@lobechat/model-runtime';
import { uuid } from '@lobechat/utils';
import dayjs from 'dayjs';
import { sha256 } from 'js-sha256';

import { fileEnv } from '@/envs/file';
import { type FileMetadata, type UploadBase64ToS3Result } from '@/types/files';
import { type FileUploadState, type FileUploadStatus } from '@/types/files/upload';

export const UPLOAD_NETWORK_ERROR = 'NetWorkError';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// 获取存储的 accessToken（与 _api.ts 一致）
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || null;
}

/**
 * Generate file storage path metadata for S3-compatible storage
 * @param originalFilename - Original filename
 * @param options - Path generation options
 * @returns Path metadata including date, dirname, filename, and pathname
 */
const generateFilePathMetadata = (
  originalFilename: string,
  options: { directory?: string; pathname?: string } = {},
): {
  date: string;
  dirname: string;
  filename: string;
  pathname: string;
} => {
  // Generate unique filename with UUID prefix and original extension
  const extension = originalFilename.split('.').at(-1);
  const filename = `${uuid()}.${extension}`;

  // Generate timestamp-based directory path
  const date = (Date.now() / 1000 / 60 / 60).toFixed(0);
  const dirname = `${options.directory || fileEnv.NEXT_PUBLIC_S3_FILE_PATH}/${date}`;
  const pathname = options.pathname ?? `${dirname}/${filename}`;

  return {
    date,
    dirname,
    filename,
    pathname,
  };
};

interface UploadFileToS3Options {
  abortController?: AbortController;
  directory?: string;
  filename?: string;
  onNotSupported?: () => void;
  onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
  pathname?: string;
  skipCheckFileType?: boolean;
}

class UploadService {
  /**
   * uniform upload method for both server and client
   */
  uploadFileToS3 = async (
    file: File,
    { onProgress, directory, pathname, abortController }: UploadFileToS3Options,
  ): Promise<{ data: FileMetadata; success: boolean }> => {
    // 对接 nest-admin 上传接口：POST /api/v1/c-end/files
    const data = await this.uploadToServerS3(file, {
      abortController,
      directory,
      onProgress,
      pathname,
    });
    return { data, success: true };
  };

  uploadBase64ToS3 = async (
    base64Data: string,
    options: UploadFileToS3Options = {},
  ): Promise<UploadBase64ToS3Result> => {
    // Parse base64 data
    const { base64, mimeType, type } = parseDataUri(base64Data);

    if (!base64 || !mimeType || type !== 'base64') {
      throw new Error('Invalid base64 data for image');
    }

    // Convert base64 to Blob
    const byteCharacters = atob(base64);
    const byteArrays = [];

    // Process in chunks to avoid memory issues
    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);

      const byteNumbers: number[] = Array.from({ length: slice.length });
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: mimeType });

    // Determine file extension
    const fileExtension = mimeType.split('/')[1] || 'png';
    const fileName = `${options.filename || `image_${dayjs().format('YYYY-MM-DD-hh-mm-ss')}`}.${fileExtension}`;

    // Create file object
    const file = new File([blob], fileName, { type: mimeType });

    // Use unified upload method
    const { data: metadata } = await this.uploadFileToS3(file, options);
    const hash = sha256(await file.arrayBuffer());

    return {
      fileType: mimeType,
      hash,
      metadata,
      size: file.size,
    };
  };

  uploadDataToS3 = async (data: object, options: UploadFileToS3Options = {}) => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const file = new File([blob], options.filename || 'data.json', { type: 'application/json' });
    return await this.uploadFileToS3(file, options);
  };

  // 直接 multipart 上传到 nest-admin：POST /api/v1/c-end/files
  uploadToServerS3 = async (
    file: File,
    {
      onProgress,
      directory,
      pathname,
      abortController,
    }: {
      abortController?: AbortController;
      directory?: string;
      onProgress?: (status: FileUploadStatus, state: FileUploadState) => void;
      pathname?: string;
    },
  ): Promise<FileMetadata> => {
    const xhr = new XMLHttpRequest();
    const {
      date,
      dirname,
      filename,
      pathname: finalPathname,
    } = generateFilePathMetadata(file.name, { directory, pathname });
    const startTime = Date.now();

    // Setup abort listener
    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const progress = Number(((event.loaded / event.total) * 100).toFixed(1));

        const speedInByte = event.loaded / ((Date.now() - startTime) / 1000);

        onProgress?.('uploading', {
          progress: progress === 100 ? 99.9 : progress,
          restTime: (event.total - event.loaded) / speedInByte,
          speed: speedInByte,
        });
      }
    });

    // 使用 FormData 进行 multipart 上传
    const formData = new FormData();
    formData.append('file', file, filename);

    return new Promise<FileMetadata>((resolve, reject) => {
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.('success', {
            progress: 100,
            restTime: 0,
            speed: file.size / ((Date.now() - startTime) / 1000),
          });
          try {
            const response = JSON.parse(xhr.responseText);
            // 兼容 nest-admin 返回结构：优先取 data 字段
            const result = response?.data ?? response;
            resolve({
              date,
              dirname,
              filename,
              path: result?.path || finalPathname,
              url: result?.url,
              ...result,
            });
          } catch {
            resolve({
              date,
              dirname,
              filename,
              path: finalPathname,
            });
          }
        } else {
          reject(xhr.statusText);
        }
      });
      xhr.addEventListener('error', () => {
        if (xhr.status === 0) reject(UPLOAD_NETWORK_ERROR);
        else reject(xhr.statusText);
      });
      xhr.addEventListener('abort', () => {
        onProgress?.('cancelled', { progress: 0, restTime: 0, speed: 0 });
        reject(new Error('Upload cancelled by user'));
      });

      xhr.open('POST', `${API_BASE}/api/v1/c-end/files`);
      // 注入 JWT（multipart 上传不设置 Content-Type，由浏览器自动添加 boundary）
      const token = getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  };
}

export const uploadService = new UploadService();
