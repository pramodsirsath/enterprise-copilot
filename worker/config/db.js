// worker/config/db.js
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('Missing MONGODB_URI in environment variables');
}

export const mongoClient = new MongoClient(mongoUri);

let isConnected = false;

export async function connectDB() {
  if (!isConnected) {
    await mongoClient.connect();
    isConnected = true;
    console.log('🍃 Connected to MongoDB Atlas');
  }
  return mongoClient.db();
}

/**
 * Returns a configured MongoDBAtlasVectorSearch vector store instance using Gemini embeddings.
 */
export async function getVectorStore() {
  const db = await connectDB();
  const collection = db.collection('document_chunks');

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: 'gemini-embedding-001',
    apiKey: apiKey,
  });

  return new MongoDBAtlasVectorSearch(embeddings, {
    collection: collection,
    indexName: 'vector_index',
    textKey: 'text',
    embeddingKey: 'embedding',
  });
}

/**
 * Helper to update document processing status in MongoDB.
 */
export async function updateDocumentStatus(docId, status, extra = {}) {
  try {
    const db = await connectDB();
    const update = { $set: { status, updatedAt: new Date(), ...extra } };
    if (!('error' in extra)) update.$unset = { error: '' };
    await db.collection('documents').updateOne({ _id: new ObjectId(docId) }, update);
    console.log(`📌 Document ${docId} status updated to: ${status}`);
  } catch (err) {
    console.error(`⚠️ Failed to update document status for ${docId}:`, err.message);
  }
}
