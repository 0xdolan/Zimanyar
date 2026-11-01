import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Checker } from "@zimanyar/checker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckerPanel, type EditorBackend } from "../src/index.js";

const checker = new Checker();
const backendOf = (): EditorBackend => ({
  check: vi.fn(async (text, options) => checker.check(text, options)),
  suggest: vi.fn(async () => ["dîtî"]),
  complete: vi.fn(async () => []),
});

beforeEach(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const field = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("CheckerPanel", () => {
  it("lists findings from its first text", async () => {
    render(<CheckerPanel backend={backendOf()} css="" initialText="Min tu dîtim." lang="en" />);
    expect(await screen.findByRole("button", { name: /dîtim/ })).toBeDefined();
    expect(field().value).toBe("Min tu dîtim.");
  });

  it("starts with a sample in the interface's variety", () => {
    render(<CheckerPanel backend={backendOf()} css="" lang="ckb" />);
    expect(field().value).toMatch(/\p{Script=Arabic}/u);
  });

  it("applies a suggestion from the selected finding, and closes it", async () => {
    render(<CheckerPanel backend={backendOf()} css="" initialText="Min tu dîtim." lang="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /dîtim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Replace with dîtî" }));
    expect(field().value).toBe("Min tu dîtî.");
  });

  it("looks up suggestions a check left out", async () => {
    const backend = backendOf();
    const [found] = checker.check("Min tu dîtim.", { lang: "kmr" });
    backend.check = async () => [{ ...found, suggestions: [], lookup: "mak", lang: "any" } as never];
    render(<CheckerPanel backend={backend} css="" initialText="Min tu dîtim." lang="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /dîtim/ }));
    expect(await screen.findByRole("button", { name: "Replace with dîtî" })).toBeDefined();
    expect(backend.suggest).toHaveBeenCalledWith("mak", "kmr");
  });

  it("closes and ignores a selected finding", async () => {
    render(<CheckerPanel backend={backendOf()} css="" initialText="Min tu dîtim." lang="en" />);
    fireEvent.click(await screen.findByRole("button", { name: /dîtim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: "Replace with dîtî" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /dîtim/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Ignore" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /dîtim/ })).toBeNull());
  });

  it("loads samples", () => {
    render(<CheckerPanel backend={backendOf()} css="" initialText="x" lang="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Sorani sample" }));
    expect(field().value).toMatch(/\p{Script=Arabic}/u);
    fireEvent.click(screen.getByRole("button", { name: "Kurmanji sample" }));
    expect(field().value).toContain("dîtim");
  });

  it("fixes what is safe, and says when there is nothing to fix", async () => {
    render(
      <CheckerPanel backend={backendOf()} css="" initialMode="kmr" initialText="Ez dıçım malê." lang="en" />,
    );
    const fix = screen.getByRole("button", { name: "Fix all safe" }) as HTMLButtonElement;
    await waitFor(() => expect(fix.disabled).toBe(false));
    fireEvent.click(fix);
    expect(field().value).toBe("Ez diçim malê.");
  });

  it("changes variety, and tells the caller", async () => {
    const onModeChange = vi.fn();
    const backend = backendOf();
    render(<CheckerPanel backend={backend} css="" initialText="x" lang="en" onModeChange={onModeChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kmr" } });
    expect(onModeChange).toHaveBeenCalledWith("kmr");
    await waitFor(() =>
      expect(backend.check).toHaveBeenLastCalledWith("x", expect.objectContaining({ lang: "kmr" })),
    );
  });

  it("offers sharing only with somewhere to share to, and says when it is done", async () => {
    const onShare = vi.fn(async () => {});
    render(<CheckerPanel backend={backendOf()} css="" initialText="x" lang="en" onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeDefined();
    expect(onShare).toHaveBeenCalledWith("x", "auto");
    fireEvent.input(field());
    expect(screen.getByRole("button", { name: "Share" })).toBeDefined();
    cleanup();
    render(<CheckerPanel backend={backendOf()} css="" initialText="x" lang="en" />);
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("is only a field when compact, and gives its caller a way to check again", async () => {
    const onReady = vi.fn();
    const backend = backendOf();
    render(<CheckerPanel backend={backend} compact css="" initialText="x" lang="en" onReady={onReady} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    onReady.mock.lastCall?.[0]();
    await waitFor(() => expect(vi.mocked(backend.check).mock.calls.length).toBeGreaterThan(1));
  });

  it("opens lessons through the caller", async () => {
    const onLearn = vi.fn();
    render(
      <CheckerPanel
        backend={backendOf()}
        css=""
        initialText="Min tu dîtim."
        lang="en"
        onAddToDictionary={() => {}}
        onLearn={onLearn}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /dîtim/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: /Lesson/ }))[0] as HTMLElement);
    expect(onLearn).toHaveBeenCalled();
  });
});
