import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="stage theme-light font-normal">
          <section className="authShell">
            <div className="emptyState">LOADING ACCOUNT...</div>
          </section>
        </main>
      }
    >
      <AuthPage />
    </Suspense>
  );
}
