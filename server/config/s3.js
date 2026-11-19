import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const s3Client = new S3Client({ region: process.env.AWS_REGION, credentials });
export const sqsClient = new SQSClient({ region: process.env.AWS_REGION, credentials });

// Accept a few common names for the bucket variable.
export const S3_BUCKET =
  process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME;
export const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

/** Returns a list of missing AWS settings (empty when fully configured). */
export const missingAwsConfig = () => {
  const missing = [];
  if (!process.env.AWS_REGION) missing.push('AWS_REGION');
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (!S3_BUCKET) missing.push('AWS_S3_BUCKET');
  if (!SQS_QUEUE_URL) missing.push('SQS_QUEUE_URL');
  return missing;
};
