import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listRepoFiles(dir = ROOT, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRepoFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

test("Root LICENSE exists and declares MIT License", () => {
  const licensePath = path.join(ROOT, "LICENSE");
  assert.equal(fs.existsSync(licensePath), true, "LICENSE file must exist at repository root");
  const text = fs.readFileSync(licensePath, "utf8");
  assert.match(text, /MIT License/);
  assert.match(text, /Permission is hereby granted, free of charge/);
});

test("Root package.json and THIRD_PARTY_NOTICES.md enforce zero-bloat MIT compliance", () => {
  assert.equal(
    fs.existsSync(path.join(ROOT, "src", "package.json")),
    false,
    "Misplaced src/package.json must be removed"
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.dependencies, undefined, "Must have zero unverified npm runtime dependencies");

  const notices = fs.readFileSync(path.join(ROOT, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notices, /Three\.js/);
  assert.match(notices, /MIT License/);
});

test("Repository files contain zero leaked API keys, tokens, or local user paths", () => {
  const selfPath = fileURLToPath(import.meta.url);
  const forbiddenPatterns = [
    { label: "GitHub PAT", re: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
    { label: "Cloud/AI API Key", re: /\b(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})\b/ },
    { label: "Private Key Block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { label: "Linux/macOS Home Path", re: /\/(?:home|Users)\/[A-Za-z0-9._-]+\// },
    { label: "Windows User Path", re: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/ },
  ];

  for (const filePath of listRepoFiles()) {
    if (filePath === selfPath) continue;
    const content = fs.readFileSync(filePath, "utf8");
    const rel = path.relative(ROOT, filePath);
    for (const { label, re } of forbiddenPatterns) {
      assert.equal(re.test(content), false, `Detected forbidden ${label} in ${rel}`);
    }
  }
});

test("External CDN URLs in code are restricted to MIT-licensed Three.js", () => {
  const codeFiles = listRepoFiles().filter(
    (f) => /\.(html|m?js|css)$/.test(f) && !f.includes(`${path.sep}tests${path.sep}`)
  );
  const urlRe = /https?:\/\/[^\s"'`)>]+/g;

  for (const filePath of codeFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const urls = content.match(urlRe) ?? [];
    for (const url of urls) {
      assert.equal(
        url.startsWith("https://unpkg.com/three@0.170.0/"),
        true,
        `Unapproved external URL in ${path.relative(ROOT, filePath)}: ${url}`
      );
    }
  }
});

test("Simulation engine module loads cleanly with valid ES Module exports", async () => {
  const simModule = await import("../src/simulation/policyEngine.js");
  assert.equal(Object.keys(simModule).length > 0, true);
});
