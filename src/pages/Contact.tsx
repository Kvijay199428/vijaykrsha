import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import { ROUTES } from "@/lib/routes";
import {
  CONTACT_SITE_KEY,
  loadTurnstile,
  removeTurnstile,
  renderTurnstile,
  resetTurnstile,
} from "@/lib/turnstile";

/** FastAPI errors: {"detail": "msg"} or {"detail": [{msg}, ...]} on 422. */
function apiErrorMessage(data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string } | undefined;
    return first?.msg ?? "Invalid submission.";
  }
  return "";
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="checklist-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <div
      className="contact-success-icon mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-sage-500/25 bg-sage-500/10"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-10 w-10 text-sage-500"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="contact-success-check" d="M5 12.5l4.25 4.25L19 7" />
      </svg>
    </div>
  );
}

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
  "png", "jpg", "jpeg", "gif", "webp",
];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Contact() {
  const { contact, workingStyle, beforeContacting } = site;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: "Legal Research",
    priority: "standard",
    message: "",
    honeypot: "", // bots fill this; humans never see it
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Nesting: dragenter/dragleave fire again for every child the pointer
  // crosses (icon, text, the hidden input). A plain boolean flickers as the
  // highlight drops and re-adds on each boundary, so we count entries and
  // only clear the visual state once the pointer has left the zone entirely.
  const dragDepthRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  // How many attached files the backend rejected on the last successful
  // submit — used to report delivered attachments accurately on the success
  // panel (a selected file is not proof the server stored it).
  const [lastSkipped, setLastSkipped] = useState(0);

  // ── Cloudflare Turnstile ──────────────────────────────────────────
  // The user must actively pass the challenge: the submit button stays
  // disabled until the callback hands us a token, and the backend re-verifies
  // it fail-closed. Widget mode is authoritative in the Cloudflare dashboard
  // (Mode = Managed), so `managed` + `always` below request a visible
  // checkbox rather than a passive auto-pass badge.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCaptchaToken(null);
    setCaptchaError(false);

    const renderWidget = () => {
      const container = turnstileRef.current;
      if (cancelled || !container) return;
      try {
        removeTurnstile(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
        // A remount (React strict mode double-invoke, or navigating back to
        // this page) leaves the old challenge in the node; clear it so we do
        // not stack two widgets in one container.
        container.replaceChildren();
        const widgetId = window.turnstile
          ? renderTurnstile(
              container,
              (token) => setCaptchaToken(token),
              () => setCaptchaToken(null),
              () => setCaptchaError(true),
              {
                action: "contact_form",
                siteKey: CONTACT_SITE_KEY,
                // Force an explicit human check instead of auto-verifying.
                mode: "managed",
                appearance: "always",
              }
            )
          : null;
        if (!widgetId) {
          setCaptchaError(true);
          return;
        }
        turnstileWidgetId.current = widgetId;
      } catch (err) {
        console.error("[Turnstile] render failed:", err);
        setCaptchaError(true);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      loadTurnstile()
        .then(() => {
          if (!cancelled) renderWidget();
        })
        .catch((error) => {
          console.error("[Turnstile] init failed:", error);
          if (!cancelled) setCaptchaError(true);
        });
    }

    return () => {
      cancelled = true;
      removeTurnstile(turnstileWidgetId.current);
      turnstileWidgetId.current = null;
    };
  }, []);

  // A file dropped anywhere except the dropzone otherwise makes the browser
  // navigate to (open) that file, which looks like the page broke. Swallow the
  // default drag/drop behaviour document-wide; the dropzone runs its own
  // handler and stops propagation before this matters.
  useEffect(() => {
    const blockDrag = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", blockDrag);
    window.addEventListener("drop", blockDrag);
    return () => {
      window.removeEventListener("dragover", blockDrag);
      window.removeEventListener("drop", blockDrag);
    };
  }, []);

  const setField = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addFiles = (incoming: File[]) => {
    const warnings: string[] = [];
    const next: File[] = [...files];
    for (const file of incoming) {
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        warnings.push(`${file.name} — unsupported file type. Use PDF, DOC, XLS, TXT, or an image.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        warnings.push(`${file.name} — exceeds the 25MB limit.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      if (next.length >= MAX_FILES) {
        warnings.push(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
    setFileWarnings(warnings);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileWarnings([]);
  };

  // Only react to actual file drags — dragging selected text or a link over
  // the zone should not arm the drop highlight.
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const handleDragEnter = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    // preventDefault here is what marks the zone as a valid drop target; drop
    // never fires without it.
    if (!dragHasFiles(e)) return;
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    // Route dropped files through the same validator the file picker uses, so
    // type/size/dedupe/max-file rules and their warning messages stay identical.
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setFileWarnings([]);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("email", form.email);
      body.append("phone", form.phone);
      body.append("project_type", form.projectType);
      body.append("priority", form.priority);
      body.append("message", form.message);
      body.append("honeypot", form.honeypot);
      body.append("turnstile_token", captchaToken ?? "");
      for (const file of files) {
        body.append("documents", file, file.name);
      }
      const res = await fetch(ROUTES.CONTACT, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      // A successful FastAPI response is the created record itself — only
      // treat it as a failure when the HTTP status or the body says so.
      if (!res.ok || data?.ok === false) {
        throw new Error(
          apiErrorMessage(data) ||
          "Could not send your message. Please try again."
        );
      }
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      setSent(true);
      setLastSkipped(skipped.length);
      // Turnstile tokens are single-use — burn the widget and demand a fresh
      // one before the form can be submitted again. Form values, files and the
      // file input are intentionally kept populated so the success panel can
      // reference them; handleNewMessage clears everything instead.
      setCaptchaToken(null);
      resetTurnstile(turnstileWidgetId.current);
      setFileWarnings(skipped.length > 0 ? skipped.map((s: { filename?: string; reason?: string }) => {
        const reasons: Record<string, string> = {
          too_large: "exceeds the 25MB limit",
          unsupported_type: "unsupported file type",
          too_many_files: `more than ${MAX_FILES} files`,
          empty_file: "empty file",
          upload_failed: "could not be stored",
        };
        const reason = reasons[s.reason ?? ""] ?? "was rejected";
        return `${s.filename ?? "A file"} was not delivered (${reason}).`;
      }) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Reset everything and start a fresh submission (used by the success
   *  panel's "Send another message"). Form values, files and the Turnstile
   *  token are all single-use per submission. */
  const handleNewMessage = () => {
    setSent(false);
    setError("");
    setFileWarnings([]);
    setLastSkipped(0);
    setForm({
      name: "",
      email: "",
      phone: "",
      projectType: "Legal Research",
      priority: "standard",
      message: "",
      honeypot: "",
    });
    setFiles([]);
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCaptchaToken(null);
    resetTurnstile(turnstileWidgetId.current);
  };

  // Attachments the server actually stored on the last submit — a selected
  // file that the backend rejected must not be reported as delivered.
  const submittedAttachmentCount = Math.max(0, files.length - lastSkipped);

  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Contact
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Ready to start a project? Reach out through any of the channels below.
        I typically respond within 24 hours.
      </p>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* ── Left Column (3 cols) ──────────────── */}
        <div className="lg:col-span-3 space-y-8">
          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <PhoneIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">WhatsApp</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.phone}</p>
              </div>
            </a>

            <a
              href={`mailto:${contact.email}`}
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <MailIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Email</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.email}</p>
              </div>
            </a>

            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
            >
              <GlobeIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Website</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.website}</p>
              </div>
            </a>

            <div className="card-hover flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
              <MapPinIcon />
              <div>
                <p className="text-xs text-night-800/50 dark:text-cream-100/50">Location</p>
                <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.location}</p>
              </div>
            </div>
          </div>

          {/* Before You Contact */}
          <div className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
              Before You Contact
            </h2>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
              Having these ready helps us scope your project faster and give you a more accurate quote.
            </p>
            <ul className="space-y-3">
              {beforeContacting.map((item) => (
                <li key={item} className="checklist-item">
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Form */}
          <div
            className={`reveal overflow-hidden rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 contact-form-stage ${
              sent ? "is-sent" : ""
            }`}
          >
            {/* ── Form panel ─────────────────────────────── */}
            <div className="contact-form-panel p-6 md:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50">
                    Send a Message
                  </h2>
                  <p className="mt-1 text-sm text-night-800/55 dark:text-cream-100/55">
                    Tell me what you need help with and I'll get back to you.
                  </p>
                </div>
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-glow-500/10 text-glow-500 sm:flex">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75l-9.75 6-9.75-6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75v10.5A2.25 2.25 0 005.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75" />
                  </svg>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {/* Name + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Mobile + Project */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setField("phone", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                      placeholder="Your mobile number"
                      autoComplete="tel"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                      Project Type
                    </label>
                    <select
                      value={form.projectType}
                      onChange={(e) => setField("projectType", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200"
                    >
                      <option>Legal Research</option>
                      <option>Contract Drafting</option>
                      <option>Data Analysis</option>
                      <option>Legal-Tech Integration</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-2">
                    Priority
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["standard", "Standard", "Normal response"],
                        ["urgent", "Urgent", "Needs faster attention"],
                      ] as Array<[string, string, string]>
                    ).map(([value, title, description]) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-xl border px-4 py-3 transition-all duration-200 ${
                          form.priority === value
                            ? "border-glow-500 bg-glow-500/8 shadow-sm"
                            : "border-cream-200 dark:border-night-600 hover:border-glow-500/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={value}
                          checked={form.priority === value}
                          onChange={() => setField("priority", value)}
                          className="sr-only"
                        />
                        <span className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              form.priority === value
                                ? "border-glow-500"
                                : "border-night-800/25 dark:border-cream-100/25"
                            }`}
                          >
                            {form.priority === value && (
                              <span className="h-2 w-2 rounded-full bg-glow-500" />
                            )}
                          </span>
                          <span>
                            <span className="block text-sm font-medium text-night-800 dark:text-cream-100">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-xs text-night-800/45 dark:text-cream-100/45">
                              {description}
                            </span>
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Documents <span className="opacity-60">(optional)</span>
                  </label>
                  <label
                    htmlFor="contact-documents"
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border px-5 py-6 text-center transition-all duration-200 ${
                      isDragging
                        ? "border-glow-500 bg-glow-500/10 ring-2 ring-glow-500/20"
                        : "border-dashed border-cream-300 dark:border-night-600 bg-cream-50/70 dark:bg-night-900/60 hover:border-glow-500/60 hover:bg-glow-500/5"
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-glow-500/10 text-glow-500 transition-transform duration-200 group-hover:scale-105">
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3.75m0 0L7.5 8.25M12 3.75l4.5 4.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 13.5v4.125A2.625 2.625 0 007.875 20.25h8.25a2.625 2.625 0 002.625-2.625V13.5" />
                      </svg>
                    </span>
                    <span className="mt-3 text-sm font-medium text-night-800 dark:text-cream-100">
                      {isDragging ? "Drop files here" : "Add documents"}
                    </span>
                    <span className="mt-1 text-xs text-night-800/45 dark:text-cream-100/45">
                      {isDragging
                        ? `Release to attach · up to 25MB each, max ${MAX_FILES} files`
                        : `PDF, DOC, XLS, TXT or images · drag & drop or click · up to 25MB each, max ${MAX_FILES} files`}
                    </span>
                    <input
                      id="contact-documents"
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) addFiles(Array.from(e.target.files));
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                  {fileWarnings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {fileWarnings.map((warning) => (
                        <li
                          key={warning}
                          className="contact-message text-xs text-red-600 dark:text-red-400"
                        >
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                  {files.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {files.map((file, i) => (
                        <li
                          key={`${file.name}-${file.size}-${i}`}
                          className="contact-file-row flex items-center gap-3 px-3 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-xs"
                          style={{ animationDelay: `${i * 45}ms` }}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-glow-500/10 text-glow-500">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.7}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25H6.75A2.25 2.25 0 004.5 4.5v15A2.25 2.25 0 006.75 21.75h10.5a2.25 2.25 0 002.25-2.25V7.5l-5.25-5.25z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25V7.5h5.25" />
                            </svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-night-800 dark:text-cream-100">
                              {file.name}
                            </span>
                            <span className="mt-0.5 block text-night-800/40 dark:text-cream-100/40">
                              {fmtBytes(file.size)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            aria-label={`Remove ${file.name}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-night-800/40 dark:text-cream-100/40 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => setField("message", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 placeholder:text-night-800/35 dark:placeholder:text-cream-100/35 focus:outline-none focus:ring-2 focus:ring-glow-500/15 focus:border-glow-500 transition-all duration-200 resize-none"
                    placeholder="Tell me about your project..."
                  />
                </div>

                {/* Honeypot — hidden from humans, bots fill it. */}
                <input
                  type="text"
                  value={form.honeypot}
                  onChange={(e) => setField("honeypot", e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* Human verification — must be passed before submitting. Not a <label>:
                  Turnstile renders inside a cross-origin iframe that carries its
                  own accessible name, so there is no control here to label. */}
                <div>
                  <p className="text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Verify you are human
                  </p>
                  <div ref={turnstileRef} />
                  {captchaError && (
                    <p className="contact-message text-xs text-red-600 dark:text-red-400 mt-1.5">
                      Could not load the security check. Please refresh the page and
                      try again.
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="contact-message rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !captchaToken || captchaError}
                  className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl bg-glow-500 px-6 py-3 text-sm font-medium text-white hover:bg-glow-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="contact-submit-spinner" aria-hidden="true" />
                      <span>Sending message…</span>
                    </>
                  ) : !captchaToken && !captchaError ? (
                    "Verify you are human to send"
                  ) : (
                    <>
                      <span>Send Message</span>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 3.75L10.5 14.25" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 3.75l-4.5 16.5-6.75-6-6-6.75 17.25-3.75z" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* ── Success panel ────────────────────────────── */}
            <div
              className="contact-success-panel flex items-center justify-center p-6 md:p-10"
              role="status"
              aria-live="polite"
            >
              <div className="w-full max-w-md text-center">
                <SuccessIcon />

                <div className="mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sage-500">
                    Message sent
                  </p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50">
                    Thank you{form.name ? `, ${form.name}` : ""}.
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-night-800/60 dark:text-cream-100/60">
                    Your message has been received successfully. I'll review your request
                    and get back to you within 24 hours.
                  </p>
                </div>

                <div className="mx-auto mt-8 max-w-sm overflow-hidden rounded-2xl border border-cream-200 dark:border-night-600 bg-cream-50/70 dark:bg-night-900/60 text-left">
                  <div className="border-b border-cream-200 dark:border-night-600 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40">
                      Submission received
                    </p>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        Your details were submitted
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        {submittedAttachmentCount > 0
                          ? `${submittedAttachmentCount} attachment${submittedAttachmentCount === 1 ? "" : "s"} received`
                          : "No attachments were included"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-500/10 text-sage-500">
                        ✓
                      </span>
                      <span className="text-sm text-night-800 dark:text-cream-100">
                        You'll receive a response within 24 hours
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNewMessage}
                  className="btn-outline mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-cream-300 dark:border-night-600 px-5 py-2.5 text-sm font-medium text-night-800 dark:text-cream-100 hover:bg-cream-200 dark:hover:bg-night-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 101.98-5.1" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5v5h5" />
                  </svg>
                  Send another message
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column (2 cols) ─────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Response Time */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <div className="flex items-center gap-3 mb-3">
              <ClockIcon />
              <h3 className="font-semibold text-night-800 dark:text-cream-50">
                Response Time
              </h3>
            </div>
            <p className="text-2xl font-bold text-glow-600 dark:text-glow-400 mb-1">
              {workingStyle.responseTime}
            </p>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60">
              I check messages regularly and aim to get back to you within one business day.
            </p>
          </div>

          {/* Working Style */}
          <div className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              Working Style
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Availability
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.availability}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Communication
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.communication}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-0.5">
                  Timezone
                </p>
                <p className="text-sm text-night-800 dark:text-cream-100">{workingStyle.timezone}</p>
              </div>
            </div>
          </div>

          {/* Confidentiality */}
          <div className="reveal card-hover p-6 rounded-2xl bg-glow-500/10 border border-glow-500/30">
            <p className="text-sm text-night-800 dark:text-cream-100">
              <strong className="text-glow-600 dark:text-glow-400">Confidentiality guaranteed.</strong>{" "}
              All communications and project details are handled under strict NDA. Your privacy is paramount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
