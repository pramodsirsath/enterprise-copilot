// worker/worker.js
import 'dotenv/config';
import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './config/aws.js';
import { processDocument } from './processors/documentProcessor.js';
import { updateDocumentStatus } from './config/db.js';

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const MAX_ATTEMPTS = 3;

if (!QUEUE_URL) {
  console.error('❌ SQS_QUEUE_URL is not set in worker/.env');
  process.exit(1);
}

const deleteMessage = (msg) =>
  sqsClient.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: msg.ReceiptHandle }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleMessage(msg) {
  let payload;
  try {
    payload = JSON.parse(msg.Body);
  } catch {
    console.warn('⏭️  Dropping message with invalid JSON body');
    return deleteMessage(msg);
  }

  // Skip S3 event notifications / test events (they lack docId or s3Key)
  if (payload.Records || payload.Event === 's3:TestEvent' || !payload.docId || !payload.s3Key) {
    console.log('⏭️  Skipping non-worker message:', payload.Event || payload.Service || 'unknown');
    return deleteMessage(msg);
  }

  const attempt = Number(msg.Attributes?.ApproximateReceiveCount || 1);
  console.log(`📩 Got job (attempt ${attempt}/${MAX_ATTEMPTS}):`, payload.docId);

  try {
    await processDocument(payload);
    await deleteMessage(msg);
  } catch (err) {
    console.error(`❌ Processing failed for ${payload.docId}:`, err.message);
    if (attempt >= MAX_ATTEMPTS) {
      console.error(`🛑 Giving up on ${payload.docId} after ${attempt} attempts`);
      await updateDocumentStatus(payload.docId, 'failed', { error: err.message });
      await deleteMessage(msg);
    }
    // Otherwise the message becomes visible again after VisibilityTimeout → auto retry
  }
}

async function poll() {
  console.log('👷 Worker started, polling SQS...');

  while (true) {
    try {
      const res = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 300,
          AttributeNames: ['ApproximateReceiveCount'],
        })
      );

      for (const msg of res.Messages || []) {
        await handleMessage(msg);
      }
    } catch (err) {
      // Network blips / credential issues must not kill the worker
      console.error('⚠️ SQS polling error:', err.message);
      await sleep(5000);
    }
  }
}

poll();
