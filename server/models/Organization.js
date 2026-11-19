import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    minlength: 12,
    maxlength: 12,
  },
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);
