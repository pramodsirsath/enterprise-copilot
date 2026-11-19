// worker/s3.js
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from './config/aws.js';

export async function downloadFromS3(bucket, key) {
  const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

  // Convert stream to Buffer
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}
