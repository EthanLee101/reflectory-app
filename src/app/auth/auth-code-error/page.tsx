import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-2xl italic text-foreground">
        Sign-in didn&apos;t go through
      </h1>
      <p className="text-sm text-muted">
        Something went wrong completing that sign-in. Please try again.
      </p>
      <Link
        href="/login"
        className="text-sm text-accent-strong underline underline-offset-4"
      >
        Back to login
      </Link>
    </main>
  );
}
