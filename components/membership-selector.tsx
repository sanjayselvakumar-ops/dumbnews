import React from "react";
import type { AccountProfile } from "@/lib/membership";

export type BillingPrice = {
  id: string;
  display: string;
};

export function MembershipSelector({
  isCheckoutLoading,
  isPortalLoading,
  isPriceLoading,
  onManageBilling,
  onUpgrade,
  price,
  profile
}: {
  isCheckoutLoading?: boolean;
  isPortalLoading?: boolean;
  isPriceLoading?: boolean;
  onManageBilling: () => void;
  onUpgrade: () => void;
  price: BillingPrice | null;
  profile: AccountProfile | null;
}) {
  const isPaid = profile?.membershipTier === "paid";
  const proLabel = isPriceLoading ? "PRO ..." : `PRO ${price?.display ?? "$2.50 / month"}`;

  return (
    <div className="membershipSelector" aria-label="Membership plans">
      <button className={!isPaid ? "selected" : ""} disabled={!isPaid} type="button">
        FREE
        <span>10 NEWS</span>
      </button>
      {isPaid ? (
        <button className="selected" disabled={isPortalLoading} type="button" onClick={onManageBilling}>
          PRO
          <span>{isPortalLoading ? "OPENING..." : "ACTIVE"}</span>
        </button>
      ) : (
        <button disabled={isCheckoutLoading || isPriceLoading} type="button" onClick={onUpgrade}>
          {isCheckoutLoading ? "OPENING..." : proLabel}
          <span>ALL NEWS</span>
        </button>
      )}
    </div>
  );
}
