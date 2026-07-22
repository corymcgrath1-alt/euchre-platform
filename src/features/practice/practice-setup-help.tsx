import type { FarmersHandMode, LonerMode } from "@/lib/euchre";

export function PracticeSetupHelp({
  farmersHandMode,
  lonerMode,
  lastSeed
}: {
  farmersHandMode: FarmersHandMode;
  lonerMode: LonerMode;
  lastSeed: number | null;
}) {
  return (
    <section className="grid gap-3 rounded border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white/65 lg:grid-cols-3">
      <div>
        <p className="font-semibold text-white">Farmer&apos;s Hand</p>
        <p className="mt-1">{farmersHandHelp(farmersHandMode)}</p>
        <p className="mt-1 text-xs text-white/45">Qualifier: only 9s and 10s; no A, K, Q, or J.</p>
      </div>
      <div>
        <p className="font-semibold text-white">Loner mode</p>
        <p className="mt-1">
          {lonerMode === "aloneOnly"
            ? "Standard loners are fully supported: the caller may go alone under current scoring."
            : "Assisted-loner mode is stored for replay safety, but assisted gameplay remains deferred."}
        </p>
      </div>
      <div>
        <p className="font-semibold text-white">Seed practice</p>
        <p className="mt-1">
          Enter a seed before starting to repeat the first deal, or copy the active seed after creation.
          {lastSeed === null ? "" : ` Current seed: ${lastSeed}.`}
        </p>
      </div>
    </section>
  );
}

function farmersHandHelp(mode: FarmersHandMode): string {
  switch (mode) {
    case "redeal":
      return "A qualifying player may claim a deterministic redeal before bidding.";
    case "replaceThree":
      return "A qualifying human may choose 1-3 low cards to exchange with the kitty.";
    case "off":
      return "No Farmer's Hand phase; bidding begins immediately after the deal.";
  }
}
