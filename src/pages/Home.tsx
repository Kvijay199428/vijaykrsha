import { Link } from "react-router-dom";
import { site } from "@/config/site";

function ScaleIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function ChartIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function DiamondIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MagnifierIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function BoltIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`${className} text-glow-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

const highlightIconMap: Record<string, React.FC<{ className?: string }>> = {
  scale: ScaleIcon,
  chart: ChartIcon,
  shield: ShieldIcon,
};

const trustBadgeIconMap: Record<string, React.FC<{ className?: string }>> = {
  calendar: CalendarIcon,
  shield: ShieldIcon,
  diamond: DiamondIcon,
};

const whyHireIconMap: Record<string, React.FC<{ className?: string }>> = {
  shield: ShieldIcon,
  calendar: CalendarIcon,
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function Home() {
  return (
    <div>
      {/* ── Hero ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          <div className="md:col-span-3">
            <p className="text-sm font-medium text-glow-500 mb-4 tracking-wide uppercase">
              {site.tagline}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-night-800 dark:text-cream-50 mb-6 leading-tight">
              {site.name}
            </h1>
            <p className="text-lg text-night-800/70 dark:text-cream-100/70 max-w-xl mb-10 leading-relaxed">
              {site.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/freelance"
                className="btn-primary inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 text-center"
              >
                View Services
              </Link>
              <Link
                to="/contact"
                className="btn-outline inline-block px-6 py-3 rounded-xl border border-cream-300 dark:border-night-600 font-medium hover:bg-cream-200 dark:hover:bg-night-700 text-center"
              >
                Get in Touch
              </Link>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col gap-4">
            {site.trustBadges.map((badge) => {
              const Icon = trustBadgeIconMap[badge.icon] ?? ShieldIcon;
              return (
                <div
                  key={badge.label}
                  className="card-hover flex items-center gap-4 p-5 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium text-night-800 dark:text-cream-100">
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Trust Badges Row (mobile) ─────────────── */}
      <section className="md:hidden max-w-6xl mx-auto px-4 pb-12">
        <div className="flex gap-3 overflow-x-auto">
          {site.trustBadges.map((badge) => {
            const Icon = trustBadgeIconMap[badge.icon] ?? ShieldIcon;
            return (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 shrink-0"
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium text-night-800 dark:text-cream-100 whitespace-nowrap">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Highlights ────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {site.highlights.map((h, i) => {
            const Icon = highlightIconMap[h.icon] ?? ScaleIcon;
            return (
              <div
                key={h.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <Icon />
                <h3 className="mt-4 font-semibold text-night-800 dark:text-cream-50">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60">
                  {h.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Why Hire Me ───────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50">
            Why Hire Me
          </h2>
          <div className="mt-3 h-1 w-12 mx-auto rounded-full bg-glow-500" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon className="h-6 w-6" />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
