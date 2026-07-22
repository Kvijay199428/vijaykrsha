import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Android: "bg-glow-500",
  Web: "bg-mist-500",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  live: { label: "Live", className: "status-live" },
  beta: { label: "Beta", className: "status-beta" },
  "coming-soon": { label: "Coming Soon", className: "status-coming-soon" },
};

function ShareIcon() {
  return (
    <svg
      className="h-7 w-7 text-glow-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      className="h-7 w-7 text-mist-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  share: ShareIcon,
  building: BuildingIcon,
};

export default function Apps() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Apps
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Applications I have developed — from mobile utilities to web management
        tools. Each app solves a specific problem with a clean, focused solution.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.apps.map((app, i) => {
          const Icon = iconMap[app.icon ?? ""] ?? ShareIcon;
          const status = statusConfig[app.status] ?? statusConfig["coming-soon"]!;
          return (
            <div
              key={app.title}
              className="reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <Icon />
                <span
                  className={`h-2 w-2 rounded-full ${categoryColors[app.category] ?? "bg-glow-500"}`}
                />
                <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                  {app.category}
                </span>
                <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>

              {/* Title + Description */}
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
                {app.title}
              </h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4">
                {app.description}
              </p>

              {/* Screenshot Placeholder */}
              <div className="h-36 rounded-xl bg-cream-200 dark:bg-night-700 flex items-center justify-center mb-4 border border-cream-300 dark:border-night-600">
                <span className="text-xs text-night-800/30 dark:text-cream-100/30">
                  Screenshot coming soon
                </span>
              </div>

              {/* Features */}
              <ul className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 space-y-1.5 flex-1">
                {app.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Tech Stack */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-2">
                  Tech Stack
                </p>
                <div className="flex flex-wrap gap-2">
                  {app.techStack.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2.5 py-1 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {app.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <a
                href={app.link.url}
                target={app.link.url !== "#" ? "_blank" : undefined}
                rel={app.link.url !== "#" ? "noopener noreferrer" : undefined}
                className={`inline-block text-center px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  app.link.url !== "#"
                    ? "btn-primary bg-glow-500 text-white hover:bg-glow-600"
                    : "btn-outline border border-cream-300 dark:border-night-600 text-night-800/70 dark:text-cream-100/70 hover:bg-cream-200 dark:hover:bg-night-700"
                }`}
              >
                {app.link.label}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
