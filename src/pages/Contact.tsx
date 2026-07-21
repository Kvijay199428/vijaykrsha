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

export default function Contact() {
  const { contact } = site;
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Contact
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Ready to start a project? Reach out through any of the channels below.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 max-w-xl">
        <a
          href={`tel:${contact.phone}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <PhoneIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Phone</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.phone}</p>
          </div>
        </a>

        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <MailIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Email</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.email}</p>
          </div>
        </a>

        <a
          href={`mailto:${contact.emailAlt}`}
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <MailIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Alt Email</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.emailAlt}</p>
          </div>
        </a>

        <a
          href={contact.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 hover:border-glow-500 transition-colors"
        >
          <GlobeIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Website</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.website}</p>
          </div>
        </a>

        <div className="flex items-center gap-3 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 sm:col-span-2">
          <MapPinIcon />
          <div>
            <p className="text-xs text-night-800/50 dark:text-cream-100/50">Location</p>
            <p className="text-sm font-medium text-night-800 dark:text-cream-50">{contact.location}</p>
          </div>
        </div>
      </div>

      <div className="mt-10 p-5 rounded-2xl bg-glow-500/10 border border-glow-500/30 max-w-xl">
        <p className="text-sm text-night-800 dark:text-cream-100">
          <strong className="text-glow-600 dark:text-glow-400">Confidentiality guaranteed.</strong>{" "}
          All communications and project details are handled under strict NDA. Your privacy is paramount.
        </p>
      </div>
    </div>
  );
}
