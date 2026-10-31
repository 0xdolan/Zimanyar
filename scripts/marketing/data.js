// Content of the marketing images. Every Kurdish example, finding, rule id and
// lesson below is real: the rules come from the PRD catalogue (section 6), the
// IPA was computed with zimankit, and the lessons exist in zimankit's tutorials.
// Keep it that way: never put an invented rule or a wrong form into an image.

window.Z = {
  copy: {
    en: {
      headline: "Write Kurdish with confidence.",
      sub: "Zimanyar finds mistakes in Sorani and Kurmanji, explains why they are wrong, and teaches you the grammar.",
      chips: ["Sorani & Kurmanji", "Explains every fix", "Lessons built in", "Offline & private"],
      footer: "<b>Chrome · Firefox · Safari · Linux</b> · free and open source (GPL-3.0)",
      short: "Kurdish grammar checker and teacher",
    },
    ckb: {
      headline: "بە متمانەوە بە کوردی بنووسە.",
      sub: "زمانیار هەڵەکانی سۆرانی و کورمانجی دەدۆزێتەوە، هۆکارەکەیان ڕوون دەکاتەوە و ڕێزمانت فێر دەکات.",
      chips: ["سۆرانی و کورمانجی", "ڕوونکردنەوەی هەر هەڵەیەک", "وانەی ڕێزمان", "بێ ئینتەرنێت"],
      footer: "<b>Chrome · Firefox · Safari · Linux</b> · بێبەرامبەر و سەرچاوەکراوە",
      short: "پشکنەر و مامۆستای ڕێزمانی کوردی",
    },
    kmr: {
      headline: "Bi bawerî kurdî binivîse.",
      sub: "Zimanyar şaşiyên soranî û kurmancî dibîne, sedema wan şirove dike û rêzimanê hînî te dike.",
      chips: ["Soranî û kurmancî", "Her şaşî tê şirovekirin", "Dersên rêzimanê", "Bê înternet"],
      footer: "<b>Chrome · Firefox · Safari · Linux</b> · belaş û çavkaniya vekirî",
      short: "Kontrolkar û mamosteyê rêzimana kurdî",
    },
  },
  chipColours: ["var(--sun)", "var(--green)", "var(--blue)", "var(--red)"],

  // Sorani: one sentence with three real findings.
  ckb: {
    url: "news-site.example / draft",
    // segments: plain text or {t: text, k: class, id}
    text: [
      "دوێنێ لە ", { t: "وێستگه", k: "orth", id: "station" }, " ", { t: "دەرگاەکە", k: "err active", id: "door" },
      " داخرابوو. من ", { t: "نان خواردم", k: "warn", id: "agent" }, " و گەڕامەوە.",
    ],
    english: "Yesterday the door at the station had been closed. I ate bread and went back.",
    findings: {
      door: {
        severity: "error", rule: "ckb.morph.definite-allomorph",
        msg: "After a vowel, “the” is ـکە, not ـەکە",
        why: "دەرگا ends in the vowel ا, so the definite ending is ـکە. Use ـەکە only after a consonant (پیاوەکە).",
        fixes: [{ t: "دەرگاکە", ipa: "dæɾɡaːkæ" }],
        examples: [["دەرگاەکە", "دەرگاکە"], ["مامۆستاەکە", "مامۆستاکە"]],
        lessons: ["Sorani 7 · Nouns: the, a, and plurals", "Sorani 3 · Vowels"],
      },
      agent: {
        severity: "warning", rule: "ckb.verb.agent-misplaced",
        msg: "The agent clitic goes on the object",
        why: "In the past tense of a transitive verb, ـم (“I”) attaches to the first word before the verb: the object نان.",
        fixes: [{ t: "نانم خوارد", ipa: "naːn(ɯ)m xwaːɾd" }],
        examples: [["من نان خواردم", "من نانم خوارد"]],
        lessons: ["Sorani 14 · Past tense and ergativity", "Sorani 22 · Clitic placement"],
      },
      station: {
        severity: "orthography", rule: "ckb.spell.variant",
        msg: "Legacy spelling: ه used for the vowel ە",
        why: "Old keyboards typed ه for ە. The standard spelling ends in ە.",
        fixes: [{ t: "وێستگە", ipa: "weːstɡæ" }],
        examples: [["وێستگه", "وێستگە"]],
        lessons: ["Sorani 23 · The written standard"],
      },
    },
  },

  // Kurmanji: split ergativity, case after a preposition, a Turkish letter.
  kmr: {
    url: "mail.example / new message",
    text: [
      "Duh min tu li bazarê ", { t: "dîtim", k: "err active", id: "agree" }, ". Ez ê sibê li ",
      { t: "mal", k: "warn", id: "case" }, " bim. Niha ez ", { t: "dıçım", k: "orth", id: "turkish" }, " dibistanê.",
    ],
    english: "Yesterday I saw you at the market. Tomorrow I will be at home. Now I am going to school.",
    findings: {
      agree: {
        severity: "error", rule: "kmr.ergative.agreement",
        msg: "In the past, the verb agrees with the object",
        why: "dîtin is transitive, so its past tense is ergative: the agent min is oblique and the verb takes the person of the object tu (2sg).",
        fixes: [{ t: "dîtî", ipa: "diːtiː" }],
        examples: [["Min tu dîtim.", "Min tu dîtî."], ["Te ez dîtî.", "Te ez dîtim."]],
        lessons: ["Kurmanji 14 · Split ergativity", "Kurmanji 22 · Agreement in depth"],
      },
      case: {
        severity: "warning", rule: "kmr.morph.case-after-preposition",
        msg: "After li, the noun is oblique",
        why: "mal is feminine, so its oblique form ends in -ê.",
        fixes: [{ t: "malê", ipa: "maːleː" }],
        examples: [["li mal", "li malê"], ["bi keç re", "bi keçê re"]],
        lessons: ["Kurmanji 9 · Direct and oblique case", "Kurmanji 16 · Prepositions"],
      },
      turkish: {
        severity: "orthography", rule: "kmr.orth.turkish-letter",
        msg: "ı is a Turkish letter",
        why: "The Hawar alphabet writes i with a dot.",
        fixes: [{ t: "diçim", ipa: "dɪtʃɯm" }],
        examples: [["dıçım", "diçim"]],
        lessons: ["Kurmanji 23 · The written standard"],
      },
    },
  },

  // Kurmanji lesson 14 paradigm, from zimankit's generated tables.
  lesson: {
    crumbs: "Learn · Kurmanji · 🟡 Intermediate",
    title: "14. The past tense II: transitive verbs and split ergativity",
    intro: "In the past tenses of a transitive verb the agent is oblique, the object is direct, and the verb agrees with the object.",
    rows: [
      ["1sg", "min", "ez", "dîtim", "دیتم"],
      ["2sg", "te", "tu", "dîtî", "دیتی"],
      ["3sg", "wî / wê", "ew", "dît", "دیت"],
      ["pl", "me / we / wan", "em / hûn / ew", "dîtin", "دیتن"],
    ],
    toc: [
      ["🟢", "9. Direct and oblique case"], ["🟢", "10. The present tense"], ["🟡", "13. Past tense I"],
      ["🟡", "14. Split ergativity", true], ["🟡", "15. Past progressive"], ["🔴", "22. Agreement in depth"],
    ],
  },

  cli: [
    '<span class="p">$</span> zimanyar check --lang kmr email.txt',
    '<span class="m">email.txt</span>',
    '  1:22  <span class="e">error</span>    dîtim → <span class="g">dîtî</span>     verb agrees with the object  <span class="m">kmr.ergative.agreement</span>',
    '  1:42  <span class="w">warning</span>  mal → <span class="g">malê</span>       oblique after li             <span class="m">kmr.morph.case-after-preposition</span>',
    '  1:59  <span class="w">orthog.</span>  dıçım → <span class="g">diçim</span>   Turkish ı                    <span class="m">kmr.orth.turkish-letter</span>',
    '<span class="m">3 findings · learn: zimanyar lesson kmr 14</span>',
  ],
};
