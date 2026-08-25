import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { Search, Paperclip, ChevronRight } from "lucide-react";

interface Message {
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
}

export default function Inbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-muted-foreground text-sm">{total} total messages</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search messages..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 neu-concave rounded-xl bg-transparent text-foreground text-sm"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="resolved">Resolved</option>
          <option value="spam">Spam</option>
        </select>
      </div>

      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No messages found.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {messages.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                    <span className="text-xs text-muted-foreground">({msg.sender_email})</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{msg.subject}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {msg.attachment_count ? (
                    <span className="text-muted-foreground" title="Has attachments">
                      <Paperclip className="w-3.5 h-3.5" />
                    </span>
                  ) : null}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    msg.status === "new" ? "bg-orange-100 text-orange-700" :
                    msg.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    msg.status === "resolved" ? "bg-green-100 text-green-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {msg.status.replace("_", " ")}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    msg.priority === "urgent" ? "bg-red-100 text-red-700" :
                    msg.priority === "high" ? "bg-orange-100 text-orange-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {msg.priority}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
