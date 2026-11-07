import { router, type Href } from "expo-router";

/** Back with fallback when the stack has no history (deep link / web refresh). */
export function safeBack(fallback: Href = "/") {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
