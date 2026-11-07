import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

/**
 * The sidebar shows only the part of the site a page is in. A course of 23 lessons is long enough without
 * the other course and the docs beside it, and on hundreds of pages the links saved add up.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const path = context.url.pathname;
  const index = path.includes("/learn/sorani")
    ? 0
    : path.includes("/learn/kurmanji")
      ? 1
      : path.includes("/docs")
        ? 2
        : -1;
  const section = index >= 0 ? route.sidebar[index] : undefined;
  route.sidebar = section?.type === "group" ? section.entries : [];
});
