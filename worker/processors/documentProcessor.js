// worker/processors/documentProcessor.js
// Pipeline: S3 download → text extraction → LangChain chunking → Gemini Embedding → MongoDB Vector Store

import { downloadFromS3 } from '../s3.js';
import { extractText } from '../extractors/pdfExtractor.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { connectDB, getVectorStore, updateDocumentStatus } from '../config/db.js';

/**
 * Full pipeline for one document job received from SQS.
 * @param {{ docId: string, s3Key: string, s3Bucket: string, mimeType: string, organizationId: string }} payload
 */
export async function processDocument(payload) {
  const { docId, s3Key, s3Bucket, mimeType, organizationId } = payload;

  try {
    // ── Step 1: Update DB status to 'processing' ──────────────────────────────
    await updateDocumentStatus(docId, 'processing');

    // ── Step 2: Download file buffer from S3 ──────────────────────────────────
    console.log(`📥 [${docId}] Downloading from S3: ${s3Key}`);
    const buffer = await downloadFromS3(s3Bucket, s3Key);
    console.log(`   Downloaded ${buffer.length} bytes`);

    // ── Step 3: Extract plain text ─────────────────────────────────────────────
    console.log(`🔍 [${docId}] Extracting text (${mimeType})...`);
    const rawText = await extractText(buffer, mimeType);
    console.log(`   Extracted ${rawText.length} characters`);

    if (!rawText || !rawText.trim()) {
      throw new Error('Extracted text is empty');
    }

    // ── Step 4: Chunk text with LangChain ─────────────────────────────────────
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });

    const rawChunks = await splitter.splitText(rawText);
    console.log(`✂️  [${docId}] Split into ${rawChunks.length} chunks`);

    // Convert raw string chunks to LangChain Document objects with metadata
    const documents = rawChunks.map((chunk, index) => new LangChainDocument({
      pageContent: chunk,
      metadata: {
        docId,
        organizationId,
        s3Key,
        chunkIndex: index,
      },
    }));

    // ── Step 5: Embed & Store in MongoDB Atlas Vector Search (in batches of 50) ──
    console.log(`🧠 [${docId}] Generating Gemini embeddings & storing in MongoDB Atlas Vector Search...`);
    const vectorStore = await getVectorStore();

    // Remove chunks from any previous (partial) attempt so retries don't create duplicates
    const db = await connectDB();
    await db.collection('document_chunks').deleteMany({ docId });

    const BATCH_SIZE = 50;
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      await vectorStore.addDocuments(batch);
      console.log(`   Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(documents.length / BATCH_SIZE)} (${batch.length} chunks)`);
    }

    console.log(`✅ [${docId}] Successfully stored ${documents.length} vectors in MongoDB!`);

    // ── Step 6: Update DB status to 'completed' ───────────────────────────────
    await updateDocumentStatus(docId, 'completed', { chunkCount: documents.length });

    return { docId, chunkCount: documents.length, status: 'completed' };

  } catch (error) {
    console.error(`❌ [${docId}] Processing failed:`, error.message);
    // Keep it as "processing" while SQS retries; worker.js marks it failed after the last attempt.
    await updateDocumentStatus(docId, 'processing', { error: error.message });
    throw error;
  }
}
