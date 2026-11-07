import type { UiLang } from "@zimanyar/i18n";

const PREFIX: Record<UiLang, string> = { en: "", ckb: "ckb/", kmr: "kmr/" };

/** One static page per interface language: English at the root, the others under their code. */
export const localePaths = () => [
  { params: { locale: undefined }, props: { lang: "en" as UiLang } },
  { params: { locale: "ckb" }, props: { lang: "ckb" as UiLang } },
  { params: { locale: "kmr" }, props: { lang: "kmr" as UiLang } },
];

/** A path inside the site, in the same interface language. */
export const linkTo = (lang: UiLang, path: string): string =>
  `${import.meta.env.BASE_URL}${PREFIX[lang]}${path}`.replace(/\/+/g, "/");
