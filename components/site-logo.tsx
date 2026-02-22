import Image from "next/image";

interface SiteLogoProps {
  /** Size in pixels (width and height). Default 40 for navbar. */
  size?: number;
  /** Optional class name for the wrapper. */
  className?: string;
}

/**
 * Theme-aware logo: shows light_theme_logo.png in light mode,
 * dark_theme_logo.png in dark mode (via next-themes class on html).
 */
export function SiteLogo({ size = 40, className }: SiteLogoProps) {
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ""}`}>
      <Image
        priority
        alt="Dynamic Questionnaire"
        className="dark:hidden"
        height={size}
        src="/logo.jpg"
        width={size}
      />
      <Image
        priority
        alt="Dynamic Questionnaire"
        className="hidden dark:block"
        height={size}
        src="/logo.jpg"
        width={size}
      />
    </span>
  );
}
