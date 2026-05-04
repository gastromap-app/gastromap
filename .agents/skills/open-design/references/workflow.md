# Open Design · Full Workflow Checklist

Copy this checklist and track progress for every OD project.

```
Task Progress:
- [ ] Step 1: Discovery lock (5 fields captured)
- [ ] Step 2: Direction picker (1 of 5 directions chosen, or brand provided)
- [ ] Step 3: Design system selection (DESIGN.md read, 6 tokens mapped)
- [ ] Step 4: Sub-skill selection (SKILL.md read)
- [ ] Step 5: Seed copy + section composition
- [ ] Step 6: Anti-AI-slop pre-flight (6 checks passed)
- [ ] Step 7: Artifact emission
- [ ] Step 8: Self-critique (5 dimensions scored, mean ≥ 6)
- [ ] Step 9: User review + tweak cycle
```

## Step 1 — Discovery lock

Capture these five fields. If any is missing, ask the user.

| Field | Example values |
|---|---|
| Surface | desktop-web · mobile-app · deck · poster · email · image · video |
| Audience | executives · engineers · end-users · investors · designers |
| Tone | editorial · playful · corporate · brutal · soft · technical |
| Brand context | full guide · colors-only · logo-only · none (pick direction) |
| Scale | 1 page · 3–5 screens · 10–20 slides · single image |

## Step 2 — Direction picker

If brand context is "none", pick one direction. Document the choice
in one sentence: "Direction: {name} because {mood-reason}."

## Step 3 — Design system

Pick or receive a design system. Map exactly these six tokens:

```css
:root {
  --bg:        /* page background */
  --surface:   /* card / section background */
  --text:      /* primary text */
  --muted:     /* secondary / meta text */
  --accent:    /* CTA / links / highlights */
  --border:    /* dividers / chrome */
}
```

No seventh variable. No inline hexes outside `:root`.

## Step 4 — Sub-skill

Read the sub-skill's `SKILL.md` end-to-end before writing any code.

## Step 5 — Seed + composition

1. Copy the sub-skill's seed template.
2. Inject the six `:root` tokens.
3. Compose sections using the sub-skill's layout library.
4. Write real copy, not lorem ipsum.

## Step 6 — Pre-flight

Run the anti-AI-slop checklist from `SKILL.md` Step 5.

## Step 7 — Emission

Output a single artifact. Inline all CSS/JS. No external dependencies
except fonts loaded via `<link>`.

## Step 8 — Self-critique

Run `skills/critique/SKILL.md` on the artifact. Fix P0s before showing
the user.

## Step 9 — Tweak cycle

User feedback → `skills/tweaks/SKILL.md` → re-critique → ship.
