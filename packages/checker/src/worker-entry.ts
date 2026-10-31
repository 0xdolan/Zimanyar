import { loadLexicon } from "@zimanyar/data";
import { Checker } from "./checker.js";
import { createHandler } from "./protocol.js";

/** The thin part that only a real worker can run: messages in and out of createHandler. */
declare const self: {
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
};

const handle = createHandler(new Checker(), loadLexicon);
self.addEventListener("message", (event) => {
  void handle(event.data).then((response) => self.postMessage(response));
});
