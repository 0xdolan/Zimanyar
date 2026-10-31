import { allRuleMeta } from "@zimanyar/rules";
import type { ReactNode } from "react";
import {
  analyzeRows,
  type Course,
  ckbAlphabet,
  ergativityRows,
  type FormCell,
  ipaOf,
  kmrAlphabet,
  normalizeRows,
  nounPersons,
  nounReference,
  nounTable,
  OTHER_SCRIPT,
  otherOf,
  SCRIPT_DIR,
  textIpa,
  textOther,
  verbIndexRows,
  verbOf,
  verbOtherForms,
  verbTable,
  vocabularyRows,
  wordRows,
} from "./tables.js";

/** Tables are drawn on the server, as plain HTML: a lesson needs no script to show them. */
const EMPTY = "·";

/** A wide table scrolls by itself, so the keyboard has to be able to reach it. */
const Table = ({ children }: { children: ReactNode }) => (
  // biome-ignore lint/a11y/noNoninteractiveTabindex: it scrolls
  <table tabIndex={0}>{children}</table>
);

/** Text in Kurdish, with its language and direction, whichever script the lesson is in. */
function K({ lang, children, strong }: { lang: Course; children: ReactNode; strong?: boolean }) {
  const text = (
    <span dir={SCRIPT_DIR[lang]} lang={lang}>
      {children}
    </span>
  );
  return strong ? <strong>{text}</strong> : text;
}

/** The other script of a course's word, which is the other direction. */
function Other({ lang, children }: { lang: Course; children: ReactNode }) {
  return lang === "ckb" ? (
    <span dir="ltr" lang="ckb-Latn">
      {children}
    </span>
  ) : (
    <span dir="rtl" lang="kmr-Arab">
      {children}
    </span>
  );
}

const Ipa = ({ children }: { children: ReactNode }) => (
  <span className="zy-ipa" dir="ltr" translate="no">
    {children}
  </span>
);

function FormView({ lang, cell }: { lang: Course; cell: FormCell }) {
  if (cell === null) return <td className="zy-empty">{EMPTY}</td>;
  return (
    <td>
      <K lang={lang} strong>
        {cell.form}
      </K>
      {cell.other !== undefined && (
        <>
          <br />
          <sub>
            <Other lang={lang}>{cell.other}</Other>
          </sub>
        </>
      )}
      {cell.ipa !== undefined && (
        <>
          <br />
          <sub>
            <Ipa>/{cell.ipa}/</Ipa>
          </sub>
        </>
      )}
    </td>
  );
}

