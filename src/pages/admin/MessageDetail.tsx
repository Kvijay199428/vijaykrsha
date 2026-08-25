import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import {
  ArrowLeft,
  Plus,
  X,
  Tag,
  MessageSquare,
  Paperclip,
  FileText,
} from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  content_type?: string;
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
  attachments?: Attachment[];
}

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  // Modal states
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Form inputs (used inside modals)
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`)
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
    await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setMessage((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !noteInput.trim()) return;
    const res = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteInput }),
    });
    const note = await res.json();
    setMessage((prev) =>
      prev ? { ...prev, notes: [...prev.notes, note] } : prev
    );
    setNoteInput("");
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !tagInput.trim()) return;
    await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_name: tagInput }),
    });
    setTagInput("");
    const refreshed = await apiFetch(
      `${ROUTES.ADMINAPIMESSAGES}/${id}`
    ).then((r) => r.json());
    setMessage(refreshed);
  }

  async function removeTag(tagId: string) {
    if (!id) return;
    await apiFetch(ROUTES.ADMINAPIMESSAGETAGDELETE(id, tagId), {
      method: "DELETE",
    });
    const refreshed = await apiFetch(
      `${ROUTES.ADMINAPIMESSAGES}/${id}`
    ).then((r) => r.json());
    setMessage(refreshed);
  }

  if (loading)
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  if (!message) return null;

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* ── Header ─────────────────────────────────── */}
      <div className="shrink-0">
        <button
          onClick={() => navigate("/vega/admin/inbox")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to inbox
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">
              {message.subject}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {message.sender_name} &middot; {message.sender_email}
            </p>
            <span className="inline-block mt-1.5 font-mono text-xs neu-concave px-2 py-0.5 rounded-lg text-muted-foreground">
              {message.reference}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <NeuSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                updateField("status", v);
              }}
              options={[
                { value: "new", label: "New" },
                { value: "in_progress", label: "In Progress" },
                { value: "waiting", label: "Waiting" },
                { value: "resolved", label: "Resolved" },
                { value: "spam", label: "Spam" },
              ]}
            />
            <NeuSelect
              value={priority}
              onChange={(v) => {
                setPriority(v);
                updateField("priority", v);
              }}
              options={[
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ── Two-column content ─────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)] gap-4">
        {/* ── Left: Message ────────────────────────── */}
        <div className="min-h-0 overflow-y-auto">
          <div className="neu-flat rounded-xl p-6 space-y-5">
            {/* Body */}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {message.body}
            </p>

            {/* Metadata grid */}
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Channel</span>
                <p className="font-medium mt-0.5">{message.channel}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Received</span>
                <p className="font-medium mt-0.5">
                  {new Date(message.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  ,{" "}
                  {new Date(message.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {message.sender_phone && (
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium mt-0.5">{message.sender_phone}</p>
                </div>
              )}
            </div>

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" /> Attachments &middot;{" "}
                  {message.attachments.length}
                </h3>
                <div className="space-y-2">
                  {message.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api${att.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 neu-concave rounded-xl text-sm hover:bg-muted/30 transition-colors group"
                      title={att.content_type ?? "Download"}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 min-w-0">
                        {att.filename}
                      </span>
                      {typeof att.size === "number" && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {att.size >= 1048576
                            ? `${(att.size / 1048576).toFixed(1)} MB`
                            : `${(att.size / 1024).toFixed(1)} KB`}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Sidebar ───────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-0 lg:h-full lg:overflow-y-auto min-h-0">
          {/* Tags card */}
          <div className="neu-flat rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4" /> Tags
              </h3>
              <button
                onClick={() => setShowTagModal(true)}
                className="p-1.5 neu-btn rounded-lg"
                title="Manage tags"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {message.tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {message.tags.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes card */}
          <div className="neu-flat rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Internal Notes
              </h3>
              <button
                onClick={() => setShowNoteModal(true)}
                className="p-1.5 neu-btn rounded-lg"
                title="Add note"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {message.notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes yet</p>
            ) : (
              <div className="space-y-2">
                {message.notes
                  .slice()
                  .reverse()
                  .slice(0, 3)
                  .map((n) => (
                    <div key={n.id} className="p-2.5 neu-concave rounded-lg">
                      <p className="text-xs leading-relaxed">{n.body}</p>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        &middot;{" "}
                        {new Date(n.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tags Modal ─────────────────────────────── */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Organize this message for easier filtering
            </DialogDescription>
          </DialogHeader>

          {/* Current tags */}
          {message.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Current tags
              </p>
              <div className="flex flex-wrap gap-2">
                {message.tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {t.name}
                    <button
                      onClick={() => removeTag(t.id)}
                      className="hover:text-destructive transition-colors"
                      title={`Remove "${t.name}"`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add tag form */}
          <form onSubmit={addTag} className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={!tagInput.trim()}
              className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Notes Modal ────────────────────────────── */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>
              Never visible to the client
            </DialogDescription>
          </DialogHeader>

          {/* Add note form */}
          <form onSubmit={addNote} className="space-y-3">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={4}
              placeholder="Add an internal note..."
              className="w-full px-3 py-2.5 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteInput.trim()}
                className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </form>

          {/* Previous notes */}
          {message.notes.length > 0 && (
            <div className="border-t border-border/50 pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Previous notes
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {message.notes
                  .slice()
                  .reverse()
                  .map((n) => (
                    <div key={n.id} className="p-3 neu-concave rounded-xl">
                      <p className="text-sm">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(n.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        &middot;{" "}
                        {new Date(n.created_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
