import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

/* Upload a file to R2 */
export async function uploadToR2(filePath: string, fileName: string): Promise<string> {
  const fileContent = fs.readFileSync(filePath);
  
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: getContentType(fileName),
    })
  );

  // Delete local file after upload
  fs.unlinkSync(filePath);

  return fileName;
}

/* Delete a file from R2 */
export async function deleteFromR2(fileName: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
    })
  );
}

/* Signed URL for a file (valid for 1 hour) */
export async function getSignedUrlFromR2(fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
  });

  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/* Determine content type */
function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const types: { [key: string]: string } = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return types[ext || ''] || 'application/octet-stream';
}