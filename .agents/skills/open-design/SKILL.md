---
name: open-design
description: |
  Master conductor for the Open Design framework. Routes the user through
  the full OD loop — discovery lock → direction picker → skill selection
  → seed-template build → 5-dimension self-critique — and delegates to
  the correct sub-skill (web-prototype, dashboard, deck, critique, etc.).
  Use when the user asks for "open design", "OD", "design something",
  "build a landing page/deck/app", or any request that fits the
  artifact-first mental model.
triggers:
  - "open design"
  - "OD"
  - "design something"
  - "build a landing page"
  - "build a deck"
  - "design a prototype"
  - "make a mockup"
  - "generate a poster"
  - "create a dashboard"
  - "artifact-first"
od:
  mode: prototype
  platform: any
  scenario: design
  preview:
    type: html
    entry: index.html
  design_system:
    requires: true
    sections: [color, typography, layout, components]
  example_prompt: |
    Use Open Design to build a SaaS landing page for a developer-tools
    startup. Pick Tech Utility direction, Stripe design system, then
    self-critique the output.
---

# Open Design · Master Conductor Skill

This skill is the entry point to the **Open Design (OD)** framework.
It does not generate pixels itself — it **orchestrates** the workflow
and delegates to the right sub-skill.

## Resource map

```
open-design/
├── SKILL.md                 ← you're reading this (conductor)
├── references/
│   ├── workflow.md          ← full OD loop checklist
│   └── skill-catalog.md     ← sub-skill picker matrix
└── assets/
    └── discovery-form.html  ← boilerplate discovery form (copy/paste)
```

## Philosophy (read once)

Open Design is **artifact-first, local-first, BYOK**.

- **Artifact-first** — the agent ships a real, self-contained HTML
  artifact every turn, not prose explanations.
- **Local-first** — everything runs on the user's machine via their
  existing coding-agent CLI (Claude Code, Codex, Cursor, Qoder, etc.).
- **BYOK** — bring your own API keys; no cloud lock-in.

The loop is deterministic: **Discovery → Direction → Skill → Seed →
Critique**. No freestyle before the brief is locked.

## Workflow

### Step 1 — Discovery lock (mandatory)

Before writing a single pixel, ask the user (or infer from context):

| Question | Why it matters |
|---|---|
| **Surface** | Desktop web · mobile app · deck · poster · email · image |
| **Audience** | Who will consume this? (execs, engineers, end-users) |
| **Tone** | Editorial / playful / corporate / brutal / soft |
| **Brand context** | Existing brand guide? Colors? Fonts? Logo? |
| **Scale** | One page · 5-screen prototype · 20-slide deck |

If the user already provided a detailed brief, skip the form and
extract these five fields into a concise `brief.md` paragraph.

### Step 2 — Direction picker (if no brand)

When the user has **no existing brand**, pick one of the five curated
visual directions. Each ships a deterministic OKLch palette + font
stack in `apps/web/src/prompts/directions.ts`.

| Direction | Mood | Palette | Fonts |
|---|---|---|---|
| **Editorial Monocle** | Quiet luxury, print-magazine | Warm neutrals, olive accent | Serif display + mono labels |
| **Modern Minimal** | Swiss clarity, whitespace | Cool greys, single accent | Clean sans, generous leading |
| **Warm Soft** | Friendly SaaS, approachable | Pastels, cream backgrounds | Rounded sans, soft shadows |
| **Tech Utility** | Developer tools, data-dense | Slate, electric accent | Monospace + compact sans |
| **Brutalist Experimental** | Bold, anti-generic, raw | High contrast, clashing accents | System fonts, visible grids |

**Rule:** pick by *mood* matching the brief, not by personal
preference. Once picked, every micro-decision (chrome, kicker,
spacing, accent) must argue for that direction.

### Step 3 — Skill selection

Map the brief to **one** sub-skill. Do not combine multiple skills in
one turn.

