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

const { runPlaytest } = require("../src/lib/euchre/sim/playtest-runner.ts");
const { failuresToJsonl } = require("../src/lib/euchre/sim/failure-log.ts");
const { assertBotPolicyId, policyIdsForCli } = require("../src/lib/euchre/bot-policies.ts");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = parseConfig(args);
  const outDir = path.resolve(process.cwd(), stringArg(args.out, path.join("playtest-results", `run-${Date.now()}`)));

  const summary = await runPlaytest(config);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(summary.metrics, null, 2));

  if (summary.failures.length) {
    fs.writeFileSync(path.join(outDir, "failures.jsonl"), `${failuresToJsonl(summary.failures)}\n`);
  }

  printSummary(summary, outDir);

  if (summary.failedGames > 0) {
    process.exitCode = 1;
  }
}

function parseConfig(args) {
  const games = positiveInt(args.games, "games", 1000);
  const seed = seedArg(args.seed, 12345);
  const targetScore = positiveInt(args.targetScore ?? args["target-score"], "target-score", 10);
  const stickDealer = booleanArg(args.stickDealer ?? args["stick-dealer"], false);
  const invariants = invariantMode(args.invariants, "strict");
  const failFast = booleanArg(args.failFast ?? args["fail-fast"], false);
  const sampleReviews = nonNegativeInt(args.sampleReviews ?? args["sample-reviews"], "sample-reviews", 0);
  const botDifficulty = stringArg(args.botDifficulty ?? args["bot-difficulty"], "standard");
  const botPolicy = botPolicyArg(args.botPolicy ?? args["bot-policy"]);

  return {
    games,
    seed,
    targetScore,
    stickDealer,
    invariants,
    botPolicy,
    failFast,
    sampleReviews,
    botDifficulty
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Invalid argument: ${arg}`);
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

function positiveInt(value, label, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  throw new Error(`--${label} must be a positive integer`);
}

function nonNegativeInt(value, label, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }
  throw new Error(`--${label} must be a non-negative integer`);
}

function seedArg(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && String(value).trim() !== "" ? parsed : String(value);
}

function stringArg(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function booleanArg(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true" || value === "1" || value === "yes") return true;
  if (value === false || value === "false" || value === "0" || value === "no") return false;
  throw new Error(`Invalid boolean argument: ${value}`);
}

function invariantMode(value, fallback) {
  const mode = stringArg(value, fallback);
  if (mode === "off" || mode === "warn" || mode === "strict") {
    return mode;
  }
  throw new Error("--invariants must be one of: off, warn, strict");
}

function botPolicyArg(value) {
  const policy = stringArg(value, "basic-v1");
  try {
    return assertBotPolicyId(policy);
  } catch {
    throw new Error(`--bot-policy must be one of: ${policyIdsForCli()}`);
  }
}

function percent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function printSummary(summary, outDir) {
  const { metrics } = summary;
  console.log("Euchre Playtest Summary");
  console.log("=======================");
  console.log(`Games: ${summary.totalGames}`);
  console.log(`Completed: ${summary.completedGames}`);
  console.log(`Failed: ${summary.failedGames}`);
  console.log(`Hands: ${summary.totalHands}`);
  console.log(`Runtime: ${summary.elapsedMs}ms`);
  console.log(`Bot policy: ${summary.botPolicy.id} (${summary.botPolicy.name} ${summary.botPolicy.version})`);
  console.log(`Average hands/game: ${metrics.averageHandsPerGame}`);
  console.log(`Team 0 wins: ${metrics.teamWins[0]} (${percent(metrics.teamWinRates[0])})`);
  console.log(`Team 1 wins: ${metrics.teamWins[1]} (${percent(metrics.teamWinRates[1])})`);
  console.log(`Maker win/euchre: ${percent(metrics.makerWinRate)} / ${percent(metrics.makerEuchreRate)}`);
  console.log(`Round 1 / Round 2 calls: ${percent(metrics.roundOneCallRate)} / ${percent(metrics.roundTwoCallRate)}`);
  console.log(`Loners: ${metrics.loneAttemptCount} attempts, ${metrics.loneSuccessCount} successes`);
  console.log(`Output: ${outDir}`);
  if (summary.failedGames > 0) {
    console.log("Failures: failures.jsonl");
  }
}
