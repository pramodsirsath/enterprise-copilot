# Enterprise Copilot

A multi-tenant AI workspace that lets an organization chat with its own documents using Retrieval-Augmented Generation (RAG).

Admins upload documents, a background worker extracts and embeds them, and every member of the organization can ask questions that are answered strictly from those documents — with sources.

## Features

- **Organizations & roles** — create an organization (you become admin) or join one with a 12-character invite code
- **Document upload** — drag-and-drop PDF, DOCX, TXT, MD and CSV files (up to 50 MB), uploaded directly to S3 with progress
- **Background processing** — SQS-driven worker extracts text, chunks it, and stores Gemini embeddings in MongoDB Atlas Vector Search
- **Live status** — documents move through Uploading → Queued → Processing → Ready / Failed, with retry and delete for admins
- **Grounded chat** — answers use only your organization's documents, understand follow-up questions, and cite source files
- **Team management** — view members, copy or regenerate the invite code

## Architecture

```
client (React + Vite + Tailwind)
   │  REST + JWT
   ▼
server (Express + MongoDB)
   │  presigned URL ──► S3  (browser uploads the file directly)
   │  job message  ──► SQS
   ▼
worker (Node)
   S3 download → text extraction → chunking → Gemini embeddings → MongoDB Atlas Vector Search
```

## Tech stack

| Layer   | Tech |
|---------|------|
| Client  | React 19, React Router, Tailwind CSS, lucide-react, react-markdown |
| Server  | Node.js, Express 5, Mongoose, JWT, AWS SDK v3 (S3, SQS) |
| Worker  | Node.js, LangChain, Gemini embeddings, mammoth, pdf.js |
| AI / DB | Google Gemini, MongoDB Atlas Vector Search |

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB Atlas cluster with a vector search index named `vector_index` on the `document_chunks` collection (`embedding` field, plus `organizationId` as a filter field)
- AWS S3 bucket and SQS queue
- Google Gemini API key

### 1. Configure environment

Copy the example files and fill in your values:

```bash
cp server/.env.example server/.env
cp worker/.env.example worker/.env
```

The S3 bucket must allow `PUT` from your client origin via CORS, for example:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"]
  }
]
```

### 2. Install and run

```bash
# API server
cd server && npm install && npm run dev

# Background worker (new terminal)
cd worker && npm install && npm run dev

# Client (new terminal)
cd client && npm install && npm run dev
```

Open http://localhost:5173, create an account, create an organization, and upload your first document.

## Project structure

```
client/   React front end
server/   Express API (auth, organizations, documents, chat/RAG)
worker/   SQS consumer that processes and embeds documents
```
