import 'dotenv/config'; // Must be first to load env vars before other imports
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import { missingAwsConfig } from './config/s3.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.send('Enterprise Copilot API is running...'));
app.get('/api/health', (req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 })
);

app.use('/api/auth', authRoutes);
app.use('/api/org', orgRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.type === 'entity.parse.failed' ? 400 : err.status || 500;
  res.status(status).json({ message: status === 400 ? 'Invalid request body' : 'Server error' });
});

const start = async () => {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI is not set in server/.env');
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }

  const missing = missingAwsConfig();
  if (missing.length) {
    console.warn(`⚠️ Document upload is disabled until these env vars are set: ${missing.join(', ')}`);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

start();
