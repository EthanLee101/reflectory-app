"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMismatch =
    mode === "signup" &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  async function handleGoogleSignIn() {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (mode === "signup" && password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    setLoading(true);

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === "signup") {
      setMessage(
        "Check your email to confirm your account, then sign in. (Or disable email confirmation in Supabase for local dev.)"
      );
      return;
    }

    router.push("/journal");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 lg:justify-start lg:pl-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 700px 700px at 14% 8%, rgba(217,162,76,0.13), transparent 60%), radial-gradient(ellipse 900px 600px at 100% 100%, rgba(217,162,76,0.08), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-md rounded-sm border border-border-soft bg-gradient-to-br from-surface to-surface-2 p-10 shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          {mode === "signin" ? "Welcome back" : "Get started"}
        </div>
        <h1 className="mb-8 mt-2.5 font-serif text-4xl italic text-foreground">
          {mode === "signin" ? "Continue journaling" : "Create your journal"}
        </h1>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-sm border border-border bg-foreground/[0.03] py-3.5 font-semibold text-foreground transition hover:bg-foreground/[0.06]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EFC077" d="M43.6 20.5H42V20.4H24v7.2h11.3C33.6 32 29.2 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.9 5.6 29.2 3.6 24 3.6 12.7 3.6 3.6 12.7 3.6 24S12.7 44.4 24 44.4 44.4 35.3 44.4 24c0-1.2-.1-2.4-.3-3.5z" />
            <path fill="#D9A24C" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.9 7.6 29.2 5.6 24 5.6c-7.3 0-13.6 4.2-16.7 10.1z" />
            <path fill="#B9793B" d="M24 44.4c5.1 0 9.7-1.9 13.1-5.1l-6.1-5c-1.8 1.3-4.2 2.1-7 2.1-5.2 0-9.6-3.1-11.2-7.6l-6.5 5C9 40.5 15.9 44.4 24 44.4z" />
            <path fill="#8A6A34" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.6-2.6 4.8-4.9 6.2l6.1 5c3.5-3.3 5.9-8.1 5.9-14 0-1.2-.1-2.4-.3-3.9z" />
          </svg>
          Continue with Google
        </button>

        <div className="my-7 flex items-center gap-3.5 text-xs uppercase tracking-[0.1em] text-faint">
          <div className="h-px flex-1 bg-border-soft" />
          or
          <div className="h-px flex-1 bg-border-soft" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2.5 text-foreground outline-none placeholder:text-faint focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-b border-border bg-transparent py-2.5 text-foreground outline-none placeholder:text-faint focus:border-accent"
          />
          {mode === "signup" && (
            <>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border-b border-border bg-transparent py-2.5 text-foreground outline-none placeholder:text-faint focus:border-accent"
              />
              {passwordsMismatch && (
                <p className="text-sm text-muted">Passwords don&apos;t match.</p>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={loading || passwordsMismatch}
            className="w-full rounded-sm bg-accent py-3.5 font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>

        {message && <p className="mt-5 text-sm text-muted">{message}</p>}

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage(null);
            setConfirmPassword("");
          }}
          className="mt-6 text-sm text-muted"
        >
          {mode === "signin" ? (
            <>
              Need an account?{" "}
              <span className="text-accent-strong underline underline-offset-4">
                Sign up
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span className="text-accent-strong underline underline-offset-4">
                Sign in
              </span>
            </>
          )}
        </button>
      </div>
    </main>
  );
}
