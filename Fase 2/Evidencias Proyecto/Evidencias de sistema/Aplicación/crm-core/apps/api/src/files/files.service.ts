// apps/api/src/files/files.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class FilesService {
  private internalS3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000', // interno, para el contenedor
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
    },
  });

  async presignPut(key: string, contentType = 'application/octet-stream') {
    const Bucket = process.env.MINIO_BUCKET || 'crm-archivos';

    // ⚠️ truco: construir un cliente “público” SOLO para firmar (no hace requests)
    const publicS3 = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.MINIO_PRESIGN_BASE || 'http://localhost:9000', // lo que ve el navegador
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
        secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
      },
    });

    const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(publicS3, cmd, { expiresIn: 300 }); // 5 min
    return { url, bucket: Bucket, key };
  }
}
