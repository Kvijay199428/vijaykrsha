import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-7 w-7 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const iconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

export default function Freelance() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Freelance Services
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Professional legal and tech services tailored to your needs. Each engagement
        starts with a clear scope, transparent pricing, and strict confidentiality.
      </p>

      {/* ── Services ────────────────────────────── */}
      <section className="mb-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = iconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>

                <div className="mt-5 pt-4 border-t border-cream-200 dark:border-night-700 space-y-3 flex-1">
                  {/* Ideal For */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Ideal For
                    </p>
                    <ul className="space-y-1">
                      {s.idealFor.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-night-800/50 dark:text-cream-100/50 mb-1.5">
                      Deliverables
                    </p>
                    <ul className="space-y-1">
                      {s.deliverables.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-night-800/70 dark:text-cream-100/70">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-glow-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Turnaround + Pricing */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <span className="text-xs px-3 py-1.5 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70 font-medium">
                      {s.turnaround}
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium">
                      {s.pricingModel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Working Principles ──────────────────── */}
      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Working Principles
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <h3 className="font-semibold text-glow-500 mb-2">{p.title}</h3>
              <p className="text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
