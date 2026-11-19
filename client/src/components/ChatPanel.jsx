import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Copy, Check, FileText, Sparkles, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

const SUGGESTIONS = [
  'Summarize the key points across our documents',
  'What policies should a new employee know about?',
  'List any deadlines or important dates mentioned',
  'What are the main risks or open issues?',
];

const loadChat = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-btn h-7 w-7"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

const Avatar = () => (
  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
    <Sparkles size={15} className="text-white" />
  </div>
);

export default function ChatPanel({ orgId, orgName, readyCount }) {
  const storageKey = `chat:${orgId}`;
  const [messages, setMessages] = useState(() => loadChat(storageKey));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)));
    } catch {
      /* storage full / disabled */
    }
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Auto-grow the textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.filter((m) => m.role !== 'error');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setInput('');
    setSending(true);

    try {
      const data = await api('/api/org/chat', { method: 'POST', body: { message, history } });
      setMessages((m) => [...m, { role: 'bot', text: data.reply, sources: data.sources || [] }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: err.message }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Ask Copilot</h2>
          <p className="text-xs text-gray-500">
            Answers are grounded in {readyCount} ready document{readyCount === 1 ? '' : 's'}
          </p>
        </div>
        {messages.length > 0 && (
          <button className="btn-ghost text-xs" onClick={() => setMessages([])} disabled={sending}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-xl shadow-indigo-500/30">
              <Sparkles size={26} className="text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white">How can I help with {orgName || 'your workspace'}?</h3>
            <p className="mt-2 text-sm text-gray-400">
              {readyCount > 0
                ? 'Ask anything about your uploaded documents.'
                : 'Once documents are uploaded and processed, I can answer questions about them.'}
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left text-sm text-gray-300 transition hover:border-indigo-400/40 hover:bg-indigo-500/5 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo-500 px-4 py-2.5 text-[0.925rem] text-white">
                    {msg.text}
                  </div>
                </div>
              ) : msg.role === 'error' ? (
                <div key={i} className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-300">
                    <AlertCircle size={15} />
                  </div>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="group flex gap-3">
                  <Avatar />
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="markdown">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {msg.sources?.map((s) => (
                        <span
                          key={s}
                          className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[11px] text-gray-400"
                          title={s}
                        >
                          <FileText size={11} className="shrink-0" />
                          <span className="truncate">{s}</span>
                        </span>
                      ))}
                      <span className="opacity-0 transition group-hover:opacity-100">
                        <CopyButton text={msg.text} />
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
            {sending && (
              <div className="flex gap-3">
                <Avatar />
                <div className="flex items-center gap-1 pt-3 text-gray-400">
                  <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
                  <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 transition focus-within:border-indigo-400/50 focus-within:ring-4 focus-within:ring-indigo-500/10"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about your documents…"
            className="scroll-thin max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:bg-white/10 disabled:text-gray-500"
            title="Send"
          >
            <ArrowUp size={18} />
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-gray-600">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </section>
  );
}
