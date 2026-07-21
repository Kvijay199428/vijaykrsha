import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-32 text-center">
      <p className="text-6xl font-bold text-glow-500 mb-4">404</p>
      <h1 className="text-2xl font-semibold text-night-800 dark:text-cream-50 mb-2">
        Page Not Found
      </h1>
      <p className="text-night-800/60 dark:text-cream-100/60 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 rounded-xl bg-glow-500 text-white font-medium hover:bg-glow-600 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
