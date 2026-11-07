#!/usr/bin/env bash
# Run the installed desktop app on a virtual screen, and show that it starts, stays up and draws.
# Usage: smoke-test.sh [screenshot.png]
set -euo pipefail
trap 'echo "smoke test stopped at line $LINENO" >&2' ERR

if [ "${ZIMANYAR_SMOKE_INSIDE:-}" != "1" ]; then
  home="$(mktemp -d)"
  export HOME="$home" XDG_CONFIG_HOME="$home/config" XDG_DATA_HOME="$home/data" XDG_CACHE_HOME="$home/cache"
  # A container has no GPU, and no user namespaces for WebKit's sandbox.
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
  export ZIMANYAR_SMOKE_INSIDE=1
  exec xvfb-run -a -s "-screen 0 1280x900x24" dbus-run-session -- "$0" "$@"
fi

shot="${1:-}"
log="$HOME/log"
zimanyar-desktop >"$log" 2>&1 &
app=$!

fail() {
  echo "$1:" >&2
  cat "$log" >&2
  exit 1
}

window=""
for _ in $(seq 1 40); do
  kill -0 "$app" 2>/dev/null || fail "the app exited while starting"
  window="$(xdotool search --onlyvisible --name '^Zimanyar$' 2>/dev/null | head -1 || true)"
  [ -z "$window" ] || break
  sleep 0.5
done
[ -n "$window" ] || fail "no window appeared"

# Long enough for the page to draw and the first check to run.
sleep 8
kill -0 "$app" 2>/dev/null || fail "the app died after starting"
[ -z "$shot" ] || import -window root "$shot"
echo "the app started, opened a window and stayed up"

# The real shortcut, with text on the real clipboard: the quick window opens with it.
printf 'Min tu dîtim. Ez dıçım malê.' | xclip -selection clipboard
xdotool key ctrl+alt+k
opened=""
for _ in $(seq 1 20); do
  count="$( (xdotool search --onlyvisible --name '^Zimanyar$' 2>/dev/null || true) | wc -l)"
  if [ "$count" -ge 2 ]; then
    opened=1
    break
  fi
  sleep 0.5
done
[ -n "$opened" ] || fail "the shortcut opened no quick window"
sleep 4
kill -0 "$app" 2>/dev/null || fail "the app died in the quick window"
[ -z "$shot" ] || import -window root "${shot%.png}-quick.png"
if grep -q "no global shortcut" "$log"; then fail "the shortcut could not be registered"; fi
echo "the shortcut opened the quick window"

# Fix what is safe and copy it back, as someone would. With no window manager the quick window sits at the
# top left, so these are where its buttons are. If they move, this fails rather than passing by accident.
xdotool mousemove 262 70 click 1
sleep 1
xdotool mousemove 388 70 click 1
sleep 1
copied="$(xclip -selection clipboard -o 2>&1 || true)"
[ "$copied" = "Min tu dîtim. Ez diçim malê." ] || fail "the clipboard holds: $copied"
echo "the corrected text is back on the clipboard"

kill "$app"
cat "$log"
