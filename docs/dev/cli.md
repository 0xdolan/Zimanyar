# The command line

`apps/cli` is the `zimanyar` command: the checker, the word tools and the lessons for a terminal or a pipeline. Its manual is [`apps/cli/man/zimanyar.1`](../../apps/cli/man/zimanyar.1) (`man ./apps/cli/man/zimanyar.1`).

```sh
make data         # the lexicons
pnpm --filter zimanyar start check README.md    # run it from source
make cli          # bundle it: apps/cli/dist/zimanyar.cjs, with the lexicons in dist/data/
make cli-sea      # one executable with Node and the lexicons inside: apps/cli/dist/zimanyar
make cli-deb      # the .deb, checked by lintian, built in a container
make cli-smoke    # install the .deb in a clean Debian 13 container and use it
make cli-tarball  # the executable, its man page and licences as a .tar.gz
```

## How it is built

`scripts/prepare.ts` writes `generated/`: the version, the data's version, and every lesson rendered once with the lesson components and turned into blocks for the terminal (headings, paragraphs, lists, tables). The command line therefore needs neither MDX nor React, and its tables are the ones the website shows. It runs under `packages/content`'s tsconfig, which is what compiles the components' JSX.

`scripts/build.ts` bundles everything with esbuild into one CommonJS file, the format a Node 24 single executable can embed, and writes `THIRD-PARTY-NOTICES.txt` from the licence of every package inside the bundle, read from the package itself. The npm package is that file, the lexicons, the notices and the man page, with no dependencies to install.

`scripts/sea.ts` makes the single executable: Node's own `--experimental-sea-config` writes the blob, with the lexicons as assets, and `postject` puts it into a copy of `node`. `postject` runs through `pnpm dlx` at an exact version, so it never enters the lockfile or the program. Node is stripped of its symbols first, as it is released with them. The executable is about 110 MB, nearly all of it Node, and needs nothing installed. Its glibc floor is Node's.

The lexicons are looked for inside the executable, then in `ZIMANYAR_DATA`, then beside the bundle, then, from source, where `make data` writes them. Without any, `check` still runs the rules that need no lexicon.

## Debian package

`debian/` is a native source package, `zimanyar-cli`, that installs the executable, the man page, Node's licence and the bundled notices. `packaging/cli/build-deb.sh` builds it in a temporary copy of what it needs, since `dpkg-buildpackage` writes beside the source tree, then runs lintian with warnings as failures. `debian/rules` does not strip the program again, which could cut away the injected bundle. `debian/zimanyar-cli.lintian-overrides` keeps two tags that come from the official Node.js build and change only with a Node.js built from source: its static copy of zlib, and that it is not a position-independent executable.

The `.deb` passed `smoke-test.sh` on Debian 13 and Ubuntu 22.04 and 24.04, and the npm package on Node 22.

## Checking Markdown

A `.md`, `.markdown` or `.mdx` file, or anything with `--markdown`, is parsed with `mdast-util-from-markdown` (GFM and front matter), and every unit outside a text node is replaced with a space, line breaks kept. The text keeps its length, so lines, columns and fixes are those of the file. A finding that covers a blanked unit is dropped: the blanks are not the writer's spacing, and a fix there would change the markup.

## Output

- **text:** `file:line:column`, severity, message and rule, then the fix and a lesson. Colour only on a terminal, off with `NO_COLOR`.
- **json:** version 1 of the shape, which only grows: lines and columns from 1, offsets, the covered text, message and reason in the interface language, suggestions and lessons with their addresses.
- **sarif:** SARIF 2.1.0 with one rule entry for each rule that fired, each linking its page on the website, results with regions and fixes, and a fingerprint from the rule and the covered words, so a finding keeps it when lines move. Columns are UTF-16 code units, SARIF's default and what the checker counts.

Lines and columns count UTF-16 code units everywhere, as the checker's offsets do.

## Exit codes

0 when nothing is at or above `--fail-on` (`error` by default), 1 when something is, 2 for a usage error: an unknown command, option, value, rule or file. A crash, which is a bug, exits with 3.

## Interface language

Every message goes through `t()`. `--ui`, then `ZIMANYAR_UI`, then the locale choose it: `ckb_IQ` is Sorani and `ku_TR` Kurmanji, as glibc names them.

## Network

None. The lesson and rule addresses in reports are text to follow, and nothing in the command opens a connection.
