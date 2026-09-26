import { AlertCircle, ArrowUp, BookOpen, ChevronDown, ChevronUp, LoaderCircle, MessageSquareText, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getJsonCached } from "../../lib/api-cache";
import { PublishedDocumentContent, type LibraryDetail } from "../library/LibraryPage";
import { formatKnowledgeAnswer } from "./message-format";
import "./knowledge-chat.css";

interface Citation { id?: string; title: string; excerpt?: string; url?: string; source?: string; }
interface ChatResponse { answer?: string; citations?: Array<Citation | string>; sources?: Citation[]; message?: string; }
interface ChatMessage { id: string; role: "user" | "assistant"; content: string; sources?: Citation[]; }
interface SavedConversation { savedAt: string; messages: ChatMessage[]; }

const previousConversationKey = "tds-knowledge-chat-previous";

function messageId(role: ChatMessage["role"]): string { return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function readPreviousConversation(): SavedConversation | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(previousConversationKey) || "null") as SavedConversation | null;
    if (!value || !Array.isArray(value.messages) || !value.messages.some(({ role }) => role === "assistant")) return null;
    return value;
  } catch { return null; }
}

function saveConversation(messages: ChatMessage[]): SavedConversation | null {
  if (!messages.some(({ role }) => role === "assistant")) return null;
  const conversation = { savedAt: new Date().toISOString(), messages };
  try { window.sessionStorage.setItem(previousConversationKey, JSON.stringify(conversation)); } catch { /* The active chat still works when session storage is unavailable. */ }
  return conversation;
}

function MessageText({ content }: { content: string }) {
  return <div className="knowledge-message-copy">{formatKnowledgeAnswer(content).map((block, index) => {
    const key = `${index}-${block.type}`;
    if (block.type === "heading") return <h3 key={key}>{block.text}</h3>;
    if (block.type === "paragraph") return <p key={key}>{block.text}</p>;
    const items = block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>);
    return block.type === "ordered-list" ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
  })}</div>;
}

function MessageSources({ sources = [], onOpen }: { sources?: Citation[]; onOpen: (source: Citation) => void }) {
  if (!sources.length) return null;
  return <div className="knowledge-message-sources"><span>Sources</span><ul>{sources.map((source, index) => <li key={source.id || `${source.title}-${index}`}><BookOpen size={14} />{source.id ? <button type="button" onClick={() => onOpen(source)}>{source.title}</button> : source.url ? <a href={source.url}>{source.title}</a> : source.title}</li>)}</ul></div>;
}

