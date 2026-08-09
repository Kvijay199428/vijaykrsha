import { useRef, useState } from "react";
import { site } from "@/config/site";

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
    mobile: "",
    projectType: "Legal Research",
    priority: "standard",
    message: "",
    website: "", // honeypot
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);

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
      body.append("mobile", form.mobile);
      body.append("project_type", form.projectType);
      body.append("priority", form.priority);
      body.append("message", form.message);
      body.append("website", form.website); // honeypot
      for (const file of files) {
        body.append("documents", file, file.name);
      }
      const res = await fetch(`${site.api.baseUrl}${site.api.contactPath}`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Could not send your message. Please try again.");
      }
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      setSent(true);
      setForm({
        name: "",
        email: "",
        mobile: "",
        projectType: "Legal Research",
        priority: "standard",
        message: "",
        website: "",
      });
      setFiles([]);
      setFileWarnings(skipped.length > 0 ? skipped.map((s: { filename?: string; reason?: string }) => {
        const reason = s.reason === "too_large" ? "exceeds the 25MB limit" : "unsupported file type";
        return `${s.filename ?? "A file"} was not delivered (${reason}).`;
      }) : []);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
            <h2 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
              Send a Message
            </h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="Your name"
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
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                    placeholder="Your mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                    Project Type
                  </label>
                  <select
                    value={form.projectType}
                    onChange={(e) => setField("projectType", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors"
                  >
                    <option>Legal Research</option>
                    <option>Contract Drafting</option>
                    <option>Data Analysis</option>
                    <option>Legal-Tech Integration</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Priority
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="standard"
                      checked={form.priority === "standard"}
                      onChange={() => setField("priority", "standard")}
                      className="accent-glow-500"
                    />
                    Standard
                  </label>
                  <label className="flex items-center gap-2 text-sm text-night-800 dark:text-cream-100 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={form.priority === "urgent"}
                      onChange={() => setField("priority", "urgent")}
                      className="accent-glow-500"
                    />
                    Urgent
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Documents <span className="opacity-60">(optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                  className="w-full text-sm text-night-800/70 dark:text-cream-100/70 file:mr-3 file:rounded-xl file:border-0 file:bg-glow-500 file:px-4 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-glow-600"
                />
                <p className="text-xs text-night-800/40 dark:text-cream-100/40 mt-1">
                  PDF, DOC, XLS, or images — up to 25MB each, max {MAX_FILES} files. You can add files in multiple steps.
                </p>
                {fileWarnings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {fileWarnings.map((w) => (
                      <li key={w} className="text-xs text-red-600 dark:text-red-400">
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file, i) => (
                      <li
                        key={`${file.name}-${file.size}-${i}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-xs"
                      >
                        <span className="text-night-800 dark:text-cream-100 truncate flex-1">{file.name}</span>
                        <span className="text-night-800/40 dark:text-cream-100/40">{fmtBytes(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          aria-label={`Remove ${file.name}`}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-night-800/60 dark:text-cream-100/60 mb-1.5">
                  Message
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-cream-50 dark:bg-night-900 border border-cream-200 dark:border-night-600 text-sm text-night-800 dark:text-cream-100 focus:outline-none focus:border-glow-500 transition-colors resize-none"
                  placeholder="Tell me about your project..."
                />
              </div>

              {/* Honeypot — hidden from humans, bots fill it. */}
              <input
                type="text"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {sent && (
                <p className="text-sm text-sage-500">
                  Thank you — your message has been sent. I'll get back to you within 24 hours.
                </p>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary px-6 py-2.5 rounded-xl bg-glow-500 text-white font-medium text-sm hover:bg-glow-600 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
            </form>
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
