import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getInstitution, getBankHistory, getLabels, getPeers } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { derivePeriods } from "@/lib/bankMetrics";
import { getFdicInstitution, getFdicFinancials, charterLabel, foundedYear } from "@/lib/fdic";
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

  // FDIC BankFind data — fetched in parallel, fails gracefully
  const [fdicInst, fdicFinancials] = await Promise.all([
    getFdicInstitution(inst!.fdic_cert).catch(() => null),
    getFdicFinancials(inst!.fdic_cert, 40).catch(() => []),
  ]);

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
        <div className="flex flex-wrap gap-4 justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">{inst!.name}</h1>
            <div className="text-white/70 text-sm">
              {[inst!.address, inst!.city, inst!.state, inst!.zip].filter(Boolean).join(", ")}
            </div>
            {fdicInst?.cbsanm && (
              <div className="text-white/50 text-xs mt-0.5">{fdicInst.cbsanm} metro area</div>
            )}
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
        {/* FDIC supplemental row */}
        <div className="border-t border-white/10 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wide">Holding Company</div>
            <div className="text-white/90">{fdicInst?.namehcr || "—"}</div>
          </div>
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wide">Regulator</div>
            <div className="text-white/90">{fdicInst ? charterLabel(fdicInst.chrtagnt, fdicInst.charter) : "—"}</div>
          </div>
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wide">Founded</div>
            <div className="font-mono">{fdicInst ? foundedYear(fdicInst.estymd) : "—"}</div>
          </div>
          <div>
            <div className="text-white/50 text-xs uppercase tracking-wide">Branches</div>
            <div className="font-mono">{fdicInst?.offdom != null ? fdicInst.offdom.toLocaleString() : "—"}</div>
          </div>
        </div>
      </div>

      {/* Market data strip — only shown for publicly traded institutions */}
      {inst!.bhc_ticker && (
        <div className="bg-white border border-gray-200 rounded p-4 mb-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="bg-[#0a2342] text-white text-xs font-bold px-2 py-0.5 rounded font-mono">
              {inst!.bhc_ticker}
            </span>
            {inst!.bhc_name && (
              <span className="text-sm text-gray-500">{inst!.bhc_name}</span>
            )}
          </div>
          {([
            ["Price",      inst!.stock_price ? `$${Number(inst!.stock_price).toFixed(2)}` : null],
            ["Market Cap", inst!.market_cap  ? `$${(Number(inst!.market_cap) / 1_000_000).toFixed(1)}B` : null],
            ["P/E",        inst!.pe_ratio    ? `${Number(inst!.pe_ratio).toFixed(1)}x`  : null],
            ["P/B",        inst!.pb_ratio    ? `${Number(inst!.pb_ratio).toFixed(2)}x`  : null],
            ["TBV/Share",  inst!.tbv_per_share ? `$${Number(inst!.tbv_per_share).toFixed(2)}` : null],
            ["EPS (diluted)", inst!.eps_diluted ? `$${Number(inst!.eps_diluted).toFixed(2)}` : null],
            ["Div/Share",  inst!.div_per_share ? `$${Number(inst!.div_per_share).toFixed(2)}` : null],
            ["Div Yield",  inst!.div_yield    ? `${(Number(inst!.div_yield) * 100).toFixed(2)}%` : null],
          ] as [string, string | null][]).filter(([, v]) => v != null).map(([lbl, val]) => (
            <div key={lbl} className="text-sm">
              <span className="text-gray-400 text-xs uppercase tracking-wide block">{lbl}</span>
              <span className="font-mono font-semibold text-[#0a2342]">{val}</span>
            </div>
          ))}
          <a
            href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${inst!.bhc_cik}&type=10-K&dateb=&owner=include&count=5`}
            target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-[#0a2342] hover:text-[#c9a84c] underline underline-offset-2"
          >
            SEC Filings →
          </a>
        </div>
      )}

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
      {validTab === "capital"      && <CapitalTab      periods={periods} fdicFinancials={fdicFinancials} />}
      {validTab === "profitability"&& <ProfitabilityTab periods={periods} />}
      {validTab === "loans"        && <LoansTab        periods={periods} fdicFinancials={fdicFinancials} />}
      {validTab === "deposits"     && <DepositsTab     periods={periods} />}
      {validTab === "growth"       && <GrowthTab       periods={periods} />}
      {validTab === "peers"        && <PeerComparisonTab subject={inst!} peers={peers} />}
    </div>
  );
}
