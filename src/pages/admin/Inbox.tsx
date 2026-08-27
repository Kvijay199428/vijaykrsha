import { useEffect, useState, useCallback } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Paperclip,
  Trash2,
  Pin,
  Flag,
  Tag,
  MessageSquare,
  Plus,
  X,
  Clock,
  FileText,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import DeleteMessageDialog from "@/components/admin/DeleteMessageDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ── Types ──────────────────────────────────────── */

interface ListMessage {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  created_at: string;
  attachment_count?: number;
  is_pinned: boolean;
  is_flagged: boolean;
}

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

interface DetailMessage {
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
  is_pinned: boolean;
  pinned_at: string | null;
  is_flagged: boolean;
  flagged_at: string | null;
  notes: Note[];
  tags: Tag_[];
  attachments?: Attachment[];
}

/* ── Helpers ─────────────────────────────────────── */

function statusColor(s: string) {
  switch (s) {
    case "new": return "bg-orange-100 text-orange-700";
    case "in_progress": return "bg-yellow-100 text-yellow-700";
    case "resolved": return "bg-green-100 text-green-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

function priorityColor(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

/* ── Skeleton loaders ─────────────────────────────── */

function MessageListSkeleton() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-2 p-3">
          <Skeleton className="h-3.5 w-3.5 rounded shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
            <div className="flex items-center gap-2 mt-1">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="ml-auto h-3 w-16 rounded" />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="shrink-0 neu-flat rounded-xl p-4 space-y-3">
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="shrink-0 neu-flat rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      </div>
      <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
        <Skeleton className="h-3 w-4/6 rounded" />
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────── */

export default function Inbox() {
  /* ── List state ── */
  const [messages, setMessages] = useState<ListMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ── Selection state ── */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  /* ── Tags / Notes ── */
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  /* ── Delete dialogs ── */
  const [deleteTarget, setDeleteTarget] = useState<ListMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  /* ── Mobile: show which pane ── */
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  /* ── Sidebar collapsible cards ── */
  const [tagsOpen, setTagsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [attachmentsOpen, setAttachmentsOpen] = useState(true);

  /* ────────────────────────────────────────────────
     Fetch message list
     ──────────────────────────────────────────────── */

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError("");
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load messages");
        return r.json();
      })
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e) => setListError(e.message || "Failed to load messages"))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ────────────────────────────────────────────────
     Fetch message detail (on select)
     ──────────────────────────────────────────────── */

  const fetchDetail = useCallback((id: string) => {
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load message");
        return r.json();
      })
      .then((data) => setDetail(data))
      .catch((e) => setDetailError(e.message || "Failed to load message"))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    if (activeId) fetchDetail(activeId);
  }, [activeId, fetchDetail]);

  /* ── Select a message ── */

  function selectMessage(id: string) {
    setActiveId(id);
    setMobileView("detail");
  }

  function backToList() {
    setActiveId(null);
    setDetail(null);
    setMobileView("list");
  }

  /* ────────────────────────────────────────────────
     Pin / Flag toggles
     ──────────────────────────────────────────────── */

  async function togglePin(msg: ListMessage) {
    const newVal = !msg.is_pinned;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: newVal } : m))
    );
    try {
      await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: newVal }),
      });
      if (detail?.id === msg.id) setDetail((d) => d ? { ...d, is_pinned: newVal } : d);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: !newVal } : m))
      );
      setActionError("Failed to update pin status");
    }
  }

  async function toggleFlag(msg: ListMessage) {
    const newVal = !msg.is_flagged;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_flagged: newVal } : m))
    );
    try {
      await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_flagged: newVal }),
      });
      if (detail?.id === msg.id) setDetail((d) => d ? { ...d, is_flagged: newVal } : d);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_flagged: !newVal } : m))
      );
      setActionError("Failed to update flag status");
    }
  }

  /* ────────────────────────────────────────────────
     Trash
     ──────────────────────────────────────────────── */

  async function trashOne(id: string) {
    setActionLoading(true);
    setActionError("");
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGETRASH(id), { method: "POST" });
      if (!r.ok) throw new Error("Failed to move to trash");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (activeId === id) backToList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to move to trash");
    }
    setActionLoading(false);
    setDeleteTarget(null);
  }

  async function bulkTrash() {
    setActionLoading(true);
    setActionError("");
    const ids = Array.from(selected);
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGESTRASHBULK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      if (!r.ok) throw new Error("Failed to move messages to trash");
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
      if (activeId && ids.includes(activeId)) backToList();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed to move messages to trash");
    }
    setActionLoading(false);
    setBulkDeleteOpen(false);
  }

  /* ────────────────────────────────────────────────
     Bulk select
     ──────────────────────────────────────────────── */

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === messages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((m) => m.id)));
    }
  }

  /* ────────────────────────────────────────────────
     Tags / Notes (detail pane)
     ──────────────────────────────────────────────── */

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !noteInput.trim()) return;
    try {
      const res = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${activeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteInput }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      const note = await res.json();
      setDetail((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
      setNoteInput("");
    } catch {
      setActionError("Failed to add note");
    }
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !tagInput.trim()) return;
    try {
      const r = await apiFetch(`${ROUTES.ADMINAPIMESSAGES}/${activeId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_name: tagInput }),
      });
      if (!r.ok) throw new Error("Failed to add tag");
      setTagInput("");
      fetchDetail(activeId);
    } catch {
      setActionError("Failed to add tag");
    }
  }

  async function removeTag(tagId: string) {
    if (!activeId) return;
    try {
      const r = await apiFetch(ROUTES.ADMINAPIMESSAGETAGDELETE(activeId, tagId), {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Failed to remove tag");
      fetchDetail(activeId);
    } catch {
      setActionError("Failed to remove tag");
    }
  }

  /* ── Pagination ── */
  const totalPages = Math.ceil(total / 20);

  /* ────────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Error toast ── */}
      {actionError && (
        <div className="shrink-0 mb-2 px-4 py-2 neu-convex rounded-xl flex items-center justify-between text-sm text-red-600">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="p-1 hover:text-red-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Three-pane grid ───────────────────────── */}
      <div
        className="flex-1 min-h-0 hidden md:grid gap-3"
        style={{ gridTemplateColumns: "minmax(260px, 28%) minmax(420px, 1fr) minmax(240px, 25%)" }}
      >
        {/* ── Pane 1: Message List ─────────────────── */}
        <div className="flex flex-col min-h-0 gap-2">
          {/* Header + search */}
          <div className="shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
              />
            </div>
            <NeuSelect
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={[
                { value: "", label: "All Statuses" },
                { value: "new", label: "New" },
                { value: "in_progress", label: "In Progress" },
                { value: "waiting", label: "Waiting" },
                { value: "resolved", label: "Resolved" },
                { value: "spam", label: "Spam" },
              ]}
              className="w-full"
            />
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 neu-convex rounded-xl text-xs">
              <input
                type="checkbox"
                checked={selected.size === messages.length && messages.length > 0}
                onChange={toggleSelectAll}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span className="font-medium">{selected.size}</span>
              <div className="flex-1" />
              <button
                onClick={() => setBulkDeleteOpen(true)}
                disabled={actionLoading}
                className="px-2 py-1 neu-btn text-red-500 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Trash
              </button>
            </div>
          )}

          {/* List */}
          <div className="neu-flat overflow-y-auto flex-1 min-h-0 text-foreground">
            {loading ? (
              <MessageListSkeleton />
            ) : listError ? (
              <div className="p-6 text-center text-xs text-red-500">{listError}</div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No messages.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {messages.map((msg) => {
                  const isActive = msg.id === activeId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 p-3 cursor-pointer transition-colors ${
                        isActive ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => selectMessage(msg.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(msg.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                        className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {msg.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0 fill-primary" />}
                          {msg.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0 fill-red-500" />}
                          <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(msg.status)}`}>
                            {msg.status.replace("_", " ")}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityColor(msg.priority)}`}>
                            {msg.priority}
                          </span>
                          {msg.attachment_count ? (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          ) : null}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(msg.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => togglePin(msg)}
                          className={`p-1 rounded-lg transition-colors ${
                            msg.is_pinned ? "text-primary" : "text-muted-foreground hover:text-primary"
                          }`}
                          title={msg.is_pinned ? "Unpin" : "Pin"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleFlag(msg)}
                          className={`p-1 rounded-lg transition-colors ${
                            msg.is_flagged ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                          }`}
                          title={msg.is_flagged ? "Unflag" : "Flag"}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(msg)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                          title="Move to trash"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 neu-btn text-xs disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 neu-btn text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ── Pane 2: Message Detail ───────────────── */}
        <div className="flex flex-col min-h-0">
          {detailLoading ? (
            <MessageDetailSkeleton />
          ) : detailError ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-500">
              {detailError}
            </div>
          ) : !detail ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a message to view
            </div>
          ) : (
            <div className="flex flex-col min-h-0 gap-3">
              {/* Sender header */}
              <div className="shrink-0 neu-flat rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{detail.sender_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{detail.sender_email}</p>
                    <span className="inline-block mt-1 font-mono text-xs neu-concave px-2 py-0.5 rounded-lg text-muted-foreground">
                      {detail.reference}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => togglePin(detail)}
                      className={`p-1.5 neu-btn rounded-lg transition-colors ${
                        detail.is_pinned ? "text-primary" : "text-muted-foreground"
                      }`}
                      title={detail.is_pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleFlag(detail)}
                      className={`p-1.5 neu-btn rounded-lg transition-colors ${
                        detail.is_flagged ? "text-red-500" : "text-muted-foreground"
                      }`}
                      title={detail.is_flagged ? "Unflag" : "Flag"}
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: detail.id, reference: detail.reference, sender_name: detail.sender_name, sender_email: detail.sender_email, subject: detail.subject, status: detail.status, priority: detail.priority, channel: detail.channel, created_at: detail.created_at, is_pinned: detail.is_pinned, is_flagged: detail.is_flagged })}
                      className="p-1.5 neu-btn rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                      title="Move to trash"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="shrink-0 neu-flat rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Channel</span>
                    <p className="font-medium">{detail.channel}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Received</span>
                    <p className="font-medium">
                      {new Date(detail.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      ,{" "}
                      {new Date(detail.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {detail.sender_phone && (
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Phone</span>
                      <p className="font-medium">{detail.sender_phone}</p>
                    </div>
                  )}
                  {detail.source_page && (
                    <div>
                      <span className="text-muted-foreground block mb-0.5">Source</span>
                      <p className="font-medium truncate" title={detail.source_page}>{detail.source_page}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {detail.body}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Pane 3: Sidebar ────────────────── */}
        <div className="flex flex-col min-h-0 h-full gap-3">
          {detail ? (
            <>
              {/* Tags card */}
              <div className="shrink-0">
                <div className="w-full flex items-center justify-between p-4">
                  <button
                    type="button"
                    onClick={() => setTagsOpen(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <Tag className="h-4 w-4 text-primary" /> Tags
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${tagsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button onClick={() => setShowTagModal(true)} className="p-1.5 neu-btn rounded-lg shrink-0" title="Manage tags">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {tagsOpen && (
                  <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                    <div className="px-4 py-3">
                      {detail.tags.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No tags yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.tags.map((t) => (
                            <span key={t.id} className="px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes card */}
              <div className="shrink-0">
                <div className="shrink-0 w-full flex items-center justify-between p-4">
                  <button
                    type="button"
                    onClick={() => setNotesOpen(v => !v)}
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <MessageSquare className="h-4 w-4 text-primary" /> Notes
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${notesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <button onClick={() => setShowNoteModal(true)} className="p-1.5 neu-btn rounded-lg shrink-0" title="Add note">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {notesOpen && (
                  <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                    <div className="px-4 py-3">
                      {detail.notes.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No notes yet</p>
                      ) : (
                        <div className="space-y-2.5">
                          {detail.notes.slice().reverse().slice(0, 5).map((n) => (
                            <div key={n.id} className="p-2.5 neu-concave rounded-xl">
                              <p className="text-xs leading-relaxed">{n.body}</p>
                              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot;{" "}
                                {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          ))}
                          {detail.notes.length > 5 && (
                            <button
                              onClick={() => setShowNoteModal(true)}
                              className="text-xs text-primary hover:underline w-full text-center py-1"
                            >
                              View all {detail.notes.length} notes
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Attachments card */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="shrink-0">
                  <div className="shrink-0 w-full flex items-center justify-between p-4">
                    <button
                      type="button"
                      onClick={() => setAttachmentsOpen(v => !v)}
                      className="flex items-center gap-2 text-sm font-semibold"
                    >
                      <Paperclip className="h-4 w-4 text-primary" /> Attachments · {detail.attachments.length}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${attachmentsOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {attachmentsOpen && (
                    <div className="neu-flat rounded-xl overflow-hidden shrink-0 mx-2 mb-2">
                      <div className="px-4 py-3">
                        <div className="space-y-2">
                          {detail.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api${att.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 py-2.5 neu-concave rounded-xl text-sm hover:bg-muted/30 transition-colors"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1 min-w-0">{att.filename}</span>
                              {typeof att.size === "number" && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {att.size >= 1048576 ? `${(att.size / 1048576).toFixed(1)} MB` : `${(att.size / 1024).toFixed(1)} KB`}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a message
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: stacked view ──────────────────── */}
      <div className="md:hidden flex flex-col h-full min-h-0">
        {mobileView === "list" ? (
          /* Mobile list */
          <div className="flex flex-col gap-2 h-full min-h-0">
            <div className="shrink-0">
              <h1 className="text-lg font-bold">Inbox</h1>
              <p className="text-muted-foreground text-xs">{total} messages</p>
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
              />
            </div>
            {selected.size > 0 && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 neu-convex rounded-xl text-xs">
                <span className="font-medium">{selected.size} selected</span>
                <div className="flex-1" />
                <button onClick={() => setBulkDeleteOpen(true)} disabled={actionLoading} className="px-2 py-1 neu-btn text-red-500 flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Trash
                </button>
              </div>
            )}
            <div className="neu-flat overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <MessageListSkeleton />
              ) : messages.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No messages.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2 p-3 hover:bg-muted/30 transition-colors" onClick={() => selectMessage(msg.id)}>
                      <input
                        type="checkbox"
                        checked={selected.has(msg.id)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                        className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {msg.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0 fill-primary" />}
                          {msg.is_flagged && <Flag className="h-3 w-3 text-red-500 shrink-0 fill-red-500" />}
                          <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(msg.status)}`}>
                            {msg.status.replace("_", " ")}
                          </span>
                          {msg.attachment_count ? <Paperclip className="h-3 w-3 text-muted-foreground" /> : null}
                          <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {totalPages > 1 && (
              <div className="shrink-0 flex items-center justify-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 neu-btn text-xs disabled:opacity-50">Prev</button>
                <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 neu-btn text-xs disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        ) : (
          /* Mobile detail */
          <div className="flex flex-col gap-3 h-full min-h-0">
            <button onClick={backToList} className="shrink-0 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to inbox
            </button>
            {detailLoading ? (
              <MessageDetailSkeleton />
            ) : detailError ? (
              <div className="flex-1 flex items-center justify-center text-sm text-red-500">{detailError}</div>
            ) : detail ? (
              <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto">
                <div>
                  <h2 className="text-lg font-bold">{detail.subject}</h2>
                  <p className="text-sm text-muted-foreground">{detail.sender_name} &middot; {detail.sender_email}</p>
                </div>
                <div className="neu-flat rounded-xl p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.body}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Modals & Dialogs ───────────────────────── */}

      {/* Tag modal */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>Organize this message for easier filtering</DialogDescription>
          </DialogHeader>
          {detail && detail.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Current tags</p>
              <div className="flex flex-wrap gap-2">
                {detail.tags.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full">
                    {t.name}
                    <button onClick={() => removeTag(t.id)} className="hover:text-destructive transition-colors" title={`Remove "${t.name}"`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={addTag} className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="submit" disabled={!tagInput.trim()} className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50">
              Add
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Note modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>Never visible to the client</DialogDescription>
          </DialogHeader>
          <form onSubmit={addNote} className="space-y-3">
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={4}
              placeholder="Add an internal note..."
              className="w-full px-3 py-2.5 neu-concave rounded-xl bg-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex justify-end">
              <button type="submit" disabled={!noteInput.trim()} className="px-4 py-2 neu-btn text-sm font-medium disabled:opacity-50">
                Add Note
              </button>
            </div>
          </form>
          {detail && detail.notes.length > 0 && (
            <div className="border-t border-border/50 pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Previous notes</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {detail.notes.slice().reverse().map((n) => (
                  <div key={n.id} className="p-3 neu-concave rounded-xl">
                    <p className="text-sm">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} &middot;{" "}
                      {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single trash dialog */}
      <DeleteMessageDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Move to Trash?"
        message="This message will be moved to Trash and permanently deleted after the retention period."
        confirmLabel="Move to Trash"
        loading={actionLoading}
        onConfirm={() => deleteTarget && trashOne(deleteTarget.id)}
      />

      {/* Bulk trash dialog */}
      <DeleteMessageDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Move selected to Trash?"
        message={`This will move ${selected.size} message${selected.size !== 1 ? "s" : ""} to Trash.`}
        confirmLabel="Move to Trash"
        loading={actionLoading}
        onConfirm={bulkTrash}
      />
    </div>
  );
}
