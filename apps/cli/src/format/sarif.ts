import { createHash } from "node:crypto";
import { renderMessage, ruleMeta, type Severity, type UiLang } from "@zimanyar/rules";
import type { CheckedFile } from "../check.js";
import { ruleUrl, SITE, VERSION } from "../meta.js";

const LEVEL: Readonly<Record<Severity, "error" | "warning" | "note">> = {
  error: "error",
  warning: "warning",
  hint: "note",
};

/** A path as a SARIF artifact URI: relative paths stay relative, with forward slashes. */
const uriOf = (path: string) => (path === "-" ? "stdin" : encodeURI(path.replaceAll("\\", "/")));

/**
 * A SARIF 2.1.0 log, for code scanning. Columns count UTF-16 units, SARIF's default, which is also what
 * the findings count.
 */
export function sarifReport(files: readonly CheckedFile[], ui: UiLang): string {
  const used = [...new Set(files.flatMap((file) => file.findings.map((finding) => finding.ruleId)))].sort();
  const index = new Map(used.map((id, position) => [id, position]));
  const rules = used.map((id) => {
    const meta = ruleMeta(id);
    return {
      id,
      name: id.replace(/[^A-Za-z0-9]+(.)?/g, (_, next: string | undefined) => (next ?? "").toUpperCase()),
      shortDescription: { text: meta.message[ui].replace(/\{(\w+)\}/g, "…").replace(/…\.$/, "…") },
      fullDescription: { text: meta.reason[ui] },
      helpUri: ruleUrl(id),
      help: {
        text: [
          meta.reason[ui],
          ...meta.examples.map((example) => `${example.wrong} → ${example.right}`),
        ].join("\n"),
      },
      defaultConfiguration: { level: LEVEL[meta.severity] },
      properties: { category: meta.category, lang: meta.lang, tags: [meta.category, meta.lang] },
    };
  });
  const results = files.flatMap((file) =>
    file.findings.map((finding) => {
      const uri = uriOf(file.path);
      const region = {
        startLine: finding.line,
        startColumn: finding.column,
        endLine: finding.endLine,
        endColumn: finding.endColumn,
        charOffset: finding.range.start,
        charLength: finding.range.end - finding.range.start,
        snippet: { text: finding.text },
      };
      return {
        ruleId: finding.ruleId,
        ruleIndex: index.get(finding.ruleId),
        level: LEVEL[finding.severity],
        message: { text: renderMessage(finding.message, ui) },
        locations: [{ physicalLocation: { artifactLocation: { uri }, region } }],
        // The same mistake in the same words keeps its fingerprint when lines move.
        partialFingerprints: {
          "zimanyar/v1": createHash("sha256")
            .update(`${finding.ruleId}\0${finding.text}`)
            .digest("hex")
            .slice(0, 32),
        },
        ...(finding.suggestions.length > 0
          ? {
              fixes: finding.suggestions.map((suggestion) => ({
                description: { text: suggestion.text },
                artifactChanges: [
                  {
                    artifactLocation: { uri },
                    replacements: [{ deletedRegion: region, insertedContent: { text: suggestion.text } }],
                  },
                ],
              })),
            }
          : {}),
      };
    }),
  );
  return `${JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Zimanyar",
              semanticVersion: VERSION,
              version: VERSION,
              informationUri: SITE,
              rules,
            },
          },
          columnKind: "utf16CodeUnits",
          results,
        },
      ],
    },
    null,
    2,
  )}\n`;
}
