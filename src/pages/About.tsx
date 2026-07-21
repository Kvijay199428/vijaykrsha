import { site } from "@/config/site";

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-20">
      <h1 className="text-3xl md:text-4xl font-bold text-night-800 dark:text-cream-50 mb-4">
        About Me
      </h1>
      <p className="text-night-800/70 dark:text-cream-100/70 max-w-2xl mb-12">
        Combining legal expertise with technology to deliver precise, efficient, and
        confidential freelance solutions.
      </p>

      <section className="mb-16">
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Qualifications
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {site.qualifications.map((q) => (
            <div
              key={q.degree}
              className="p-6 rounded-2xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
            >
              <p className="text-sm text-glow-500 font-medium mb-1">{q.degree}</p>
              <p className="text-night-800/70 dark:text-cream-100/70 text-sm">{q.institution}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-night-800 dark:text-cream-50 mb-6">
          Areas of Expertise
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {site.expertise.map((e) => (
            <div
              key={e}
              className="flex items-center gap-3 p-4 rounded-xl bg-cream-100 dark:bg-night-800 border border-cream-200 dark:border-night-700"
            >
              <span className="h-2 w-2 rounded-full bg-glow-500 shrink-0" />
              <span className="text-sm text-night-800 dark:text-cream-100">{e}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
