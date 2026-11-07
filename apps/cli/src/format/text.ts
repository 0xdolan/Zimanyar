import type { Translate } from "@zimanyar/i18n";
import { renderMessage, type Severity, type UiLang } from "@zimanyar/rules";
import { type CheckedFile, lessonsFirst } from "../check.js";
import { lessonUrl } from "../meta.js";
import { type Paint, shown } from "../terminal.js";

/** Findings as a person reads them: file:line:column, severity, message, fix and lesson. */
export function textReport(files: readonly CheckedFile[], ui: UiLang, t: Translate, paint: Paint): string {
  const severity: Readonly<Record<Severity, (text: string) => string>> = {
    error: (text) => paint.red(text),
    warning: (text) => paint.yellow(text),
    hint: (text) => paint.blue(text),
  };
  const label: Readonly<Record<Severity, string>> = {
    error: t("severity.error"),
    warning: t("severity.warning"),
    hint: t("severity.hint"),
  };
  const lines: string[] = [];
  for (const file of files) {
    for (const finding of file.findings) {
      lines.push(
        `${paint.bold(`${shown(file.path)}:${finding.line}:${finding.column}`)}  ${severity[finding.severity](
          label[finding.severity],
        )}  ${shown(renderMessage(finding.message, ui))}  ${paint.dim(finding.ruleId)}`,
      );
      const fix = shown(finding.suggestions.map((suggestion) => suggestion.text).join(", "));
      if (fix !== "") lines.push(`    ${t("cli.check.fix", { text: shown(finding.text), fix })}`);
      const lesson = lessonsFirst(finding)[0];
      if (lesson !== undefined)
        lines.push(`    ${paint.dim(t("cli.check.lesson", { url: lessonUrl(lesson) }))}`);
    }
  }
  const all = files.flatMap((file) => file.findings);
  const count = (kind: Severity) => all.filter((finding) => finding.severity === kind).length;
  if (all.length === 0) {
    lines.push(paint.green(t("cli.check.clean", { files: files.length })));
  } else {
    lines.push(
      "",
      t("cli.check.summary", {
        errors: count("error"),
        warnings: count("warning"),
        hints: count("hint"),
        files: files.length,
      }),
    );
  }
  return `${lines.join("\n")}\n`;
}
