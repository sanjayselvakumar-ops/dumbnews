"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountProfile } from "@/lib/membership";
import type { NewsStory } from "@/lib/news/types";
import type { StoredState } from "@/lib/app-storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { MembershipSelector, type BillingPrice } from "@/components/membership-selector";

function bearerFetch(url: string, token: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  });
}

export function AccountPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [price, setPrice] = useState<BillingPrice | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setIsAccountLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      setToken(accessToken);
      bearerFetch("/api/account", accessToken)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Account load failed");
          }
          return response.json() as Promise<{
            profile: AccountProfile;
            state: StoredState;
            savedStories?: NewsStory[];
          }>;
        })
        .then((account) => setProfile(account.profile))
        .catch(() => setMessage("Could not load your account."))
        .finally(() => setIsAccountLoading(false));
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/billing/price")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Price unavailable");
        }
        return response.json() as Promise<BillingPrice>;
      })
      .then(setPrice)
      .catch(() => undefined)
      .finally(() => setIsPriceLoading(false));
  }, []);

  async function startCheckout() {
    if (!token) {
      return;
    }

    setIsCheckoutLoading(true);
    setMessage(null);
    try {
      const response = await bearerFetch("/api/billing/checkout", token, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.error ?? "Could not start checkout.");
    } catch {
      setMessage("Could not start checkout.");
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  async function openPortal() {
    if (!token) {
      return;
    }

    setIsPortalLoading(true);
    setMessage(null);
    try {
      const response = await bearerFetch("/api/billing/portal", token, { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.error ?? "Could not open billing portal.");
    } catch {
      setMessage("Could not open billing portal.");
    } finally {
      setIsPortalLoading(false);
    }
  }

  async function signOut() {
    await getSupabaseBrowserClient()?.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="stage theme-light font-normal">
      <section className="accountPage">
        <header className="accountHeader">
          <button className="hardButton secondary" type="button" onClick={() => router.push("/app")}>
            BACK TO APP
          </button>
          <h1>ACCOUNT</h1>
        </header>
        {isAccountLoading ? (
          <div className="emptyState">LOADING ACCOUNT...</div>
        ) : (
          <div className="accountPanel">
            <div className="accountLine">
              <span>EMAIL</span>
              <strong>{profile?.email ?? "UNKNOWN"}</strong>
            </div>
            <div className="accountLine">
              <span>CURRENT PLAN</span>
              <strong>{profile?.membershipTier === "paid" ? "PRO" : "FREE"}</strong>
            </div>
            <div className="accountLine">
              <span>BILLING STATUS</span>
              <strong>{profile?.subscriptionStatus ?? "free"}</strong>
            </div>
            {profile?.currentPeriodEnd && (
              <div className="accountLine">
                <span>CURRENT PERIOD END</span>
                <strong suppressHydrationWarning>{new Date(profile.currentPeriodEnd).toLocaleDateString("en-US")}</strong>
              </div>
            )}
            {profile?.cancelAtPeriodEnd && (
              <div className="authError">SUBSCRIPTION WILL CANCEL AT THE END OF THIS BILLING PERIOD.</div>
            )}
            <MembershipSelector
              isCheckoutLoading={isCheckoutLoading}
              isPortalLoading={isPortalLoading}
              isPriceLoading={isPriceLoading}
              onManageBilling={openPortal}
              onUpgrade={startCheckout}
              price={price}
              profile={profile}
            />
            <div className="accountActions">
              {profile?.membershipTier === "paid" ? (
                <button className="hardButton" disabled={isPortalLoading} type="button" onClick={openPortal}>
                  {isPortalLoading ? "OPENING..." : "MANAGE SUBSCRIPTION"}
                </button>
              ) : (
                <button className="hardButton" disabled={isCheckoutLoading || isPriceLoading} type="button" onClick={startCheckout}>
                  {isCheckoutLoading ? "OPENING..." : `UPGRADE ${price?.display ?? ""}`}
                </button>
              )}
              <button className="hardButton secondary" type="button" onClick={signOut}>
                LOG OUT
              </button>
            </div>
            {message && <div className="authError">{message}</div>}
          </div>
        )}
      </section>
    </main>
  );
}
