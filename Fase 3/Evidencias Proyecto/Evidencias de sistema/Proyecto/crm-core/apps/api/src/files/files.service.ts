// apps/api/src/files/files.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';

@Injectable()
export class FilesService {
  private readonly bucket = process.env.MINIO_BUCKET || 'crm-archivos';
  private readonly internalBase = (process.env.MINIO_ENDPOINT || 'http://minio:9000').replace(
    /\/$/,
    '',
  );
  private readonly publicBase = (
    process.env.MINIO_PUBLIC_BASE ||
    process.env.MINIO_PRESIGN_BASE ||
    process.env.MINIO_ENDPOINT ||
    'http://localhost:9000'
  ).replace(/\/$/, '');

  // Formatos de archivo permitidos para evidencias y documentos
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',      // JPG, JPEG (estándar oficial para ambos)
    'image/png',       // PNG
    'image/webp',      // WEBP
    'application/pdf', // PDF
    'text/plain',      // TXT
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  ];

  private readonly ALLOWED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'pdf',
    'txt',
    'doc',
    'docx',
  ];

  private readonly internalS3 = new S3Client({
    region: 'us-east-1',
    endpoint: this.internalBase, // para operar desde el backend
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    },
  });

  private readonly publicSigner = new S3Client({
    region: 'us-east-1',
    endpoint: this.publicBase, // host que verá el navegador
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    },
  });

  async presignPut(key: string, contentType = 'application/octet-stream') {
    // Validar que el tipo de archivo esté permitido si se proporciona
    if (contentType && contentType !== 'application/octet-stream') {
      if (!this.isValidMimeType(contentType)) {
        const allowedFormats = this.ALLOWED_EXTENSIONS.join(', ').toUpperCase();
        throw new BadRequestException(
          `Tipo de archivo no permitido. Formatos permitidos: ${allowedFormats}. Tipo recibido: ${contentType}`
        );
      }
    }

    // Construir un cliente "público" SOLO para firmar (no hace requests)
    const publicS3 = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.MINIO_PRESIGN_BASE || 'http://localhost:9000', // lo que ve el navegador
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
      },
    });

    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(publicS3, cmd, { expiresIn: 300 }); // 5 min
    return { url, bucket: this.bucket, key };
  }

  private decodeBase64(dataUrl: string) {
    if (!dataUrl) {
      throw new BadRequestException('Archivo inválido');
    }
    const match = /^data:(.+);base64,(.*)$/i.exec(dataUrl);
    if (match) {
      return {
        contentType: match[1],
        buffer: Buffer.from(match[2], 'base64'),
      };
    }
    // fallback: asumir base64 sin dataurl
    return {
      contentType: 'application/octet-stream',
      buffer: Buffer.from(dataUrl, 'base64'),
    };
  }

  private extensionFromMime(mime: string) {
    if (!mime) return '';
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    return map[mime.toLowerCase()] || '';
  }

  private isValidMimeType(mimeType: string): boolean {
    if (!mimeType) return false;
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim(); // Remover parámetros como charset
    return this.ALLOWED_MIME_TYPES.includes(normalizedMime);
  }

  private buildKey(prefix: string, extension?: string) {
    const cleanPrefix = prefix.replace(/\/+$/, '');
    const suffix = randomBytes(8).toString('hex');
    const ext = extension ? `.${extension}` : '';
    return `${cleanPrefix}/${Date.now()}-${suffix}${ext}`;
  }

  async uploadBase64Image(dataUrl: string, options?: { prefix?: string }) {
    const { buffer, contentType } = this.decodeBase64(dataUrl);
    if (!buffer.length) {
      throw new BadRequestException('Archivo vacío');
    }

    // Validar que el tipo de archivo esté permitido
    if (!this.isValidMimeType(contentType)) {
      const allowedFormats = this.ALLOWED_EXTENSIONS.join(', ').toUpperCase();
      throw new BadRequestException(
        `Tipo de archivo no permitido. Formatos permitidos: ${allowedFormats}. Tipo recibido: ${contentType || 'desconocido'}`
      );
    }

    const prefix = options?.prefix || 'uploads';
    const ext = this.extensionFromMime(contentType);
    if (!ext) {
      throw new BadRequestException(
        `No se pudo determinar la extensión del archivo. Tipo MIME: ${contentType}`
      );
    }
    const key = this.buildKey(prefix, ext);

    await this.internalS3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      key,
      bucket: this.bucket,
      contentType,
      url: await this.getSignedUrl(key),
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600) {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.publicSigner, cmd, { expiresIn: expiresInSeconds });
  }

  async ensureSignedUrl(pathOrUrl: string, expiresInSeconds = 3600) {
    if (!pathOrUrl) return pathOrUrl;
    if (pathOrUrl.startsWith('http')) {
      if (pathOrUrl.includes('X-Amz-Signature=')) {
        return pathOrUrl;
      }
      try {
        const parsed = new URL(pathOrUrl);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const bucketIndex = segments.findIndex((segment) => segment === this.bucket);
        if (bucketIndex >= 0) {
          const key = segments.slice(bucketIndex + 1).join('/');
          if (key) {
            return this.getSignedUrl(key, expiresInSeconds);
          }
        }
        return pathOrUrl;
      } catch {
        return pathOrUrl;
      }
    }
    return this.getSignedUrl(pathOrUrl, expiresInSeconds);
  }

}