export function KnowledgeChatPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previous, setPrevious] = useState<SavedConversation | null>(() => readPreviousConversation());
  const [showPrevious, setShowPrevious] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<Citation | null>(null);
  const [sourceDetail, setSourceDetail] = useState<LibraryDetail | null>(null);
  const [sourceError, setSourceError] = useState("");
  const messagesRef = useRef(messages);
  const conversationRef = useRef<HTMLElement | null>(null);
  const sourceDialogRef = useRef<HTMLElement | null>(null);
  messagesRef.current = messages;

  useEffect(() => () => { saveConversation(messagesRef.current); }, []);
  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const frame = window.requestAnimationFrame(() => conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [messages, busy]);

  const closeSource = () => { setSource(null); setSourceDetail(null); setSourceError(""); };
  useEffect(() => {
    if (!source) return;
    sourceDialogRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") closeSource(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [source]);

  const openSource = async (citation: Citation) => {
    if (!citation.id) return;
    setSource(citation); setSourceDetail(null); setSourceError("");
    try { setSourceDetail(await getJsonCached<LibraryDetail>(`/api/library/${citation.id}`, 0)); }
    catch { setSourceError("This source could not be opened or is no longer available to you."); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    const userMessage: ChatMessage = { id: messageId("user"), role: "user", content: prompt };
    const priorMessages = messages;
    setMessages([...priorMessages, userMessage]);
    setQuestion(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/knowledge-chat", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ message: prompt, history: priorMessages.map(({ role, content }) => ({ role, content })) }),
      });
      const payload = await response.json() as ChatResponse;
      if (!response.ok) throw new Error(payload.message || "The knowledge answer could not be generated.");
      if (!payload.answer?.trim()) throw new Error("No answer was returned. Try a more specific question.");
      const sources = payload.sources || (Array.isArray(payload.citations) ? payload.citations.flatMap((citation) => typeof citation === "object" ? [citation] : []) : []);
      setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", content: payload.answer!.trim(), sources }]);
    } catch (cause) {
      setMessages(priorMessages); setQuestion(prompt);
      setError(cause instanceof Error ? cause.message : "The knowledge answer could not be generated.");
    } finally { setBusy(false); }
  };

  const newChat = () => {
    const saved = saveConversation(messages);
    if (saved) setPrevious(saved);
    setMessages([]); setQuestion(""); setError(""); setShowPrevious(false);
  };

  const sendWithShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const previousTitle = previous?.messages.find(({ role }) => role === "user")?.content || "Previous conversation";
  const previousQuestions = previous?.messages.filter(({ role }) => role === "user").length || 0;

  return <div className="page knowledge-chat-page">
    <header className="page-heading knowledge-chat-heading"><div><span className="eyebrow">Answers from approved knowledge</span><h1>Knowledge chat</h1><p>Ask follow-up questions while you stay on this page. Every answer is checked against the documents you can access.</p></div>{messages.length > 0 && <button className="secondary-button" type="button" onClick={newChat}><Plus size={16} /> New chat</button>}</header>

    <section className="knowledge-conversation" ref={conversationRef} aria-live="polite" aria-label="Current knowledge conversation">
      {messages.length === 0 && <div className="knowledge-chat-welcome"><MessageSquareText size={24} aria-hidden="true" /><div><h2>Ask the knowledge base</h2><p>Start with a question about published, non-deprecated guidance. You can ask follow-up questions after the first answer.</p></div></div>}
      {messages.map((message) => <article className={`knowledge-message knowledge-message-${message.role}`} key={message.id}><div className="knowledge-message-label">{message.role === "user" ? "You" : "Knowledge assistant"}</div><MessageText content={message.content} /><MessageSources sources={message.sources} onOpen={(citation) => void openSource(citation)} /></article>)}
      {busy && <div className="knowledge-chat-status" role="status"><LoaderCircle className="spin" size={20} /><span>Searching approved knowledge and preparing an answer…</span></div>}
    </section>

    {error && <div className="knowledge-chat-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

    <form className="knowledge-chat-composer" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="knowledge-question">Ask a question</label>
      <div className="knowledge-composer-row"><textarea id="knowledge-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={sendWithShortcut} placeholder={messages.length ? "Ask a follow-up question…" : "How do I create a CCWR quote for Dell EMC?"} rows={2} disabled={busy} /><button className="primary-button" type="submit" aria-label="Send question" disabled={busy || !question.trim()}>{busy ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} />}</button></div>
      <span className="knowledge-composer-help">Press Ctrl + Enter (Windows) or Command + Enter (Mac) to send. Answers use approved knowledge and include sources when available.</span>
    </form>

    {previous && <section className="panel previous-conversation-card"><button type="button" onClick={() => setShowPrevious((visible) => !visible)} aria-expanded={showPrevious}><div><span className="eyebrow">Previous conversation</span><strong>{previousTitle}</strong><small>{previousQuestions} question{previousQuestions === 1 ? "" : "s"} · Saved for this browser session</small></div>{showPrevious ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>{showPrevious && <div className="previous-conversation-transcript">{previous.messages.map((message) => <article className={`knowledge-message knowledge-message-${message.role}`} key={message.id}><div className="knowledge-message-label">{message.role === "user" ? "You" : "Knowledge assistant"}</div><MessageText content={message.content} /><MessageSources sources={message.sources} onOpen={(citation) => void openSource(citation)} /></article>)}</div>}</section>}
    {source && <div className="review-dialog-backdrop" role="presentation" onMouseDown={closeSource}><section ref={sourceDialogRef} className="review-dialog library-dialog knowledge-source-dialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-source-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Knowledge chat source</span><h2 id="knowledge-source-title">{sourceDetail?.draft.title || source.title}</h2>{sourceDetail && <p>{sourceDetail.sourceSpace} · Updated {new Date(sourceDetail.updatedAt).toLocaleDateString()}</p>}</div><button type="button" className="icon-button" onClick={closeSource} aria-label="Close source document"><X size={20} /></button></header>{sourceError ? <div className="empty-state"><AlertCircle size={22} /><p>{sourceError}</p></div> : !sourceDetail ? <div className="empty-state"><LoaderCircle className="spin" size={22} /><p>Loading source document…</p></div> : <div className="published-document"><PublishedDocumentContent detail={sourceDetail} /></div>}</section></div>}
  </div>;
}
