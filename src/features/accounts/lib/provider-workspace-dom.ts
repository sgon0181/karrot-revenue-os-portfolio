export type WorkspaceDomEnvironment = {
  document: Pick<
    Document,
    | "activeElement"
    | "body"
    | "getElementById"
    | "addEventListener"
    | "removeEventListener"
  >;
  window: Pick<
    Window,
    | "addEventListener"
    | "removeEventListener"
    | "requestAnimationFrame"
    | "cancelAnimationFrame"
    | "setTimeout"
    | "clearTimeout"
  >;
  MutationObserver: typeof MutationObserver;
  HTMLElement: typeof HTMLElement;
};

function browserEnvironment(): WorkspaceDomEnvironment {
  return { document, window, MutationObserver, HTMLElement };
}

export function focusWorkspaceAnchor(
  anchorId: string,
  environment: WorkspaceDomEnvironment = browserEnvironment(),
) {
  const target = environment.document.getElementById(anchorId);
  if (!(target instanceof environment.HTMLElement)) return false;

  target.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
  const needsTemporaryTabIndex = !target.matches(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex], [contenteditable='true']",
  );
  if (needsTemporaryTabIndex) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });

  if (needsTemporaryTabIndex) {
    target.addEventListener(
      "blur",
      () => {
        if (target.getAttribute("tabindex") === "-1") {
          target.removeAttribute("tabindex");
        }
      },
      { once: true },
    );
  }
  return true;
}

/**
 * Focuses a deep-link target once it exists and Next has had two frames to
 * settle. Any user focus/input or intervening navigation cancels the pending
 * work so delayed reconciliation cannot steal focus.
 */
export function focusWorkspaceAnchorWhenReady(
  anchorId: string,
  onFocused: () => void,
  environment: WorkspaceDomEnvironment = browserEnvironment(),
) {
  const existingTarget = environment.document.getElementById(anchorId);
  const existingFocus = environment.document.activeElement;
  if (
    existingFocus instanceof environment.HTMLElement
    && existingFocus !== environment.document.body
    && existingFocus !== existingTarget
    && existingFocus.id !== "main-content"
  ) {
    return () => {};
  }

  let stopped = false;
  let focused = false;
  let applyingFocus = false;
  let firstFrame: number | null = null;
  let secondFrame: number | null = null;
  let timeoutId: number | null = null;

  const userEvents = ["pointerdown", "keydown", "input", "focusin"] as const;
  const navigationEvents = ["hashchange", "popstate", "pagehide"] as const;
  const observer = new environment.MutationObserver(() => scheduleAttempt());

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    if (firstFrame !== null) environment.window.cancelAnimationFrame(firstFrame);
    if (secondFrame !== null) environment.window.cancelAnimationFrame(secondFrame);
    if (timeoutId !== null) environment.window.clearTimeout(timeoutId);
    for (const eventName of userEvents) {
      environment.document.removeEventListener(eventName, yieldToInteraction, true);
    }
    for (const eventName of navigationEvents) {
      environment.window.removeEventListener(eventName, yieldToInteraction);
    }
  };

  const yieldToInteraction = () => {
    if (!applyingFocus) stop();
  };

  const attemptFocus = () => {
    if (stopped || focused) return;
    applyingFocus = true;
    const didFocus = focusWorkspaceAnchor(anchorId, environment);
    applyingFocus = false;
    if (!didFocus) return;

    focused = true;
    onFocused();
    stop();
  };

  function scheduleAttempt() {
    if (stopped || focused || firstFrame !== null || secondFrame !== null) return;
    firstFrame = environment.window.requestAnimationFrame(() => {
      firstFrame = null;
      secondFrame = environment.window.requestAnimationFrame(() => {
        secondFrame = null;
        attemptFocus();
      });
    });
  }

  for (const eventName of userEvents) {
    environment.document.addEventListener(eventName, yieldToInteraction, true);
  }
  for (const eventName of navigationEvents) {
    environment.window.addEventListener(eventName, yieldToInteraction);
  }
  observer.observe(environment.document.body, { childList: true, subtree: true });
  timeoutId = environment.window.setTimeout(stop, 4_000);
  scheduleAttempt();
  return stop;
}
