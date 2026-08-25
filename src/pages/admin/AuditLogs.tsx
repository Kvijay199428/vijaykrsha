import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";

interface AuditLog {
  id: number;
  event: string;
  actor_admin_id: string;
  ip_address: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jumpValue, setJumpValue] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch(`${ROUTES.ADMINAPIAUDITLOGS}?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);

  function handleJump() {
    const n = parseInt(jumpValue, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      setPage(n);
    }
    setJumpValue("");
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">{total} total entries</p>
      </div>

      <div className="neu-flat overflow-auto flex-1 min-h-0 text-foreground">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-background">
              <tr>
                <th className="text-left p-3 text-sm font-bold text-foreground">Event</th>
                <th className="text-left p-3 text-sm font-bold text-foreground">Actor</th>
                <th className="text-left p-3 text-sm font-bold text-foreground">IP</th>
                <th className="text-left p-3 text-sm font-bold text-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium leading-none inline-flex items-center ${
                      log.event.includes("success") || log.event.includes("verified") ? "bg-green-100 text-green-700" :
                      log.event.includes("failure") || log.event.includes("disabled") ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-700"
                    }`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground font-mono text-xs">
                    {log.actor_admin_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{log.ip_address ?? "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <span className="text-sm text-muted-foreground">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
            onBlur={handleJump}
            placeholder={String(page)}
            className="w-14 px-2 py-1 neu-concave rounded-lg bg-transparent text-foreground text-sm text-center"
          />
          <span className="text-sm text-muted-foreground">of {totalPages}</span>
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
