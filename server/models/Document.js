import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },

        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        fileName: {
            type: String,
            required: true,
        },

        mimeType: {
            type: String,
            required: true,
        },

        fileSize: {
            type: Number,
            required: true,
        },

        s3Key: {
            type: String,
            required: true,
        },

        s3Bucket: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ['uploading', 'uploaded', 'processing', 'completed', 'failed'],
            default: 'uploading',
        },

        error: {
            type: String,
        },

        chunkCount: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('Document', documentSchema);