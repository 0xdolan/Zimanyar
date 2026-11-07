import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { caretAfter, fieldFor, isCheckable } from "../src/field.js";

/** jsdom lays nothing out, so each character is drawn as if 10 pixels wide. */
function fakeLayout() {
  Range.prototype.getClientRects = function (this: Range) {
    const left = this.startOffset * 10;
    const right = (this.startContainer === this.endContainer ? this.endOffset : this.startOffset + 1) * 10;
    return [
      { left, right, top: 0, bottom: 20, width: right - left, height: 20 },
      { left, right: left, top: 0, bottom: 20, width: 0, height: 20 },
    ] as unknown as DOMRectList;
  };
}

const make = <Tag extends keyof HTMLElementTagNameMap>(tag: Tag, attributes: Record<string, string> = {}) => {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  document.body.append(element);
  return element;
};

beforeEach(fakeLayout);
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "execCommand");
});

describe("isCheckable", () => {
  it("takes text fields", () => {
    expect(isCheckable(make("textarea"))).toBe(true);
    expect(isCheckable(make("input"))).toBe(true);
    expect(isCheckable(make("input", { type: "search" }))).toBe(true);
    expect(isCheckable(make("div", { contenteditable: "true" }))).toBe(true);
    expect(isCheckable(make("div", { contenteditable: "" }))).toBe(true);
  });

  it("never reads a password or a card number", () => {
    expect(isCheckable(make("input", { type: "password" }))).toBe(false);
    expect(isCheckable(make("input", { autocomplete: "cc-number" }))).toBe(false);
    expect(isCheckable(make("input", { autocomplete: "one-time-code" }))).toBe(false);
    expect(isCheckable(make("input", { autocomplete: "section-a current-password" }))).toBe(false);
    expect(isCheckable(make("textarea", { autocomplete: "new-password" }))).toBe(false);
  });

  it("leaves alone what cannot be edited", () => {
    expect(isCheckable(make("input", { type: "email" }))).toBe(false);
    expect(isCheckable(make("input", { readonly: "" }))).toBe(false);
    expect(isCheckable(make("input", { disabled: "" }))).toBe(false);
    expect(isCheckable(make("textarea", { readonly: "" }))).toBe(false);
    expect(isCheckable(make("textarea", { disabled: "" }))).toBe(false);
    expect(isCheckable(make("div"))).toBe(false);
    expect(isCheckable(make("div", { contenteditable: "false" }))).toBe(false);
  });
});

describe("caretAfter", () => {
  it("stays with its text", () => {
    expect(caretAfter(2, 5, 8, 1)).toBe(2);
    expect(caretAfter(5, 5, 8, 1)).toBe(5);
    expect(caretAfter(8, 5, 8, 1)).toBe(6);
    expect(caretAfter(20, 5, 8, 1)).toBe(18);
    expect(caretAfter(6, 5, 8, 4)).toBe(9);
  });
});

describe("a textarea", () => {
  const setUp = (value = "one two three") => {
    const textarea = make("textarea");
    textarea.value = value;
    const container = make("div");
    return { textarea, container, field: fieldFor(textarea, container) };
  };

  it("reads its text and caret", () => {
    const { textarea, field } = setUp();
    expect(field.text()).toBe("one two three");
    expect(field.caret()).toBeNull();
    textarea.focus();
    textarea.setSelectionRange(4, 4);
    expect(field.caret()).toBe(4);
    textarea.setSelectionRange(4, 7);
    expect(field.caret()).toBeNull();
  });

  it("measures a hidden copy, and leaves out empty boxes", () => {
    const { textarea, container, field } = setUp();
    textarea.scrollTop = 5;
    const [rect, ...others] = field.rects(4, 7);
    expect(others).toEqual([]);
    expect(rect).toEqual({ left: 40, right: 70, top: -5, bottom: 15 });
    const mirror = container.firstElementChild as HTMLElement;
    expect(mirror.textContent).toBe("one two three");
    expect(mirror.style.visibility).toBe("hidden");
    expect(mirror.getAttribute("aria-hidden")).toBe("true");
  });

  it("lays out an input as one line", () => {
    const input = make("input");
    input.value = "one two";
    const container = make("div");
    const field = fieldFor(input, container);
    field.rects(0, 3);
    expect((container.firstElementChild as HTMLElement).style.whiteSpace).toBe("pre");
  });

  it("replaces through the browser's command when it can, keeping undo", () => {
    const { textarea, field } = setUp();
    textarea.focus();
    textarea.setSelectionRange(13, 13);
    const execCommand = vi.fn((_command: string, _ui?: boolean, text?: string) => {
      textarea.setRangeText(text ?? "", textarea.selectionStart, textarea.selectionEnd, "end");
      return true;
    });
    Object.assign(document, { execCommand });
    field.replace(4, 7, "2");
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "2");
    expect(textarea.value).toBe("one 2 three");
    expect(textarea.selectionStart).toBe(11);
  });

  it("deletes with the browser's delete command", () => {
    const { textarea, field } = setUp();
    const execCommand = vi.fn(() => {
      textarea.setRangeText("", textarea.selectionStart, textarea.selectionEnd, "end");
      return true;
    });
    Object.assign(document, { execCommand });
    field.replace(3, 7, "");
    expect(execCommand).toHaveBeenCalledWith("delete");
    expect(textarea.value).toBe("one three");
  });

  it("falls back, and tells the page, when the command does nothing", () => {
    const { textarea, field } = setUp();
    Object.assign(document, { execCommand: () => true });
    const heard = vi.fn();
    textarea.addEventListener("input", heard);
    field.replace(4, 7, "2");
    expect(textarea.value).toBe("one 2 three");
    expect(heard).toHaveBeenCalledOnce();
  });

  it("falls back where there is no command", () => {
    const { textarea, field } = setUp();
    field.replace(0, 3, "1");
    expect(textarea.value).toBe("1 two three");
  });

  it("removes its copy", () => {
    const { container, field } = setUp();
    field.destroy();
    expect(container.childElementCount).toBe(0);
  });
});