function Head({ columns }: { columns: readonly string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export interface VerbTableProps {
  lang: Course;
  verb: string;
  /** Comma separated, as in zimankit's blocks. */
  cells?: string;
  show?: string;
  /** Leave out the line about the stems, on a page that has already said it. */
  noCaption?: boolean;
}

export function VerbTable({
  lang,
  verb,
  cells = "present",
  show = "translit",
  noCaption = false,
}: VerbTableProps) {
  const data = verbTable(lang, verb, cells.split(","), show);
  const heads = [
    "person",
    ...(lang === "kmr" && data.ergative ? ["agent (oblique)", "object (direct)"] : ["pronoun"]),
    ...data.columns,
  ];
  return (
    <>
      {!noCaption && (
        <p>
          <em>
            <K lang={lang}>{verb}</K>
          </em>{" "}
          (<Other lang={lang}>{data.other}</Other>) "{data.meaning}": present stem{" "}
          <K lang={lang} strong>
            {data.present}
          </K>
          , past stem{" "}
          <K lang={lang} strong>
            {data.past}
          </K>
          , {data.transitive ? "transitive" : "intransitive"}
          {data.preverb && (
            <>
              , preverb{" "}
              <K lang={lang} strong>
                {data.preverb}
              </K>
            </>
          )}
        </p>
      )}
      <Table>
        <Head columns={heads} />
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.person}>
              <td>{row.person}</td>
              {row.oblique !== undefined && (
                <td>
                  <K lang={lang}>{row.oblique}</K>
                </td>
              )}
              <td>
                <K lang={lang}>{row.pronoun}</K>
              </td>
              {row.cells.map((cell, index) => (
                <FormView cell={cell} key={data.columns[index]} lang={lang} />
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      {data.ergative && (
        <blockquote>
          {lang === "kmr" ? (
            <p>
              Past tenses of a transitive verb are <strong>ergative</strong>: the agent is oblique and the
              verb agrees with the <strong>object</strong> (the <em>object</em> column), e.g.{" "}
              <em>min tu dîtî</em> "I saw you".
            </p>
          ) : (
            <p>
              Past tenses of a transitive verb are <strong>ergative</strong>: the person marker is the set-2
              clitic (<K lang={lang}>م ت ی مان تان یان</K>) of the <strong>agent</strong>, not a verb ending.
            </p>
          )}
        </blockquote>
      )}
    </>
  );
}

/** The top of a verb's own page. */
export function VerbInfo({ lang, verb }: { lang: Course; verb: string }) {
  const found = verbOf(lang, verb);
  const data = verbTable(lang, verb, ["present"]);
  const rows: [string, ReactNode][] = [
    [
      "infinitive",
      <>
        <K lang={lang} strong>
          {verb}
        </K>{" "}
        (<Other lang={lang}>{data.other}</Other>) <Ipa>/{ipaOf(lang, verb)}/</Ipa>
      </>,
    ],
    ["meaning", data.meaning],
    [
      "present stem",
      <K key="present" lang={lang} strong>
        {found.present}
      </K>,
    ],
    [
      "past stem",
      <K key="past" lang={lang} strong>
        {found.past}
      </K>,
    ],
    ["transitivity", found.transitive ? "transitive, ergative in past tenses" : "intransitive"],
    ...(found.preverb
      ? ([
          [
            "preverb",
            <K key="preverb" lang={lang} strong>
              {found.preverb}
            </K>,
          ],
        ] as [string, ReactNode][])
      : []),
  ];
  return (
    <Table>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function VerbOtherForms({ lang, verb }: { lang: Course; verb: string }) {
  return (
    <Table>
      <Head columns={["form", "Kurdish", OTHER_SCRIPT[lang]]} />
      <tbody>
        {verbOtherForms(lang, verb).map(([label, form]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>
              <K lang={lang} strong>
                {form}
              </K>
            </td>
            <td>
              <Other lang={lang}>{otherOf(lang, form)}</Other>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function NounTable({
  lang,
  nouns,
  cells,
  show = "translit",
}: {
  lang: Course;
  nouns: string;
  cells?: string;
  show?: string;
}) {
  const data = nounTable(lang, nouns.split(","), cells?.split(","), show);
  return (
    <Table>
      <Head columns={["noun", "meaning", ...(data.gender ? ["gender"] : []), ...data.columns]} />
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.noun}>
            <td>
              <K lang={lang} strong>
                {row.noun}
              </K>
            </td>
            <td>{row.meaning}</td>
            {row.gender !== undefined && <td>{row.gender}</td>}
            {row.cells.map((cell, index) => (
              <FormView cell={cell} key={data.columns[index]} lang={lang} />
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function NounPersons({ lang, noun }: { lang: Course; noun: string }) {
  const data = nounPersons(lang, noun);
  return (
    <>
      <p>
        <em>
          <K lang={lang}>{noun}</K>
        </em>{" "}
        "{data.meaning}"
      </p>
      <Table>
        <Head columns={["person", "pronoun", "my/your… + noun", "the noun + clitic"]} />
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.person}>
              <td>{row.person}</td>
              <td>
                <K lang={lang}>{row.pronoun}</K>
              </td>
              <FormView cell={row.bare} lang={lang} />
              <FormView cell={row.definite} lang={lang} />
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

export function NounForms({ lang, noun }: { lang: Course; noun: string }) {
  return (
    <Table>
      <Head columns={["form", "Kurdish", OTHER_SCRIPT[lang]]} />
      <tbody>
        {nounReference(lang, noun).map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>
              <K lang={lang} strong>
                {row.form}
              </K>
            </td>
            <td>
              <Other lang={lang}>{row.other}</Other>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Words({ lang, words }: { lang: Course; words: string }) {
  return (
    <Table>
      <Head columns={["Kurdish", OTHER_SCRIPT[lang], "IPA", "syllables", "meaning"]} />
      <tbody>
        {wordRows(lang, words.split(",")).map((row) => (
          <tr key={row.word}>
            <td>
              <K lang={lang} strong>
                {row.word}
              </K>
            </td>
            <td>
              <Other lang={lang}>{row.other}</Other>
            </td>
            <td>
              <Ipa>/{row.ipa}/</Ipa>
            </td>
            <td>
              <K lang={lang}>{row.syllables}</K>
            </td>
            <td>{row.meaning}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Sentences({
  lang,
  items,
  ipa = false,
}: {
  lang: Course;
  items: readonly (readonly [string, string])[];
  ipa?: boolean;
}) {
  return (
    <Table>
      <Head columns={["#", "Kurdish", OTHER_SCRIPT[lang], ...(ipa ? ["IPA"] : []), "English"]} />
      <tbody>
        {items.map(([kurdish, english], index) => (
          <tr key={kurdish}>
            <td>{index + 1}</td>
            <td>
              <K lang={lang}>{kurdish}</K>
            </td>
            <td>
              <Other lang={lang}>{textOther(lang, kurdish)}</Other>
            </td>
            {ipa && (
              <td>
                <Ipa>{textIpa(lang, kurdish)}</Ipa>
              </td>
            )}
            <td>{english}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Analyze({ lang, words }: { lang: Course; words: string }) {
  return (
    <Table>
      <Head columns={["word", "segmentation", "morpheme tags", "lemma", "features"]} />
      <tbody>
        {analyzeRows(lang, words.split(",")).map((row) => (
          <tr key={row.word}>
            <td>
              <K lang={lang} strong>
                {row.word}
              </K>
            </td>
            <td>
              <K lang={lang}>{row.segmentation}</K>
            </td>
            <td dir="ltr">{row.gloss}</td>
            <td>
              <K lang={lang}>{row.lemma}</K>
            </td>
            <td dir="ltr">{row.features || EMPTY}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Ergativity({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <Table>
      <Head columns={["sentence", "English", "alignment", "agent", "object", "verb agrees with", "check"]} />
      <tbody>
        {ergativityRows(items).map((row) => (
          <tr key={row.sentence}>
            <td>
              <em>
                <K lang="kmr">{row.sentence}</K>
              </em>
            </td>
            <td>{row.english}</td>
            <td>{row.alignment ?? EMPTY}</td>
            <td>{row.agent ? <K lang="kmr">{row.agent}</K> : EMPTY}</td>
            <td>{row.object ? <K lang="kmr">{row.object}</K> : EMPTY}</td>
            <td>
              {row.controller ?? EMPTY} ({row.verbPerson})
            </td>
            <td>{row.agrees ? "✔" : `✘ ${row.notes.join("; ")}`}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Normalize({ lang, items }: { lang: Course; items: readonly (readonly [string, string])[] }) {
  return (
    <Table>
      <Head columns={["typed text", "after normalising", "problems the validator still finds", "note"]} />
      <tbody>
        {normalizeRows(lang, items).map((row) => (
          <tr key={row.raw}>
            <td>
              <K lang={lang}>{row.raw}</K>
            </td>
            <td>
              <K lang={lang}>{row.fixed}</K>
            </td>
            <td>
              {row.problems.length === 0 && EMPTY}
              {row.problems.map((problem, index) => (
                <span key={problem}>
                  {index > 0 && <br />}
                  {problem}
                </span>
              ))}
            </td>
            <td>{row.note}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Alphabet({ lang }: { lang: Course }) {
  if (lang === "ckb") {
    return (
      <Table>
        <Head
          columns={[
            "letter",
            "isolated",
            "initial",
            "medial",
            "final",
            "Latin",
            "IPA",
            "joins left?",
            "example",
            "meaning",
          ]}
        />
        <tbody>
          {ckbAlphabet().map((row) => (
            <tr key={row.letter}>
              <td>
                <K lang="ckb" strong>
                  {row.letter}
                </K>
              </td>
              <td>
                <K lang="ckb">{row.letter}</K>
              </td>
              <td>
                <K lang="ckb">{row.initial}</K>
              </td>
              <td>
                <K lang="ckb">{row.medial}</K>
              </td>
              <td>
                <K lang="ckb">{row.final}</K>
              </td>
              <td>{row.latin ?? EMPTY}</td>
              <td>
                <Ipa>/{row.ipa}/</Ipa>
              </td>
              <td>{row.joins ? "yes" : <strong>no</strong>}</td>
              <td>
                <K lang="ckb">{row.example}</K> (<Other lang="ckb">{row.other}</Other>)
              </td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  }
  return (
    <Table>
      <Head
        columns={[
          "letter",
          "Arabic-script equivalent",
          "IPA",
          "example",
          "example (Arabic script)",
          "meaning",
        ]}
      />
      <tbody>
        {kmrAlphabet().map((row) => (
          <tr key={row.letter}>
            <td>
              <K lang="kmr" strong>
                {row.upper} {row.letter}
              </K>
            </td>
            <td>
              <Other lang="kmr">{row.arabic}</Other>
            </td>
            <td>
              <Ipa>/{row.ipa}/</Ipa>
            </td>
            <td>
              <K lang="kmr">{row.example}</K>
            </td>
            <td>
              <Other lang="kmr">{row.other}</Other>
            </td>
            <td>{row.meaning}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Every verb that has a page, linking to it from the verbs' own folder. */
export function VerbIndex({ lang }: { lang: Course }) {
  return (
    <Table>
      <Head columns={["verb", OTHER_SCRIPT[lang], "meaning", "type", "present", "past (3sg)"]} />
      <tbody>
        {verbIndexRows(lang).map((row) => (
          <tr key={row.infinitive}>
            <td>
              <a href={`${row.slug}/`}>
                <K lang={lang} strong>
                  {row.infinitive}
                </K>
              </a>
            </td>
            <td>
              <Other lang={lang}>{row.other}</Other>
            </td>
            <td>{row.meaning}</td>
            <td>{row.transitive ? "transitive" : "intransitive"}</td>
            <td>{row.present ? <K lang={lang}>{row.present}</K> : EMPTY}</td>
            <td>{row.past ? <K lang={lang}>{row.past}</K> : EMPTY}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function Vocabulary({ lang }: { lang: Course }) {
  const rows = vocabularyRows(lang);
  return (
    <>
      <p>
        Every word used in the lessons ({rows.length} entries). IPA and {OTHER_SCRIPT[lang]} spelling are
        generated by the engine.
      </p>
      <Table>
        <Head
          columns={["Kurdish", OTHER_SCRIPT[lang], "IPA", "meaning", ...(lang === "kmr" ? ["gender"] : [])]}
        />
        <tbody>
          {rows.map((row) => (
            <tr key={row.word}>
              <td>
                <K lang={lang} strong>
                  {row.word}
                </K>
              </td>
              <td>
                <Other lang={lang}>{row.other}</Other>
              </td>
              <td>
                <Ipa>/{row.ipa}/</Ipa>
              </td>
              <td>{row.meaning}</td>
              {lang === "kmr" && <td>{row.note || EMPTY}</td>}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

/** The rules a lesson teaches, from the rules' own metadata. */
export function rulesOfLesson(lang: Course, lesson: number): string[] {
  return allRuleMeta()
    .filter((rule) => rule.lessons.some((ref) => ref.lang === lang && ref.lessonId === lesson))
    .map((rule) => rule.id);
}

export function LessonRules({ lang, lesson }: { lang: Course; lesson: number }) {
  return (
    <ul>
      {rulesOfLesson(lang, lesson).map((id) => (
        <li key={id}>
          <a href={`../../../rules/${id}/`}>
            <code>{id}</code>
          </a>
        </li>
      ))}
    </ul>
  );
}
