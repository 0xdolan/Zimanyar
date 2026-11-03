import { renderMessage, type UiLang } from "@zimanyar/rules";
import { type CheckedFile, lessonsFirst } from "../check.js";
import { DATA_VERSION, lessonUrl, VERSION } from "../meta.js";

/** The machine-readable report: version 1 of its shape, which only grows. */
export function jsonReport(files: readonly CheckedFile[], ui: UiLang): string {
  const all = files.flatMap((file) => file.findings);
  const count = (severity: string) => all.filter((finding) => finding.severity === severity).length;
  return `${JSON.stringify(
    {
      version: 1,
      tool: { name: "zimanyar", version: VERSION, data: DATA_VERSION },
      files: files.map((file) => ({
        path: file.path,
        findings: file.findings.map((finding) => ({
          ruleId: finding.ruleId,
          lang: finding.lang,
          category: finding.category,
          severity: finding.severity,
          line: finding.line,
          column: finding.column,
          endLine: finding.endLine,
          endColumn: finding.endColumn,
          start: finding.range.start,
          end: finding.range.end,
          text: finding.text,
          message: renderMessage(finding.message, ui),
          reason: renderMessage(finding.reason, ui),
          suggestions: finding.suggestions.map((suggestion) => suggestion.text),
          safeFix: finding.safeFix,
          confidence: finding.confidence,
          lessons: lessonsFirst(finding).map((lesson) => ({
            lang: lesson.lang,
            lesson: lesson.lessonId,
            title: lesson.title,
            url: lessonUrl(lesson),
          })),
        })),
      })),
      summary: {
        files: files.length,
        errors: count("error"),
        warnings: count("warning"),
        hints: count("hint"),
      },
    },
    null,
    2,
  )}\n`;
}
