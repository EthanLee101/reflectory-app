import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default function Navbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="relative border-b border-border-soft">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-xl italic text-foreground">
          Journal Buddy
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/journal"
            className="text-muted transition hover:text-foreground"
          >
            Journal
          </Link>
          <Link
            href="/about"
            data-tour="about-link"
            className="text-muted transition hover:text-foreground"
          >
            About
          </Link>
          {userEmail ? (
            <div className="flex items-center gap-4 border-l border-border-soft pl-6 text-faint">
              <span className="hidden sm:inline">{userEmail}</span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-accent/40 px-4 py-1.5 font-semibold text-accent-strong transition hover:bg-accent/10"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
