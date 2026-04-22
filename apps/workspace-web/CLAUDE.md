# workspace-web

UX principles and conventions for apps/workspace-web. For monorepo context see the repo-root CLAUDE.md.

## UX principles

WCAG 2.2 AA minimums: 4.5:1 contrast on body text, 3:1 on large text and UI components. Test in both light and dark mode.

60-30-10 color rule: neutrals carry 60% of the surface, brand colors 30%, accents (action-primary, semantic states) reserved for ~10% of elements — primary CTAs, active states, critical alerts. Don't let accents become wallpaper.

Hick's Law: every additional visible choice slows decisions. Before adding a button/toggle/menu item, ask if it earns its place.

Fitts's Law: primary actions get larger targets and live near the user's current focus. Never smaller than 44×44px on touch.

Miller's Law: group related controls. Break long lists or forms into sections of ~5-9 items.

Jakob's Law: respect platform conventions before inventing patterns. If standard UI exists for a problem, use it.

Progressive disclosure: hide advanced options behind "Show more" or secondary surfaces. Default view is the common case.

Doherty Threshold: user-initiated actions give feedback in under 400ms — real response or a skeleton/spinner. Never silent.

Consistent iconography, button styles, and interaction patterns across the app. Check nearby components before introducing a new pattern.

Figure-ground: important actions and modals need clear elevation or contrast from their surround. Subtle > heavy — use tint, border, or shadow from existing tokens.

Status feedback: every destructive or persistent action shows success or error state with semantic color tokens.

Error prevention > error messages: confirm destructive actions, disable invalid submits, validate inline.

Keyboard + screen reader: all interactive elements reachable by Tab with visible focus ring. aria-labels where text isn't visible. Test with keyboard only before shipping.

Mobile first in new work: default styles target mobile, add min-width media queries for tablet/desktop.

If a design decision conflicts with one of these principles, surface the tradeoff in the PR plan — don't silently violate.
