import { site } from "@/config/site";

function ScaleIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-6 w-6 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function MagnifierIcon() {
  return (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

const serviceIconMap: Record<string, React.FC> = {
  scale: ScaleIcon,
  document: DocumentIcon,
  chart: ChartIcon,
  gear: GearIcon,
};

const whyHireIconMap: Record<string, React.FC> = {
  shield: ShieldIcon,
  calendar: () => (
    <svg className="h-5 w-5 text-glow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  diamond: DiamondIcon,
  magnifier: MagnifierIcon,
  bolt: BoltIcon,
};

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      {/* ── Section 1: Who I Am ──────────────────── */}
      <section className="mb-16 reveal">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Who I Am
        </h2>
        <div className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700">
          <div className="flex items-start gap-5">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-glow-500/10 border border-glow-500/20">
              <span className="text-2xl font-bold text-glow-600 dark:text-glow-400">VK</span>
            </div>
            <div>
              <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-1">
                {site.name}
              </h3>
              <p className="text-sm text-glow-500 font-medium mb-3">
                {site.tagline}
              </p>
              <p className="text-night-800 dark:text-cream-100 leading-relaxed">
                {site.description}
              </p>
              <p className="text-night-800/60 dark:text-cream-100/60 leading-relaxed mt-3 text-sm">
                My legal work includes research, drafting, document review, and legal support
                across various practice areas. During my legal journey, I have worked on matters
                relating to Family Law, Criminal Law, the Negotiable Instruments Act, Contract
                Law, Consumer Law, Constitutional Law, and other civil and commercial legal
                matters. Alongside legal practice, I use technology and data-driven workflows
                to improve accuracy, organization, and efficiency while maintaining complete
                confidentiality for every engagement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: What I Do ─────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          What I Do
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.services.map((s, i) => {
            const Icon = serviceIconMap[s.icon] ?? ScaleIcon;
            return (
              <div
                key={s.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
                <h3 className="mt-3 font-semibold text-night-800 dark:text-cream-50">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-night-800/60 dark:text-cream-100/60 leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 3: How I Work ────────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          How I Work
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.principles.map((p, i) => (
            <div
              key={p.title}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
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

      {/* ── Section 4: Why Clients Choose to Work With Me ───────────────── */}
      <section className="mb-16">
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Why Clients Choose to Work With Me
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.whyHireMe.map((item, i) => {
            const Icon = whyHireIconMap[item.icon] ?? ShieldIcon;
            return (
              <div
                key={item.title}
                className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Icon />
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

      {/* ── Section 5: Education & Credentials ───── */}
      <section>
        <h2 className="text-2xl md:text-3xl font-bold text-night-800 dark:text-cream-50 mb-6">
          Education & Credentials
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {site.qualifications.map((q, i) => (
            <div
              key={q.degree}
              className="reveal card-hover p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="text-sm text-glow-500 font-medium mb-1">{q.degree}</p>
              <p className="text-night-800/70 dark:text-cream-100/70 text-sm">{q.institution}</p>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-night-800 dark:text-cream-50 mb-4">
          Areas of Practice
        </h3>
        <div className="flex flex-wrap gap-3">
          {site.expertise.map((e) => (
            <span
              key={e}
              className="text-sm px-4 py-2 rounded-full bg-glow-500/10 border border-glow-500/20 text-glow-600 dark:text-glow-400 font-medium"
            >
              {e}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
