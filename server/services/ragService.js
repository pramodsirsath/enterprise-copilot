// server/services/ragService.js
// RAG query engine: Gemini embeddings → MongoDB Atlas Vector Search → Gemini chat model.

import mongoose from 'mongoose';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';

const TOP_K = 8;
const MAX_HISTORY_TURNS = 8;
const CHAT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const getApiKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const chunksCollection = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database is not connected');
  }
  return mongoose.connection.db.collection('document_chunks');
};

let vectorStore = null;
function getVectorStore() {
  if (!vectorStore) {
    vectorStore = new MongoDBAtlasVectorSearch(
      new GoogleGenerativeAIEmbeddings({ model: 'gemini-embedding-001', apiKey: getApiKey() }),
      {
        collection: chunksCollection(),
        indexName: 'vector_index',
        textKey: 'text',
        embeddingKey: 'embedding',
      }
    );
  }
  return vectorStore;
}

/** LangChain may return content as a string or as an array of parts. */
const contentToText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  }
  return String(content ?? '');
};

const formatHistory = (history) =>
  history
    .filter((m) => (m.role === 'user' || m.role === 'bot' || m.role === 'assistant') && m.text)
    .slice(-MAX_HISTORY_TURNS * 2)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.text).slice(0, 2000)}`)
    .join('\n');

/**
 * Vector search scoped to one organization, then answer with the LLM.
 * @returns {Promise<{ reply: string, retrievedCount: number, sources: string[] }>}
 */
export async function generateRAGAnswer(userQuery, organizationId, history = []) {
  if (!getApiKey()) {
    throw new Error('Missing GEMINI_API_KEY or GOOGLE_API_KEY in server environment');
  }
  const orgId = String(organizationId);

  // ── Step 1: Vector search (pre-filtered by organization) ──
  let retrievedDocs = [];
  try {
    retrievedDocs = await getVectorStore().similaritySearch(userQuery, TOP_K, {
      preFilter: { organizationId: { $eq: orgId } },
    });
  } catch (err) {
    // Happens if the Atlas index doesn't declare organizationId as a filter field.
    console.warn('⚠️ Vector pre-filter failed, using post-filter instead:', err.message);
    try {
      const wide = await getVectorStore().similaritySearch(userQuery, TOP_K * 5);
      // Strict: never leak chunks that aren't tagged with this org.
      retrievedDocs = wide.filter((d) => d.metadata?.organizationId === orgId).slice(0, TOP_K);
    } catch (e) {
      console.error('❌ Vector search error:', e.message);
    }
  }

  // ── Step 2: Fallback when the vector index is still building ──
  if (retrievedDocs.length === 0) {
    const fallback = await chunksCollection()
      .find({ organizationId: orgId }, { projection: { embedding: 0 } })
      .limit(TOP_K)
      .toArray();
    retrievedDocs = fallback.map((c) => ({ pageContent: c.text, metadata: c }));
  }

  // Map chunk docIds → file names for source attribution
  const docIds = [...new Set(retrievedDocs.map((d) => d.metadata?.docId).filter(Boolean))];
  const validIds = docIds.filter((id) => mongoose.isValidObjectId(id));
  const docs = validIds.length
    ? await mongoose.connection.db
        .collection('documents')
        .find({ _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .project({ fileName: 1 })
        .toArray()
    : [];
  const nameById = Object.fromEntries(docs.map((d) => [d._id.toString(), d.fileName]));
  const sources = [...new Set(docIds.map((id) => nameById[id]).filter(Boolean))];

  // ── Step 3: Build the prompt ──
  const contextText = retrievedDocs
    .map((doc, i) => {
      const name = nameById[doc.metadata?.docId] || 'Unknown document';
      return `[Chunk ${i + 1} — ${name}]\n${doc.pageContent}`;
    })
    .join('\n\n');

  const historyText = formatHistory(history);

  const prompt = `You are Enterprise Copilot, an AI assistant for this organization's internal knowledge.
Answer the user's question clearly, concisely, and accurately using ONLY the retrieved document context below.

Guidelines:
- Maintain a helpful, professional tone.
- Use Markdown: short paragraphs, **bold** key terms, bullet lists and tables where helpful.
- Base your answer strictly on facts in the context. Do not invent facts.
- Use the conversation history only to understand follow-up questions.
- If the context does not contain the answer, say: "I could not find relevant information in your organization's documents to answer that."

=== RETRIEVED DOCUMENT CONTEXT ===
${contextText || 'No documents have been processed for this organization yet.'}
${historyText ? `\n=== CONVERSATION HISTORY ===\n${historyText}\n` : ''}
=== USER QUESTION ===
${userQuery}
`;

  // ── Step 4: Generate ──
  const llm = new ChatGoogleGenerativeAI({ model: CHAT_MODEL, apiKey: getApiKey(), temperature: 0.2 });
  const response = await llm.invoke(prompt);

  return {
    reply: contentToText(response.content),
    retrievedCount: retrievedDocs.length,
    sources,
  };
}
