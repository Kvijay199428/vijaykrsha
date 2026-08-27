import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Search, Trash2, RotateCcw } from "lucide-react";
import { NeuSelect } from "@/components/ui/select";
import DeleteMessageDialog from "@/components/admin/DeleteMessageDialog";
import { SkeletonListRows } from "@/components/ui/skeleton";

interface TrashMessage {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  deleted_at: string;
  trash_expires_at: string;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const exp = new Date(dateStr);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const days = daysUntil(expiresAt);
  if (days <= 0) return <span className="text-xs font-bold text-red-500">Expires today</span>;
  if (days <= 2) return <span className="text-xs font-bold text-red-500">Expires in {days} day{days !== 1 ? "s" : ""}</span>;
  if (days <= 7) return <span className="text-xs text-amber-600">Expires in {days} days</span>;
  return <span className="text-xs text-muted-foreground">Expires in {days} days</span>;
}

export default function Trash() {
  const [messages, setMessages] = useState<TrashMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<TrashMessage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (expiryFilter) params.set("expiry", expiryFilter);
    apiFetch(`${ROUTES.ADMINAPITRASH}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, expiryFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function restoreOne(id: string) {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHRESTORE(id), { method: "POST" });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {}
    setActionLoading(false);
  }

  async function deleteOne(id: string) {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHPERMANENT(id), { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => prev - 1);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch {}
    setActionLoading(false);
    setDeleteTarget(null);
  }

  async function bulkRestore() {
    setActionLoading(true);
    const ids = Array.from(selected);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHBULKRESTORE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
  }

  async function bulkDelete() {
    setActionLoading(true);
    const ids = Array.from(selected);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHBULKDELETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: ids }),
      });
      setMessages((prev) => prev.filter((m) => !selected.has(m.id)));
      setTotal((prev) => prev - ids.length);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
    setBulkDeleteOpen(false);
  }

  async function emptyTrash() {
    setActionLoading(true);
    try {
      await apiFetch(ROUTES.ADMINAPITRASHEMPTY, { method: "POST" });
      setTotal(0);
      setMessages([]);
      setSelected(new Set());
    } catch {}
    setActionLoading(false);
    setEmptyTrashOpen(false);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trash</h1>
            <p className="text-muted-foreground text-sm">
              {total} deleted message{total !== 1 ? "s" : ""}
            </p>
          </div>
          {total > 0 && (
            <button
              onClick={() => setEmptyTrashOpen(true)}
              className="px-3 py-1.5 text-sm neu-btn text-red-500 flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search deleted messages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
          />
        </div>
        <NeuSelect
          value={expiryFilter}
          onChange={(v) => { setExpiryFilter(v); setPage(1); }}
          options={[
            { value: "", label: "All" },
            { value: "7", label: "Expiring within 7 days" },
            { value: "30", label: "Expiring within 30 days" },
          ]}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 neu-convex rounded-xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={bulkRestore}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm neu-btn flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore selected
          </button>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            disabled={actionLoading}
            className="px-3 py-1.5 text-sm neu-btn text-red-500 flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete permanently
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        {loading ? (
          <SkeletonListRows rows={8} />
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Trash is empty.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(msg.id)}
                  onChange={() => toggleSelect(msg.id)}
                  className="h-4 w-4 rounded border-border accent-primary shrink-0"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                    <span className="text-xs text-muted-foreground">({msg.sender_email})</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Deleted {new Date(msg.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <ExpiryBadge expiresAt={msg.trash_expires_at} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreOne(msg.id)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-xs neu-btn flex items-center gap-1"
                    title="Restore to Inbox"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </button>
                  <button
                    onClick={() => setDeleteTarget(msg)}
                    disabled={actionLoading}
                    className="px-2.5 py-1 text-xs neu-btn text-red-500 flex items-center gap-1"
                    title="Delete forever"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 neu-btn text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Single permanent delete dialog */}
      <DeleteMessageDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Permanently delete message?"
        message={`This action cannot be undone. The message, attachments, notes and tags will be permanently removed.`}
        confirmLabel="Delete forever"
        danger
        loading={actionLoading}
        onConfirm={() => deleteTarget && deleteOne(deleteTarget.id)}
      />

      {/* Bulk permanent delete dialog */}
      <DeleteMessageDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Permanently delete selected messages?"
        message={`This will permanently delete ${selected.size} message${selected.size !== 1 ? "s" : ""}. This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        loading={actionLoading}
        onConfirm={bulkDelete}
      />

      {/* Empty trash dialog */}
      <DeleteMessageDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="Empty Trash?"
        message={`This will permanently delete all ${total} message${total !== 1 ? "s" : ""} currently in Trash. This cannot be undone.`}
        confirmLabel="Delete all forever"
        danger
        loading={actionLoading}
        onConfirm={emptyTrash}
      />
    </div>
  );
}
