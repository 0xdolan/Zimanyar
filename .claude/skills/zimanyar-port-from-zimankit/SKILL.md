---
name: zimanyar-port-from-zimankit
description: Port a zimankit (Python) function or module to @zimanyar/core (TypeScript) with identical behaviour, proven by parity fixtures exported with uv. Use for any work in packages/core that mirrors zimankit, and when a parity test fails.
---

# Porting from zimankit

zimankit (`github.com/0xdolan/zimankit`, same author, GPL-3.0-or-later) is the linguistic
source of truth. `@zimanyar/core` is a faithful port; parity fixtures decide what is correct.

## Steps

1. **Read the Python completely**: the function, every helper it calls, its data files and
   its tests. Note the edge cases the tests pin down.
2. **Map the module** to its TypeScript home (for example `skills_ckb/morphology.py` becomes
   `packages/core/src/ckb/morphology.ts`). Keep function names in camelCase
   (`normalize_word` becomes `normalizeWord`) and keep the data shapes.
3. **Write the TypeScript** with the same behaviour, including the odd parts. Strict types,
   no `any`, no DOM, browser or Node-only APIs (the core runs in workers, Node and Tauri).
4. **Unicode care.** Python strings index code points; JavaScript strings index UTF-16 code
   units. Offsets in the public API are UTF-16. Iterate with `for...of` or `Array.from` where
   Python iterates characters. Python `str.lower()` is not Kurdish-safe; zimankit has its own
   `lower`/`upper` for kmr: port those, never use `toLocaleLowerCase("tr")` or the default.
   Python `re` and JavaScript `RegExp` differ: use the `u` flag, and check `\w`, `\b` and
   case-insensitive matching against non-ASCII letters.
5. **Fixtures.** Extend `scripts/data/export_fixtures.py` (run with `uv run`, never pip or a
   system Python) to export inputs and outputs, then `pnpm --filter @zimanyar/data build`.
6. **Parity test.** Generators, normalisers, IPA, transliteration and validators: 100 %
   equality. Analyzers: at least 99.5 % top-1 equality, with every divergence listed.
7. **Differences.** Fix every divergence, or, when Zimanyar intentionally improves on zimankit
   (see the known limitations backlog), record it in `docs/dev/parity-exceptions.md` with the
   reason and the test.
8. **Benchmark** hot paths in `packages/core/bench/` against the performance budgets.

## Behaviour that must survive the port

- Sorani vowel and consonant decisions are phonological: و and ی after a vowel letter are glides.
- Ambiguity is kept, not resolved early (ckb final ی is `3sg|ezafe`; kmr -ê is m ezafe or f oblique).
- Allomorph choice, kmr stem contraction (têm, nayêm), ni- negation of zanîn and karîn, and the
  ckb passive and ویستن special cases follow zimankit exactly.
