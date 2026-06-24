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

const {
  comparePlaytestRuns,
  formatPlaytestComparisonReport
} = require("../src/lib/euchre/sim/playtest-comparison.ts");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h || !args.a || !args.b) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const format = formatArg(args.format);
  const aPath = path.resolve(process.cwd(), args.a);
  const bPath = path.resolve(process.cwd(), args.b);
  const aSummary = readSummary(aPath, "A");
  const bSummary = readSummary(bPath, "B");
  const report = comparePlaytestRuns(
    {
      label: stringArg(args.aLabel ?? args["a-label"], defaultLabel(aSummary, aPath)),
      summary: aSummary
    },
    {
      label: stringArg(args.bLabel ?? args["b-label"], defaultLabel(bSummary, bPath)),
      summary: bSummary
    }
  );
  const output = format === "json"
    ? JSON.stringify(report, null, 2)
    : formatPlaytestComparisonReport(report);

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${output}\n`);
  }

  console.log(output);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Invalid argument: ${arg}\n\n${usage()}`);
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

function readSummary(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} summary file: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${label} summary file: ${filePath}\n${message}`);
  }
}

function formatArg(value) {
  const format = stringArg(value, "text");
  if (format === "text" || format === "json") {
    return format;
  }

  throw new Error(`--format must be one of: text, json\n\n${usage()}`);
}

function stringArg(value, fallback) {
  return typeof value === "string" && value.length ? value : fallback;
}

function defaultLabel(summary, filePath) {
  return (
    summary?.botPolicy?.id ??
    summary?.comparison?.botPolicy ??
    summary?.metrics?.botPolicyId ??
    summary?.config?.botPolicy ??
    path.basename(path.dirname(filePath)) ??
    path.basename(filePath)
  );
}

function usage() {
  return [
    "Usage:",
    "  npm run compare-playtests -- --a <summary.json> --b <summary.json> [--a-label name] [--b-label name] [--format text|json] [--out report-path]",
    "",
    "Examples:",
    "  npm run compare-playtests -- --a ./playtest-results/basic-v1-clean-1k/summary.json --a-label basic-v1 --b ./playtest-results/legal-random-v1-clean-1k/summary.json --b-label legal-random-v1",
    "  npm run compare-playtests -- --a ./playtest-results/basic-v1-clean-1k/summary.json --b ./playtest-results/legal-random-v1-clean-1k/summary.json --format json --out ./playtest-results/comparison-clean-1k/report.json"
  ].join("\n");
}
