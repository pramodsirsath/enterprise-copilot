import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
  Clock,
} from 'lucide-react';
import { api, ACCEPT_ATTR, MAX_FILE_SIZE, mimeForFile, formatBytes, timeAgo } from '../lib/api';
import { Spinner } from './ui';

const PENDING = ['uploading', 'uploaded', 'processing'];

const STATUS = {
  uploading: { label: 'Uploading', cls: 'text-sky-300 bg-sky-500/10', icon: Spinner },
  uploaded: { label: 'Queued', cls: 'text-amber-300 bg-amber-500/10', icon: Clock },
  processing: { label: 'Processing', cls: 'text-indigo-300 bg-indigo-500/10', icon: Spinner },
  completed: { label: 'Ready', cls: 'text-emerald-300 bg-emerald-500/10', icon: CheckCircle2 },
  failed: { label: 'Failed', cls: 'text-red-300 bg-red-500/10', icon: XCircle },
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.failed;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
};

/** PUT the file straight to S3 with progress reporting. */
const putToS3 = (url, file, contentType, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 rejected the upload (HTTP ${xhr.status}). Check the bucket CORS policy.`));
    xhr.onerror = () =>
      reject(new Error('Could not reach S3. Make sure the bucket CORS allows PUT from this site.'));
    xhr.send(file);
  });

export default function DocumentsPanel({ isAdmin, onDocumentsChange }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploads, setUploads] = useState([]); // in-flight uploads: {id, name, progress, stage, error}
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const inputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api('/api/org/documents');
      setDocuments(data.documents);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    onDocumentsChange?.(documents);
  }, [documents, onDocumentsChange]);

  // Poll while anything is still being processed by the worker
  const hasPending = documents.some((d) => PENDING.includes(d.status));
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(fetchDocuments, 4000);
    return () => clearInterval(t);
  }, [hasPending, fetchDocuments]);

  const patchUpload = (id, patch) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  const uploadOne = async (file) => {
    const id = `${file.name}-${Date.now()}-${Math.random()}`;
    const mimeType = mimeForFile(file);
    setUploads((list) => [...list, { id, name: file.name, progress: 0, stage: 'Preparing…' }]);

    if (!mimeType) {
      return patchUpload(id, { error: 'Unsupported type. Use PDF, DOCX, TXT, MD or CSV.' });
    }
    if (file.size > MAX_FILE_SIZE) return patchUpload(id, { error: 'File is larger than 50 MB.' });
    if (file.size === 0) return patchUpload(id, { error: 'File is empty.' });

    let documentId = null;
    try {
      const data = await api('/api/org/upload', {
        method: 'POST',
        body: { fileName: file.name, mimeType, fileSize: file.size },
      });
      documentId = data.document.id;
      fetchDocuments();

      patchUpload(id, { stage: 'Uploading…' });
      await putToS3(data.upload.url, file, mimeType, (progress) => patchUpload(id, { progress }));

      patchUpload(id, { stage: 'Queuing…', progress: 100 });
      await api('/api/org/uploaded', { method: 'POST', body: { documentId } });

      setUploads((list) => list.filter((u) => u.id !== id));
      fetchDocuments();
    } catch (err) {
      // Clean up the half-created record so it doesn't sit in "uploading" forever
      if (documentId) {
        await api(`/api/org/documents/${documentId}`, { method: 'DELETE' }).catch(() => {});
        fetchDocuments();
      }
      patchUpload(id, { error: err.message });
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (inputRef.current) inputRef.current.value = '';
    for (const file of files) await uploadOne(file); // sequential keeps S3/worker load sane
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.fileName}"? It will no longer be used to answer questions.`)) return;
    setBusyId(doc._id);
    try {
      await api(`/api/org/documents/${doc._id}`, { method: 'DELETE' });
      setDocuments((d) => d.filter((x) => x._id !== doc._id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (doc) => {
    setBusyId(doc._id);
    try {
      await api(`/api/org/documents/${doc._id}/retry`, { method: 'POST' });
      await fetchDocuments();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const readyCount = documents.filter((d) => d.status === 'completed').length;

  return (
    <section className="card flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Knowledge base</h2>
          <p className="text-xs text-gray-500">
            {readyCount} of {documents.length} document{documents.length === 1 ? '' : 's'} ready
          </p>
        </div>
        <button onClick={fetchDocuments} className="icon-btn" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {isAdmin && (
        <div className="p-4 pb-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition ${
              dragging
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-white/15 hover:border-indigo-400/60 hover:bg-white/[0.02]'
            }`}
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500/15 text-indigo-300">
              <CloudUpload size={20} />
            </div>
            <div className="text-sm font-medium text-white">
              Drop files or <span className="text-indigo-300">browse</span>
            </div>
            <div className="text-xs text-gray-500">PDF, DOCX, TXT, MD, CSV · up to 50 MB</div>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {uploads.length > 0 && (
            <ul className="mt-3 space-y-2">
              {uploads.map((u) => (
                <li key={u.id} className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-200">{u.name}</span>
                    {u.error ? (
                      <button
                        className="shrink-0 text-gray-500 hover:text-white"
                        onClick={() => setUploads((l) => l.filter((x) => x.id !== u.id))}
                      >
                        Dismiss
                      </button>
                    ) : (
                      <span className="shrink-0 text-gray-400">{u.stage}</span>
                    )}
                  </div>
                  {u.error ? (
                    <p className="mt-1 text-xs text-red-300">{u.error}</p>
                  ) : (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-8 text-gray-500">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-3 text-sm text-red-300">{loadError}</p>
        ) : documents.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {isAdmin
              ? 'No documents yet. Upload your first file to get started.'
              : 'No documents yet. Ask an admin to upload some.'}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {documents.map((doc) => {
              const Icon = doc.mimeType === 'text/csv' ? FileSpreadsheet : FileText;
              return (
                <li
                  key={doc._id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-gray-400">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-100" title={doc.fileName}>
                      {doc.fileName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                      <StatusBadge status={doc.status} />
                      <span>{formatBytes(doc.fileSize)}</span>
                      <span className="hidden sm:inline">· {timeAgo(doc.createdAt)}</span>
                    </div>
                    {doc.error && (
                      <div className="mt-1 truncate text-[11px] text-red-300/80" title={doc.error}>
                        {doc.error}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      {doc.status === 'failed' && (
                        <button
                          className="icon-btn"
                          title="Retry processing"
                          disabled={busyId === doc._id}
                          onClick={() => handleRetry(doc)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        className="icon-btn hover:!text-red-300"
                        title="Delete"
                        disabled={busyId === doc._id}
                        onClick={() => handleDelete(doc)}
                      >
                        {busyId === doc._id ? <Spinner size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
