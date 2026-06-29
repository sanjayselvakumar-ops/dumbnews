"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }

    setIsSubmitting(true);
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (isSignUp && !result.data.session) {
      setMessage("Check your email to confirm your account, then log in.");
      return;
    }

    router.replace(searchParams.get("next") || "/app");
    router.refresh();
  }

  return (
    <main className="stage theme-light font-normal">
      <section className="authShell" aria-label="Dumb News account access">
        <div className="authBox">
          <h1>DUMB NEWS</h1>
          <p>NEWS FOR DUMMIES.</p>
          <form className="authForm" onSubmit={submit}>
            <label>
              EMAIL
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              PASSWORD
              <input
                autoComplete={isSignUp ? "new-password" : "current-password"}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {message && <div className="authError">{message}</div>}
            <button className="hardButton" disabled={isSubmitting} type="submit">
              {isSubmitting ? "WORKING..." : isSignUp ? "SIGN UP" : "LOG IN"}
            </button>
            <button className="plainSwitch" type="button" onClick={() => setIsSignUp((current) => !current)}>
              {isSignUp ? "HAVE AN ACCOUNT? LOG IN" : "NEED AN ACCOUNT? SIGN UP"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
