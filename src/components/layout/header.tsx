import Image from "next/image";
import Link from "next/link";
import icon from "@/app/icon.png";
import { Brand } from "@/components/ui/brand";

const navItems = [
  { href: "/stacks", label: "Stacks" },
  { href: "/agents", label: "Agents" },
  { href: "/compare", label: "Compare" },
  { href: "/blog", label: "Blog" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary"
        >
          <Image src={icon} alt="" width={28} height={28} className="size-7" />
          <Brand />
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
