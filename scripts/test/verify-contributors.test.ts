import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, run } from "./helpers.js";

const script = `${ROOT}/scripts/release/verify-contributors.sh`;

/** A throwaway repository with the guard scripts and an allow list. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "zimanyar-repo-"));
  const git = (args: string[], env: NodeJS.ProcessEnv = {}) => run("git", args, dir, env);
  git(["init", "-q", "-b", "main"]);
  run("mkdir", ["-p", "scripts/release", ".github"], dir);
  run(
    "cp",
    [
      `${ROOT}/scripts/release/verify-attribution.sh`,
      `${ROOT}/scripts/release/verify-contributors.sh`,
      "scripts/release/",
    ],
    dir,
  );
  writeFileSync(join(dir, ".github/allowed-authors.txt"), "# maintainer\nmaintainer@example.org\n");
  const commit = (message: string, email = "maintainer@example.org", committer = email) => {
    writeFileSync(join(dir, `f${Math.random()}`), "x");
    git(["add", "-A"]);
    return git(["commit", "-q", "--no-verify", "-m", message], {
      GIT_AUTHOR_NAME: "A",
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: "C",
      GIT_COMMITTER_EMAIL: committer,
    });
  };
  const verify = () => run(`${dir}/scripts/release/verify-contributors.sh`, ["--all"], dir);
  return { dir, commit, verify };
}

describe("verify-contributors.sh", () => {
  it("accepts commits by the maintainer", () => {
    const repo = makeRepo();
    repo.commit("feat: one");
    repo.commit("fix: two");
    expect(repo.verify().status).toBe(0);
  });

  it("rejects an unknown author", () => {
    const repo = makeRepo();
    repo.commit("feat: one", "someone@example.org");
    expect(repo.verify().stderr).toContain("author <someone@example.org>");
  });

  it("rejects a Claude co-author trailer", () => {
    const repo = makeRepo();
    repo.commit("feat: one\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
    const result = repo.verify();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("credits an AI assistant or a bot");
  });

  it("rejects a Dependabot configuration in the tree", () => {
    const repo = makeRepo();
    writeFileSync(join(repo.dir, ".github/dependabot.yml"), "version: 2\n");
    repo.commit("chore: deps");
    expect(repo.verify().stderr).toContain("dependabot.yml must not exist");
  });

  it("rejects GitHub as committer of a non-merge commit", () => {
    const repo = makeRepo();
    repo.commit("feat: web edit", "maintainer@example.org", "noreply@github.com");
    expect(repo.verify().status).toBe(1);
  });

  it("checks the real history", () => {
    expect(run(script, ["--all"]).status).toBe(0);
  });
});
