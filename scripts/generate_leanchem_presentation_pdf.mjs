/**
 * Generate PDF from the LeanChem Connect project deliverables presentation.
 *
 * Usage:
 *   node scripts/generate_leanchem_presentation_pdf.mjs
 *
 * Output: docs/leanchem-connect-presentation/LeanChem_Connect_Project_Deliverables.pdf
 *
 * Uses Chrome/Edge headless when available (fast on Windows).
 * Falls back to Puppeteer if no browser is found.
 */

import { createRequire } from "module";
import { execFileSync, execSync } from "child_process";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const htmlPath = join(
  root,
  "docs/leanchem-connect-presentation/LeanChem_Connect_Project_Deliverables.html",
);
const pdfPath = join(
  root,
  "docs/leanchem-connect-presentation/LeanChem_Connect_Project_Deliverables.pdf",
);

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findBrowser() {
  return BROWSER_CANDIDATES.find((p) => existsSync(p));
}

function printWithHeadless(browserPath) {
  execFileSync(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      htmlPath,
    ],
    { stdio: "inherit" },
  );
}

async function printWithPuppeteer() {
  let puppeteer;
  try {
    const require = createRequire(import.meta.url);
    puppeteer = require("puppeteer");
  } catch {
    console.log("Installing puppeteer (one-time)...");
    execSync("npm install puppeteer --no-save", { cwd: root, stdio: "inherit" });
    const require = createRequire(import.meta.url);
    puppeteer = require("puppeteer");
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle0",
  });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: true,
  });
  await browser.close();
}

async function main() {
  if (!existsSync(htmlPath)) {
    console.error("HTML presentation not found:", htmlPath);
    process.exit(1);
  }

  const browser = findBrowser();
  if (browser) {
    console.log("Using headless browser:", browser);
    printWithHeadless(browser);
  } else {
    console.log("No Chrome/Edge found; using Puppeteer...");
    await printWithPuppeteer();
  }

  if (!existsSync(pdfPath)) {
    throw new Error("PDF was not created");
  }
  console.log("PDF written:", pdfPath);
}

main().catch((err) => {
  console.error(err);
  console.error(
    "\nFallback: open docs/leanchem-connect-presentation/LeanChem_Connect_Project_Deliverables.html",
    "\nin Chrome/Edge → Print → Save as PDF (enable Background graphics, landscape).",
  );
  process.exit(1);
});
