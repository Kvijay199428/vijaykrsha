import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { apiFetch } from "@/lib/adminApi";
import { MessageSquare, Mail, Clock, CheckCircle, Trash2, ArrowRight, ChevronRight } from "lucide-react";

interface Stats {
  total_messages: number;
  new_messages: number;
  in_progress: number;
  resolved: number;
  trashed_count?: number;
}

interface Message {
  id: string;
  reference: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Message[]>([]);

  useEffect(() => {
    apiFetch(ROUTES.ADMINAPISTATS)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
    apiFetch(`${ROUTES.ADMINAPIMESSAGES}?limit=5`)
      .then((r) => r.json())
      .then((data) => setRecent(data.items ?? []))
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Total Messages", value: stats?.total_messages ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "New", value: stats?.new_messages ?? 0, icon: Mail, color: "text-orange-500" },
    { label: "In Progress", value: stats?.in_progress ?? 0, icon: Clock, color: "text-yellow-500" },
    { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "text-accent" },
    { label: "Trash", value: stats?.trashed_count ?? 0, icon: Trash2, color: "text-red-500" },
  ];

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your admin console</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
        {cards.map((card) => (
          <div key={card.label} className="neu-convex p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="neu-flat flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex items-center justify-between p-6 border-b border-border/50 shrink-0">
          <h2 className="font-semibold">Recent Messages</h2>
          <Link to="/vega/admin/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border/50 overflow-auto flex-1 min-h-0">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            recent.map((msg) => (
              <Link
                key={msg.id}
                to={`/vega/admin/messages/${msg.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{msg.sender_name || "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    msg.status === "new" ? "bg-orange-100 text-orange-700" :
                    msg.status === "in_progress" ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {msg.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
