import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, Send, Tag, MessageSquare } from "lucide-react";

interface Note {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

interface Tag_ {
  id: string;
  name: string;
  color: string;
}

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  channel: string;
  source_page: string;
  created_at: string;
  notes: Note[];
  tags: Tag_[];
}

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [newTag, setNewTag] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setMessage(data);
        setStatus(data.status);
        setPriority(data.priority);
      })
      .catch(() => navigate("/vega/admin/inbox"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function updateField(field: string, value: string) {
    if (!id) return;
    await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !noteBody.trim()) return;
    const res = await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/notes`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody }),
    });
    const note = await res.json();
    setMessage((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
    setNoteBody("");
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newTag.trim()) return;
    await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/tags`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_name: newTag }),
    });
    setNewTag("");
    const refreshed = await fetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, { credentials: "include" }).then((r) => r.json());
    setMessage(refreshed);
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;
  if (!message) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate("/vega/admin/inbox")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{message.subject}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {message.sender_name} ({message.sender_email}) — {message.reference}
          </p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => { setStatus(e.target.value); updateField("status", e.target.value); }} className="px-3 py-1 border rounded-lg text-sm">
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="spam">Spam</option>
          </select>
          <select value={priority} onChange={(e) => { setPriority(e.target.value); updateField("priority", e.target.value); }} className="px-3 py-1 border rounded-lg text-sm">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        <div className="mt-4 pt-4 border-t flex gap-4 text-xs text-muted-foreground">
          <span>Channel: {message.channel}</span>
          <span>Received: {new Date(message.created_at).toLocaleString()}</span>
          {message.sender_phone && <span>Phone: {message.sender_phone}</span>}
        </div>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {message.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          {message.tags.map((t) => (
            <span key={t.id} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">{t.name}</span>
          ))}
        </div>
        <form onSubmit={addTag} className="flex gap-2">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="flex-1 px-3 py-1 border rounded-lg text-sm" />
          <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm">Add</button>
        </form>
      </div>

      <div className="rounded-xl bg-card border p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notes</h2>
        <div className="space-y-3 mb-4">
          {message.notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet</p>}
          {message.notes.map((n) => (
            <div key={n.id} className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <form onSubmit={addNote} className="flex gap-2">
          <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note..." className="flex-1 px-3 py-1 border rounded-lg text-sm" />
          <button type="submit" className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm flex items-center gap-1">
            <Send className="h-3 w-3" /> Add
          </button>
        </form>
      </div>
    </div>
  );
}
