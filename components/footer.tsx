import { Link } from "@heroui/link";

import { GithubIcon } from "./icons";

import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-default-200 py-8">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-default-500">
          © 2026 Dynamic Questionnaire – Advancing Open Science
        </p>
        <Link
          isExternal
          className="flex items-center gap-2 text-default-500 transition-colors hover:text-primary"
          href={siteConfig.links.github}
        >
          <GithubIcon size={20} />
          <span className="text-sm">GitHub Repository</span>
        </Link>
      </div>
    </footer>
  );
}
