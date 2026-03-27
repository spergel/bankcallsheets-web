"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview",     label: "Overview" },
  { id: "assetquality", label: "Asset Quality" },
  { id: "capital",      label: "Capital" },
  { id: "profitability",label: "Profitability" },
  { id: "loans",        label: "Loans" },
  { id: "deposits",     label: "Deposits" },
  { id: "growth",       label: "Growth" },
  { id: "peers",        label: "Peers" },
];

export default function TabNav({ idrssd }: { idrssd: string }) {
  const sp = useSearchParams();
  const active = sp.get("tab") ?? "overview";

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {TABS.map(t => {
          const isActive = t.id === active;
          return (
            <Link
              key={t.id}
              href={`/bank/${idrssd}?tab=${t.id}`}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-[#0a2342] text-[#0a2342]"
                  : "border-transparent text-gray-500 hover:text-[#0a2342] hover:border-gray-300"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
