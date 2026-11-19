// worker/extractors/pdfExtractor.js
import { WebPDFLoader } from '@langchain/community/document_loaders/web/pdf';
import mammoth from 'mammoth';

/**
 * Extracts plain text from a Buffer using LangChain WebPDFLoader for PDFs,
 * mammoth for DOCX, and Buffer.toString for TXT/CSV.
 * 
 * @param {Buffer} buffer  - Raw file bytes downloaded from S3
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} - Extracted plain text
 */
export async function extractText(buffer, mimeType) {
  switch (mimeType) {
    case 'application/pdf': {
      // Create a Blob from Buffer to pass into LangChain's WebPDFLoader
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const loader = new WebPDFLoader(blob, {
        parsedItemSeparator: '\n',
      });
      const docs = await loader.load();
      // Concatenate text from each page/document loaded
      return docs.map((doc) => doc.pageContent).join('\n\n');
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    case 'text/plain':
    case 'text/markdown':
    case 'text/csv': {
      return buffer.toString('utf-8');
    }

    default:
      throw new Error(`Unsupported mimeType for extraction: ${mimeType}`);
  }
}
