import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = resolve(ROOT, "apps/cli/dist/zimanyar.cjs");
const UPDATE = Boolean(process.env["UPDATE_SCREENSHOTS"]);

const COLOURS: Record<string, string> = {
  "1": "b",
  "2": "dim",
  "31": "red",
  "32": "green",
  "33": "yellow",
  "34": "blue",
};
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The colours the CLI writes, as HTML. It only writes one code at a time, each closed by a reset. */
function ansiToHtml(text: string): string {
  const parts = text.split(new RegExp(`${String.fromCharCode(27)}\\[([0-9;]*)m`));
  let html = "";
  let open = false;
  parts.forEach((part, index) => {
    if (index % 2 === 0) html += escapeHtml(part);
    else if (part === "0" || part === "") {
      if (open) html += "</span>";
      open = false;
    } else {
      html += `<span class="${COLOURS[part] ?? ""}">`;
      open = true;
    }
  });
  return html;
}

/** Run the built CLI as someone would in a terminal, in colour. */
function run(cwd: string, args: string[]): string {
  try {
    return execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "1" },
    });
  } catch (error) {
    // Exit code 1 means findings, which is what the screenshot shows.
    return (error as { stdout: string }).stdout;
  }
}

test("screenshot of the command line", async ({ page }) => {
  test.skip(!UPDATE, "only when regenerating");
  const dir = mkdtempSync(join(tmpdir(), "zimanyar-cli-"));
  try {
    writeFileSync(join(dir, "email.txt"), "Min tu dîtim. Ez dıçım malê. Ez li mal im.\n");
    const command = ["check", "--lang", "kmr", "email.txt"];
    const output = run(dir, command);
    await page.setViewportSize({ width: 1152, height: 400 });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body { margin: 0; background: #161a19; color: #e6e9e7; font: 15px/1.55 ui-monospace, "DejaVu Sans Mono", monospace; }
      pre { margin: 0; padding: 22px 26px; white-space: pre-wrap; font: inherit; }
      .p { color: #febd11; } .b { font-weight: 700; } .dim { color: #8a938e; }
      .red { color: #ff6b70; } .green { color: #5fd38a; } .yellow { color: #f6c25b; } .blue { color: #7fb2ff; }
    </style></head><body><pre><span class="p">$</span> zimanyar ${command.join(" ")}\n${ansiToHtml(output)}</pre></body></html>`);
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 1152, height });
    await page.screenshot({ path: resolve(ROOT, "assets/screenshots/cli-check.png") });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
