import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
  },
  role: {
    type: String,
    enum: ['admin', 'member', 'none'],
    default: 'none',
  },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