| Brief shape | Sub-skill | Entry point |
|---|---|---|
| Landing / marketing / homepage | `web-prototype` | `skills/web-prototype/SKILL.md` |
| SaaS product page | `saas-landing` | `skills/saas-landing/SKILL.md` |
| Data dashboard | `dashboard` | `skills/dashboard/SKILL.md` |
| Mobile screen / app | `mobile-app` | `skills/mobile-app/SKILL.md` |
| Pitch deck / presentation | `guizang-ppt` or `simple-deck` | `skills/guizang-ppt/SKILL.md` |
| Social media carousel | `social-carousel` | `skills/social-carousel/SKILL.md` |
| Magazine poster | `magazine-poster` | `skills/magazine-poster/SKILL.md` |
| Motion / animation | `motion-frames` | `skills/motion-frames/SKILL.md` |
| Image generation (poster, avatar) | `image-poster` | `skills/image-poster/SKILL.md` |
| Video shortform | `video-shortform` | `skills/video-shortform/SKILL.md` |
| Design review / audit | `critique` | `skills/critique/SKILL.md` |
| Tweaks on existing artifact | `tweaks` | `skills/tweaks/SKILL.md` |
| Wireframe / low-fi sketch | `wireframe-sketch` | `skills/wireframe-sketch/SKILL.md` |
| Spec doc / PRD | `pm-spec` | `skills/pm-spec/SKILL.md` |
| Engineering runbook | `eng-runbook` | `skills/eng-runbook/SKILL.md` |
| Finance report | `finance-report` | `skills/finance-report/SKILL.md` |
| HR onboarding page | `hr-onboarding` | `skills/hr-onboarding/SKILL.md` |
| Invoice / receipt | `invoice` | `skills/invoice/SKILL.md` |
| Kanban board | `kanban-board` | `skills/kanban-board/SKILL.md` |
| Team OKRs | `team-okrs` | `skills/team-okrs/SKILL.md` |
| Blog post layout | `blog-post` | `skills/blog-post/SKILL.md` |
| Email marketing | `email-marketing` | `skills/email-marketing/SKILL.md` |
| Pricing page | `pricing-page` | `skills/pricing-page/SKILL.md` |
| Docs / documentation site | `docs-page` | `skills/docs-page/SKILL.md` |
| Meeting notes | `meeting-notes` | `skills/meeting-notes/SKILL.md` |
| Digital e-guide | `digital-eguide` | `skills/digital-eguide/SKILL.md` |
| Dating / social web | `dating-web` | `skills/dating-web/SKILL.md` |
| Game / gamified UI | `gamified-app` | `skills/gamified-app/SKILL.md` |
| Sprite animation | `sprite-animation` | `skills/sprite-animation/SKILL.md` |
| Audio jingle | `audio-jingle` | `skills/audio-jingle/SKILL.md` |
| Weekly update deck | `weekly-update` | `skills/weekly-update/SKILL.md` |
| HTML PPT (any sub-variant) | `html-ppt-*` | `skills/html-ppt-*/SKILL.md` |
| HyperFrames (HTML→MP4) | `hyperframes` | `skills/hyperframes/SKILL.md` |

**After picking a sub-skill:**
1. Read its `SKILL.md` fully.
2. Follow its workflow verbatim — do not improvise outside its
   instructions.
3. Use the active `DESIGN.md` tokens; do not invent new color or font
   variables.

### Step 4 — Design system attachment

Every OD artifact is built against a **design system**.

- If the user provided a brand guide, use that.
- Otherwise, pick one from the built-in catalog under
  `design-systems/` (e.g., `linear`, `stripe`, `vercel`, `apple`,
  `notion`, `airbnb`, `tesla`, `anthropic`, `cursor`, `supabase`).
- Read the chosen system's `DESIGN.md` and map its six `:root` tokens
  into the seed template.

**Rule:** never introduce a 7th color or a 3rd font family. The
constraint is the point.

### Step 5 — Anti-AI-slop checklist (pre-flight)

Before emitting the artifact, verify:

- [ ] **No generic gradient backgrounds** unless the direction
  explicitly calls for them.
- [ ] **No floating 3D icons** from Undraw/Storyset unless the brief
  asks for illustration.
- [ ] **No "empowering" SaaS copy** — "unlock your potential",
  "supercharge your workflow", "AI-powered insights" are banned.
- [ ] **One direction, not three** — every element must argue for the
  same thesis. No mood whiplash.
- [ ] **Hierarchy is readable** — a stranger knows what to read first,
  second, third without being told.
- [ ] **Alignment is precise** — no 2px drift between columns, no
  floating baselines.

### Step 6 — 5-dimension self-critique (optional but recommended)

After generating the artifact, run the `critique` skill on yourself
before the user sees it. This catches issues while they're still
 cheap to fix.

Read `skills/critique/SKILL.md` and score your artifact across:
1. Philosophy consistency
2. Visual hierarchy
3. Detail execution
4. Functionality
5. Innovation

**If the mean score is below 6:** fix the P0 issues before emitting.
**If the mean is 6–7:** emit with a note that it's "functional but
not exceptional".  
**If the mean is 8+:** ship it.

## Output contract

When the user says "use Open Design", you do **not** output prose.
You output:

1. A one-sentence plan: "OD loop: {surface} · {direction} ·
   {sub-skill} · {design-system}."
2. The discovery fields (or confirmation that the brief is already
   locked).
3. A single `<artifact type="text/html">` (or the correct artifact
   type for the sub-skill) built by delegating to the sub-skill.

No "here is my approach" essays. The artifact is the argument.

## Hard rules

- **Never skip discovery.** If the brief is vague, ask the five
  questions before picking a direction.
- **Never mix directions.** Editorial Monocle + Brutalist Experimental
  in the same artifact is a bug.
- **Never invent tokens.** Use exactly the six `:root` variables from
  the active DESIGN.md.
- **Never output multiple skills in one turn.** One skill → one
  artifact → one critique cycle.
- **Never critique in the same turn as generation.** The user must see
  the artifact first, then request a review.