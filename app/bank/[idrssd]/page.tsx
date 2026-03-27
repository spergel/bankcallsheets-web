import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getInstitution, getBankHistory, getLabels, getPeers } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { derivePeriods } from "@/lib/bankMetrics";
import Link from "next/link";
import TabNav from "@/components/bank/TabNav";
import OverviewTab from "@/components/bank/OverviewTab";
import AssetQualityTab from "@/components/bank/AssetQualityTab";
import CapitalTab from "@/components/bank/CapitalTab";
import ProfitabilityTab from "@/components/bank/ProfitabilityTab";
import LoansTab from "@/components/bank/LoansTab";
import DepositsTab from "@/components/bank/DepositsTab";
import GrowthTab from "@/components/bank/GrowthTab";
import PeerComparisonTab from "@/components/bank/PeerComparisonTab";

export const runtime = 'nodejs';

export default async function BankPage({
  params,
  searchParams,
}: {
  params: Promise<{ idrssd: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { idrssd: idStr } = await params;
  const { tab = "overview" } = await searchParams;
  const idrssd = parseInt(idStr, 10);
  if (isNaN(idrssd)) notFound();

  let inst, historyRaw, labelMap;
  try {
    [inst, historyRaw, labelMap] = await Promise.all([
      getInstitution(idrssd),
      getBankHistory(idrssd),
      getLabels(),
    ]);
  } catch { notFound(); }
  if (!inst) notFound();

  const periods = derivePeriods(historyRaw!);
  const latest  = periods[periods.length - 1] ?? null;

  // Build rawData for the overview tab's RawDataSection
  const rawData: Record<string, number> = {};
  if (historyRaw!.length > 0) {
    const latestRaw = historyRaw![historyRaw!.length - 1];
    for (const [k, v] of Object.entries(latestRaw)) {
      if (k === 'period_end_date') continue;
      if (v !== '' && Number(v) !== 0) rawData[k] = Number(v);
    }
  }

  const validTab = ["overview","assetquality","capital","profitability","loans","deposits","growth","peers"].includes(tab)
    ? tab : "overview";

  const peers = validTab === "peers" && latest?.total_assets
    ? await getPeers(idrssd, latest.total_assets)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-4">
        <Link href="/" className="hover:text-[#0a2342]">Home</Link>{" / "}
        <Link href="/search" className="hover:text-[#0a2342]">Search</Link>{" / "}
        <span className="text-gray-600">{inst!.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-[#0a2342] text-white rounded p-6 mb-6">
        <div className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-1">{inst!.name}</h1>
            <div className="text-white/70 text-sm">
              {[inst!.address, inst!.city, inst!.state, inst!.zip].filter(Boolean).join(", ")}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
            {(
              [
                ["FDIC Cert",   inst!.fdic_cert],
                ["ABA Routing", inst!.aba_routing],
                ["Filing Type", inst!.filing_type],
                ["Last Report", latest?.period ? formatDate(latest.period) : "—"],
              ] as [string, string][]
            ).map(([lbl, val]) => (
              <div key={lbl}>
                <div className="text-white/50 text-xs uppercase tracking-wide">{lbl}</div>
                <div className="font-mono">{val || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <Suspense>
        <TabNav idrssd={idStr} />
      </Suspense>

      {/* Tab content */}
      {validTab === "overview" && (
        <OverviewTab
          periods={periods}
          rawData={rawData}
          labelMap={labelMap!}
          historyRaw={historyRaw!}
        />
      )}
      {validTab === "assetquality" && <AssetQualityTab periods={periods} />}
      {validTab === "capital"      && <CapitalTab      periods={periods} />}
      {validTab === "profitability"&& <ProfitabilityTab periods={periods} />}
      {validTab === "loans"        && <LoansTab        periods={periods} />}
      {validTab === "deposits"     && <DepositsTab     periods={periods} />}
      {validTab === "growth"       && <GrowthTab       periods={periods} />}
      {validTab === "peers"        && <PeerComparisonTab subject={inst!} peers={peers} />}
    </div>
  );
}