describe("a contenteditable element", () => {
  const setUp = (html: string) => {
    const element = make("div", { contenteditable: "true" });
    element.innerHTML = html;
    return { element, field: fieldFor(element, document.body) };
  };

  it("reads inline parts as one text, and blocks and line breaks as lines", () => {
    const { field } = setUp("<p>one <b>two</b></p><p>three<br>four</p>five");
    expect(field.text()).toBe("one two\nthree\nfour\nfive");
  });

  it("leaves out what is not the writer's text", () => {
    const { field } = setUp('a<style>x{}</style><span contenteditable="false">@b</span><script>y</script>c');
    expect(field.text()).toBe("ac");
  });

  it("measures a range through its nodes", () => {
    const { field } = setUp("one <b>two</b>");
    expect(field.rects(0, 3)).toEqual([{ left: 0, right: 30, top: 0, bottom: 20 }]);
    expect(field.rects(4, 7)).toEqual([{ left: 0, right: 30, top: 0, bottom: 20 }]);
  });

  it("measures nothing past the end of the text", () => {
    const { field } = setUp("one");
    expect(field.rects(10, 12)).toEqual([]);
  });

  it("measures nothing in an empty field", () => {
    const { field } = setUp("");
    expect(field.rects(0, 0)).toEqual([]);
    expect(field.caret()).toBeNull();
  });

  it("finds the caret in a text node", () => {
    const { element, field } = setUp("one <b>two</b>");
    const two = element.querySelector("b")?.firstChild as Text;
    document.getSelection()?.collapse(two, 2);
    expect(field.caret()).toBe(6);
  });

  it("finds the caret between elements", () => {
    const { element, field } = setUp("<p>one</p><p>two</p>");
    document.getSelection()?.collapse(element, 1);
    expect(field.caret()).toBe(4);
    document.getSelection()?.collapse(element, 2);
    expect(field.caret()).toBe(field.text().length);
  });

  it("has no caret during a selection or elsewhere", () => {
    const { element, field } = setUp("one");
    const text = element.firstChild as Text;
    document.getSelection()?.setBaseAndExtent(text, 0, text, 2);
    expect(field.caret()).toBeNull();
    const other = make("p");
    other.textContent = "x";
    document.getSelection()?.collapse(other.firstChild, 0);
    expect(field.caret()).toBeNull();
  });

  it("replaces through the browser's command when it can", () => {
    const { element, field } = setUp("one two");
    const execCommand = vi.fn((_command: string, _ui?: boolean, text?: string) => {
      const range = document.getSelection()?.getRangeAt(0) as Range;
      range.deleteContents();
      range.insertNode(document.createTextNode(text ?? ""));
      element.normalize();
      return true;
    });
    Object.assign(document, { execCommand });
    field.replace(4, 7, "2");
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "2");
    expect(element.textContent).toBe("one 2");
  });

  it("falls back, tells the page, and keeps the caret with its text", () => {
    const { element, field } = setUp("one two three");
    document.getSelection()?.collapse(element.firstChild, 13);
    const heard = vi.fn();
    element.addEventListener("input", heard);
    field.replace(4, 7, "2");
    expect(element.textContent).toBe("one 2 three");
    expect(heard).toHaveBeenCalledOnce();
    expect(field.caret()).toBe(11);
  });

  it("replaces across nodes", () => {
    const { element, field } = setUp("one <b>two</b> three");
    field.replace(2, 6, "X");
    expect(element.textContent).toBe("onXo three");
  });

  it("does nothing for a range that is not there", () => {
    const { element, field } = setUp("one");
    field.replace(10, 12, "X");
    expect(element.textContent).toBe("one");
  });

  it("has nothing to clean up", () => {
    const { field } = setUp("one");
    expect(() => field.destroy()).not.toThrow();
  });
});
