# Daylight — Checkpoint 9C Audit

Date: 2026-10-04

## Scope

Make Daylight's core planner paths understandable and operable with a keyboard and common assistive controls, while respecting reduced-motion preferences.

## Findings and corrections

- Added a keyboard-revealed **Skip to planner** link and a focusable main-content target.
- Added a high-contrast focus indicator across buttons, links, inputs, text areas, selects, and other focusable controls.
- Named the planner navigation and exposed its current section with `aria-current`.
- Exposed weekday selection and daily-intensity selection as pressed states.
- Replaced ambiguous spoken names for circle/checkmark controls with task-specific completion actions. Each timeline article is associated with its visible task heading.
- Named the Planner assistant region, its open/close control, conversation log, message field, and brain-dump field.
- Marked decorative icons as hidden from assistive technology where surrounding text already supplies the meaning.
- Added numeric progress semantics to goal and metric progress bars and a programmatic name to the editable points slider.
- Added a reduced-motion rule that effectively removes nonessential transitions and animation when the operating system requests it.

## Verification

- `node --check site/app.js`, `npm test`, `npm run build`, and `git diff --check` passed.
- The production build was served from a new local origin to avoid existing service-worker state.
- Browser inspection confirmed one skip link, one `main#main-content`, a navigation landmark named **Planner sections**, and **Today** exposed as the current page.
- All four visible timeline completion controls had task-specific accessible names.
- Pressing Tab from the document focused **Skip to planner**; pressing Enter moved focus to the main planner region.
- Goals exposed three progress bars with spoken numeric values, and the points slider had a programmatic progress label.
- Collapsing Planner changed its button name to **Open planner assistant** and `aria-expanded` to `false`.
- No visible button in the tested Today and Goals states lacked either text or an explicit accessible name.

## Remaining release checks

- Repeat the audit with at least one desktop screen reader and one mobile screen reader.
- Verify color contrast and zoom/reflow across every secondary review and history state.
- Test installation, offline transitions, microphone permission, and touch behavior on physical iOS and Android devices.

## Draft preview

- Netlify processed draft commit `94ea377` in Preview 1.
- The deployed page exposed **Skip to planner**, a **Planner sections** navigation landmark, **Today** as the current page, and task-specific names on all six visible completion controls.
- The shipped stylesheet contained the visible `:focus-visible` rule and `prefers-reduced-motion` override.

Production remains on checkpoint 4A. Checkpoint 9C is preview-verified; physical-device and screen-reader checks remain release gates.
