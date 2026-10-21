interface AnimatedLogoProps {
  className?: string;
  alt?: string;
  size?: number;
}

/**
 * Brand mark for the footer and admin sidebar.
 *
 * Renders the scalable triangle logo SVG, so the same file is crisp at every
 * rendered size (28px in the collapsed sidebar, 100px in the footer) and
 * inherits dark-mode behaviour from the asset itself.
 *
 * The name is kept for call-site stability: the component previously rendered
 * a 15-frame sprite-sheet animation (public/logo/logo.png.gz) that was removed
 * along with the old branding assets.
 */
export default function AnimatedLogo({
  className = "",
  alt = "Vijay Kumar Sharma",
  size = 100,
}: AnimatedLogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt={alt}
      role="img"
      width={size}
      height={size}
      className={`animated-logo ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}
