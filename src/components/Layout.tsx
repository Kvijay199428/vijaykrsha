import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { site } from "@/config/site";
import { useState, useEffect, useRef } from "react";
import AnimatedLogo from "./AnimatedLogo";

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Back to top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [location.pathname]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-cream-50/80 dark:bg-night-900/80 backdrop-blur-md border-b border-cream-200 dark:border-night-700">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-glow-600 dark:text-glow-400">
            <span className="typing-text">VIJAYKRSHA.ONLINE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link text-sm font-medium rounded-lg px-3 py-1.5 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70 hover:text-night-800 dark:hover:text-cream-100 hover:bg-cream-200/50 dark:hover:bg-night-700/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg hover:bg-cream-200 dark:hover:bg-night-700 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-cream-200 dark:border-night-700 bg-cream-50 dark:bg-night-900 px-4 pb-4">
            {site.nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`nav-link block py-3 text-sm font-medium rounded-lg px-3 ${
                  location.pathname === item.path
                    ? "text-glow-600 dark:text-glow-400 bg-glow-500/10 dark:bg-glow-400/10"
                    : "text-night-800/70 dark:text-cream-100/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main ref={mainRef} className="flex-1 pb-12">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="border-t border-cream-200 dark:border-night-700 bg-cream-100 dark:bg-night-800">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Centered Logo + Tagline */}
          <div className="flex flex-col items-center mb-10">
            <AnimatedLogo className="mb-4" />
            <p className="font-bold text-lg text-glow-600 dark:text-glow-400 mb-1">
              {site.name}
            </p>
            <p className="text-sm text-night-800/50 dark:text-cream-100/50">
              Legal Research &bull; Contract Drafting &bull; Legal Technology
            </p>
          </div>

          {/* 4-Column Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Col 1: Quick Links */}
            <div>
              <p className="footer-heading">Quick Links</p>
              <ul className="space-y-2">
                {site.nav.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2: Services */}
            <div>
              <p className="footer-heading">Services</p>
              <ul className="space-y-2">
                {site.services.map((s) => (
                  <li key={s.title}>
                    <Link
                      to="/freelance"
                      className="text-sm text-night-800/60 dark:text-cream-100/60 hover:text-glow-500 dark:hover:text-glow-400 transition-colors"
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3: Contact */}
            <div>
              <p className="footer-heading">Contact</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li>{site.contact.phone}</li>
                <li>{site.contact.email}</li>
                <li>{site.contact.location}</li>
              </ul>
            </div>

            {/* Col 4: Trust */}
            <div>
              <p className="footer-heading">Trust</p>
              <ul className="space-y-2 text-sm text-night-800/60 dark:text-cream-100/60">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  NDA by Default
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  3+ Years Experience
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-glow-500 shrink-0" />
                  Remote Collaboration
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-cream-200 dark:border-night-700 pt-6 text-center text-sm text-night-800/50 dark:text-cream-100/50">
            <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Back to Top ─────────────────────────── */}
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`back-to-top fixed bottom-6 right-6 z-50 p-3 rounded-full bg-glow-500 text-white shadow-lg hover:bg-glow-600 transition-colors ${showBackToTop ? "show" : ""}`}
      >
        <ArrowUpIcon />
      </button>
    </div>
  );
}
