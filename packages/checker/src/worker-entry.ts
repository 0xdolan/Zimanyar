import { loadLexicon } from "@zimanyar/data";
import { Checker } from "./checker.js";
import { createHandler } from "./protocol.js";

/** The thin part that only a real worker can run: messages in and out of createHandler. */
declare const self: {
  addEventListener(type: "message", listener: (event: { data: unknown; origin: string }) => void): void;
  location: { origin: string };
  postMessage(message: unknown): void;
};

const handle = createHandler(new Checker(), loadLexicon);
self.addEventListener("message", (event) => {
  // A message from the page that made this worker has no origin, or its own. Requests are validated as well.
  if (event.origin !== "" && event.origin !== self.location.origin) return;
  void handle(event.data).then((response) => self.postMessage(response));
});
