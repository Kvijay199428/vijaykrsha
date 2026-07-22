import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Legal: "bg-sage-500",
  Tech: "bg-mist-500",
};

const categoryBorderColors: Record<string, string> = {
  Legal: "border-l-sage-500",
  Tech: "border-l-mist-500",
};

export default function Portfolio() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Portfolio
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Selected projects across legal research and technology. Each project follows
        a structured approach: understand the problem, design the solution, deliver measurable outcomes.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.projects.map((p, i) => (
          <div
            key={p.title}
            className={`reveal p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 border-l-4 ${categoryBorderColors[p.category] ?? "border-l-glow-500"} flex flex-col`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`h-2 w-2 rounded-full ${categoryColors[p.category] ?? "bg-glow-500"}`}
              />
              <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                {p.category}
              </span>
            </div>

            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-4">
              {p.title}
            </h3>

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Problem
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.problem}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Solution
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.solution}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-night-800/40 dark:text-cream-100/40 mb-1">
                  Outcome
                </p>
                <p className="text-sm text-night-800/70 dark:text-cream-100/70 leading-relaxed">
                  {p.outcome}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-cream-200 dark:border-night-700">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full bg-cream-200 dark:bg-night-700 text-night-800/70 dark:text-cream-100/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
