import type { NewsCategory } from "@/lib/news/types";
import React from "react";

type IconProps = {
  className?: string;
};

function Svg({ children, className, viewBox = "0 0 64 64" }: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox={viewBox} focusable="false">
      {children}
    </svg>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="39" width="8" height="16" rx="1" fill="currentColor" />
      <rect x="20" y="31" width="8" height="24" rx="1" fill="currentColor" />
      <rect x="33" y="21" width="8" height="34" rx="1" fill="currentColor" />
      <rect x="46" y="11" width="8" height="44" rx="1" fill="currentColor" />
    </Svg>
  );
}

export function BatteryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8" y="18" width="44" height="28" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="52" y="26" width="5" height="12" fill="currentColor" />
      <rect x="13" y="23" width="31" height="18" fill="currentColor" />
    </Svg>
  );
}

export function PoliticsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M32 8l5 5v3H27v-3l5-5zM15 27h34v6H15zM18 50h28v6H18zM14 58h36v4H14zM20 36h6v13h-6zM30 36h6v13h-6zM40 36h6v13h-6z" fill="currentColor" />
      <path d="M18 25c2-9 9-14 14-14s12 5 14 14H18z" fill="currentColor" />
    </Svg>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M44 6c-12 3-23 14-28 27l15 15c13-5 24-16 27-28 1-5-1-11-4-14-3-1-7-1-10 0zM39 21a5 5 0 1110 0 5 5 0 01-10 0zM13 37L5 51l13-6zM27 51l-14 8 6-13zM11 30L3 39l10 2 5-10zM34 53l-10 5-2-10 10-5z" fill="currentColor" />
    </Svg>
  );
}

export function BusinessIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="12" y="38" width="10" height="18" fill="currentColor" />
      <rect x="27" y="28" width="10" height="28" fill="currentColor" />
      <rect x="42" y="17" width="10" height="39" fill="currentColor" />
    </Svg>
  );
}

export function SportsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M32 13l10 8-4 12H26l-4-12zM17 32l9 1 5 11-7 7M47 32l-9 1-5 11 7 7M24 21l-8 6M40 21l8 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </Svg>
  );
}

export function WorldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M8 32h48M32 8c-8 8-11 16-11 24s3 16 11 24M32 8c8 8 11 16 11 24s-3 16-11 24M14 20h36M14 44h36" fill="none" stroke="currentColor" strokeWidth="4" />
    </Svg>
  );
}

export function HealthIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M27 8h10v18h18v10H37v20H27V36H9V26h18z" fill="currentColor" />
    </Svg>
  );
}

export function TechIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="14" y="13" width="36" height="38" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="23" y="22" width="18" height="16" fill="currentColor" />
      <path d="M20 5v8M32 5v8M44 5v8M20 51v8M32 51v8M44 51v8M6 23h8M6 32h8M6 41h8M50 23h8M50 32h8M50 41h8" stroke="currentColor" strokeWidth="4" />
    </Svg>
  );
}

export function NewsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="12" y="14" width="34" height="40" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M46 22h6v27c0 3-2 5-5 5h-1z" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="18" y="22" width="10" height="9" fill="currentColor" />
      <path d="M32 23h8M32 30h8M18 38h22M18 45h22" stroke="currentColor" strokeWidth="4" />
    </Svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 9h24v48L32 47 20 57z" fill="currentColor" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M28 5h8l3 9 8-4 6 6-4 8 9 4v8l-9 3 4 8-6 6-8-4-3 9h-8l-3-9-8 4-6-6 4-8-9-3v-8l9-4-4-8 6-6 8 4z" fill="currentColor" />
      <circle cx="32" cy="32" r="8" fill="var(--icon-cutout, var(--bg))" />
    </Svg>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="32" cy="20" r="11" fill="currentColor" />
      <path d="M14 56c2-14 9-22 18-22s16 8 18 22H14z" fill="currentColor" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="28" cy="28" r="17" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M41 41l14 14" stroke="currentColor" strokeWidth="7" />
    </Svg>
  );
}

export function CategoryIcon({ category, className }: { category: NewsCategory; className?: string }) {
  if (category === "politics") return <PoliticsIcon className={className} />;
  if (category === "business") return <BusinessIcon className={className} />;
  if (category === "sports") return <SportsIcon className={className} />;
  if (category === "world" || category === "top") return <WorldIcon className={className} />;
  if (category === "technology") return <TechIcon className={className} />;
  if (category === "health") return <HealthIcon className={className} />;
  return <RocketIcon className={className} />;
}
