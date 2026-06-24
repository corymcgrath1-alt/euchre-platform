/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

const { simulateEuchreGames, simulationReportToCsv } = require("../src/lib/euchre/simulator.ts");

const args = parseArgs(process.argv.slice(2));
const games = positiveInt(args.games, 1000);
const seed = positiveInt(args.seed, 12345);
const targetScore = positiveInt(args.targetScore ?? args["target-score"], 10);
const stickDealer = booleanArg(args.stickDealer ?? args["stick-dealer"], false);
const botDifficulty = stringArg(args.botDifficulty ?? args["bot-difficulty"], "standard");
const verbose = booleanArg(args.verbose, false);

const started = Date.now();
const report = simulateEuchreGames({
  games,
  seed,
  config: {
    targetScore,
    stickDealer,
    botDifficulty
  }
});
report.metrics.runtimeMs = Date.now() - started;

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(process.cwd(), "simulations");
fs.mkdirSync(outDir, { recursive: true });
const baseName = `euchre-sim-${timestamp}-${seed}`;
const jsonPath = path.join(outDir, `${baseName}.json`);
const csvPath = path.join(outDir, `${baseName}.csv`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(csvPath, simulationReportToCsv(report));

printSummary(report, { jsonPath, csvPath, verbose });

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      parsed[rawKey] = next;
      index += 1;
    } else {
      parsed[rawKey] = "true";
    }
  }
  return parsed;
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stringArg(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function booleanArg(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true" || value === "1" || value === "yes") return true;
  if (value === false || value === "false" || value === "0" || value === "no") return false;
  return fallback;
}

function percent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function printSummary(report, { jsonPath, csvPath, verbose }) {
  const { metrics } = report;
  console.log("Euchre Simulation Summary");
  console.log("=========================");
  console.log(`Games: ${metrics.totalGames}`);
  console.log(`Hands: ${metrics.totalHands}`);
  console.log(`Runtime: ${metrics.runtimeMs}ms`);
  console.log(`Average hands/game: ${metrics.averageHandsPerGame}`);
  console.log(`Average points/hand: ${metrics.averagePointsPerHand}`);
  console.log(`Team 0 wins: ${metrics.teamWins[0]} (${percent(metrics.teamWinRates[0])})`);
  console.log(`Team 1 wins: ${metrics.teamWins[1]} (${percent(metrics.teamWinRates[1])})`);
  console.log(`Maker success: ${percent(metrics.makerSuccessRate)}`);
  console.log(`Maker euchred: ${percent(metrics.makerEuchredRate)}`);
  console.log(`Round 1 calls: ${percent(metrics.roundOneCallRate)}`);
  console.log(`Round 2 calls: ${percent(metrics.roundTwoCallRate)}`);
  console.log(`Dealer pickup: ${percent(metrics.dealerPickupRate)}`);
  console.log(`Loners: ${percent(metrics.lonerAttemptRate)} attempts, ${percent(metrics.lonerSuccessRate)} success`);
  console.log(`Marches: ${percent(metrics.marchRate)} | Euchres: ${percent(metrics.euchreRate)} | Passouts: ${percent(metrics.passoutRate)}`);
  console.log(`Illegal moves / failed games: ${metrics.illegalMoveCount} / ${metrics.failedGames}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV:  ${csvPath}`);

  if (verbose) {
    console.log("Trump distribution:", metrics.trumpSuitDistribution);
    console.log("Final scores:", metrics.finalScoreDistribution);
    console.log("Bot decisions:", metrics.botDecisionCounts);
  }
}
