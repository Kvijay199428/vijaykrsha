import { site } from "@/config/site";

const categoryColors: Record<string, string> = {
  Legal: "bg-sage-500",
  Tech: "bg-mist-500",
};

export default function Portfolio() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        Portfolio
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Selected projects across legal research and technology.
      </p>

      <div className="grid sm:grid-cols-2 gap-6">
        {site.projects.map((p) => (
          <div
            key={p.title}
            className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`h-2 w-2 rounded-full ${categoryColors[p.category] ?? "bg-glow-500"}`}
              />
              <span className="text-xs font-medium text-night-800/50 dark:text-cream-100/50 uppercase tracking-wide">
                {p.category}
              </span>
            </div>
            <h3 className="font-semibold text-night-800 dark:text-cream-50 mb-2">
              {p.title}
            </h3>
            <p className="text-sm text-night-800/60 dark:text-cream-100/60 mb-4 flex-1">
              {p.description}
            </p>
            <div className="flex flex-wrap gap-2">
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
