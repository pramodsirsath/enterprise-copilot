import crypto from 'crypto';
import mongoose from 'mongoose';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Document from '../models/Document.js';
import { s3Client, S3_BUCKET, sqsClient, SQS_QUEUE_URL, missingAwsConfig } from '../config/s3.js';
import { generateRAGAnswer } from '../services/ragService.js';
import { signToken, publicUser } from '../middleware/authMiddleware.js';

// Types the worker knows how to extract text from.
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const generateInviteCode = () => crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars

const uniqueInviteCode = async () => {
  let code = generateInviteCode();
  while (await Organization.exists({ inviteCode: code })) code = generateInviteCode();
  return code;
};

const orgPayload = (org, role) => ({
  _id: org._id,
  name: org.name,
  inviteCode: role === 'admin' ? org.inviteCode : undefined,
});

/* ─────────────────────────── Organization ─────────────────────────── */

export const createOrganization = async (req, res) => {
  try {
    const orgName = String(req.body.orgName || '').trim();
    if (!orgName) {
      return res.status(400).json({ message: 'Please provide an organization name' });
    }
    if (req.user.orgId) {
      return res.status(400).json({ message: 'You already belong to an organization' });
    }

    const organization = await Organization.create({
      name: orgName,
      inviteCode: await uniqueInviteCode(),
    });

    const user = req.userDoc;
    user.orgId = organization._id;
    user.role = 'admin';
    await user.save();

    res.status(201).json({
      message: 'Organization created successfully',
      organization: orgPayload(organization, 'admin'),
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Error in createOrganization:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const joinOrganization = async (req, res) => {
  try {
    const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!inviteCode) {
      return res.status(400).json({ message: 'Please provide an invite code' });
    }
    if (req.user.orgId) {
      return res.status(400).json({ message: 'You already belong to an organization' });
    }

    const organization = await Organization.findOne({ inviteCode });
    if (!organization) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    const user = req.userDoc;
    user.orgId = organization._id;
    user.role = 'member';
    await user.save();

    res.status(200).json({
      message: 'Joined organization successfully',
      organization: orgPayload(organization, 'member'),
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Error in joinOrganization:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const regenerateInviteCode = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.orgId);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    org.inviteCode = await uniqueInviteCode();
    await org.save();
    res.json({ inviteCode: org.inviteCode });
  } catch (error) {
    console.error('Error in regenerateInviteCode:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const listMembers = async (req, res) => {
  try {
    const members = await User.find({ orgId: req.user.orgId })
      .select('email role createdAt')
      .sort({ createdAt: 1 });
    res.json({ members });
  } catch (error) {
    console.error('Error in listMembers:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ───────────────────────────── Documents ───────────────────────────── */

export const listDocuments = async (req, res) => {
  try {
    const documents = await Document.find({ organizationId: req.user.orgId })
      .select('fileName mimeType fileSize status error createdAt updatedAt')
      .sort({ createdAt: -1 });
    res.json({ documents });
  } catch (error) {
    console.error('Error in listDocuments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Step 1 of upload: validate and hand back a presigned S3 PUT URL. */
export const uploadDocument = async (req, res) => {
  try {
    const missing = missingAwsConfig();
    if (missing.length) {
      console.error('❌ Upload unavailable, missing env vars:', missing.join(', '));
      return res.status(500).json({
        message: `Upload is not configured on the server. Missing: ${missing.join(', ')}`,
      });
    }

    const { fileName, mimeType } = req.body;
    const fileSize = Number(req.body.fileSize);

    if (!fileName || !mimeType || !fileSize) {
      return res.status(400).json({ message: 'fileName, mimeType and fileSize are required' });
    }
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ message: 'Unsupported file type. Use PDF, DOCX, TXT, MD or CSV.' });
    }
    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ message: 'File size must be between 1 byte and 50 MB' });
    }

    // Organization always comes from the authenticated user, never from the request body.
    const organizationId = req.user.orgId;
    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const s3Key = `organizations/${organizationId}/documents/${crypto.randomUUID()}/${safeFileName}`;

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({ Bucket: S3_BUCKET, Key: s3Key, ContentType: mimeType }),
      { expiresIn: 15 * 60 }
    );

    const document = await Document.create({
      organizationId,
      uploadedBy: req.user.userId,
      fileName: safeFileName,
      mimeType,
      fileSize,
      s3Key,
      s3Bucket: S3_BUCKET,
      status: 'uploading',
    });

    return res.status(200).json({
      message: 'Upload URL generated successfully',
      document: { id: document._id, fileName: document.fileName, status: document.status },
      upload: { url: uploadUrl, method: 'PUT', key: s3Key },
    });
  } catch (error) {
    console.error('Error in uploadDocument:', error);
    return res.status(500).json({ message: `Could not prepare upload: ${error.message}` });
  }
};

/** Step 2 of upload: the browser finished the S3 PUT — queue the processing job. */
export const markDocumentUploaded = async (req, res) => {
  try {
    const { documentId } = req.body;
    if (!documentId || !mongoose.isValidObjectId(documentId)) {
      return res.status(400).json({ message: 'A valid documentId is required' });
    }

    const doc = await Document.findOne({ _id: documentId, organizationId: req.user.orgId });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.status = 'uploaded';
    doc.error = undefined;
    await doc.save();

    try {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: SQS_QUEUE_URL,
          MessageBody: JSON.stringify({
            docId: doc._id.toString(),
            s3Key: doc.s3Key,
            s3Bucket: doc.s3Bucket,
            mimeType: doc.mimeType,
            organizationId: doc.organizationId.toString(),
          }),
        })
      );
    } catch (sqsError) {
      doc.status = 'failed';
      doc.error = 'Could not queue document for processing';
      await doc.save();
      throw sqsError;
    }

    console.log(`📤 SQS job enqueued for docId: ${doc._id}`);
    return res.status(200).json({
      message: 'Document queued for processing',
      document: { id: doc._id, status: doc.status },
    });
  } catch (error) {
    console.error('Error in markDocumentUploaded:', error);
    return res.status(500).json({ message: `Could not queue document: ${error.message}` });
  }
};

/** Re-queue a failed document. */
export const retryDocument = async (req, res) => {
  req.body = { documentId: req.params.id };
  return markDocumentUploaded(req, res);
};

export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

    const doc = await Document.findOne({ _id: id, organizationId: req.user.orgId });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    await mongoose.connection.db.collection('document_chunks').deleteMany({ docId: id });
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: doc.s3Bucket, Key: doc.s3Key }));
    } catch (s3Error) {
      console.warn(`⚠️ Could not delete S3 object ${doc.s3Key}:`, s3Error.message);
    }
    await doc.deleteOne();

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ──────────────────────────────── Chat ──────────────────────────────── */

export const chatMessage = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Message is required' });

    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const { reply, retrievedCount, sources } = await generateRAGAnswer(
      message,
      req.user.orgId,
      history
    );

    res.status(200).json({ message: 'RAG response generated', reply, retrievedCount, sources });
  } catch (error) {
    console.error('Error in chatMessage RAG:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};
