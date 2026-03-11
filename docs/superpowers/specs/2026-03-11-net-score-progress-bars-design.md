# Net Score Progress Bars — Design Spec

**Date:** 2026-03-11
**Status:** Approved

## Summary

Add per-card net score progress bars to each portion card (MBH and ZBH) to show who is winning the month. The winner is the person with the highest net score (Good Deeds − Bad Deeds).

## Metric Definition

**Net Score = Good Deed count − Bad Deed count**

- Can be zero or negative.
- The person with the higher net score is the leader.
- Ties: both scores are equal.

## UI Design

### Location
A progress bar section is appended **inside** each `.portion` card, below the existing stars container.

### Components per card
1. **"Net Score" label** (left) — small, muted, uppercase
2. **Net score value** (right) — e.g. `+5`, `0`, `-2`
3. **Progress bar** — full-width, pill-shaped, 8px tall
4. **Status line** below bar — e.g. `Leading by 4 ✦` or `4 behind`

### Bar fill logic
- **Leader's bar:** fills to 100%, gold (`#ffd700 → #ffaa00` gradient)
- **Trailing bar:** fills proportionally: `(trailing net / leader net) * 100%`, muted white (`rgba(255,255,255,0.25)`). Clamp to 0% minimum — never negative.
- **Tied (both equal, > 0):** both bars fill to 100%, gold colour, no crown, status line shows `Tied ✦`
- **Both zero or negative:** both bars at 0% width, `rgba(255,255,255,0.25)` colour, no crown, no status text

### Crown indicator
- A `👑` emoji is appended to the **title** of the leading card (`MBH` → `MBH 👑`)
- Removed from both titles on a tie or when both scores are ≤ 0

### Status line text
| Scenario | Leader text | Trailing text |
|---|---|---|
| Leader ahead | `Leading by N ✦` | `N behind` |
| Tied (> 0) | `Tied ✦` | `Tied ✦` |
| All zero / negative | *(empty)* | *(empty)* |

## Data Flow

Deed counts are already fetched in `updateCounts()` in `script.js` and stored in `localStorage` with keys `count-{portion}-{type}` (e.g. `count-mbh-good`). After all counts are updated, a new function `updateProgressBars()` reads the four localStorage values, computes net scores, and updates the DOM.

`updateProgressBars()` is called inside the `try` block of `updateCounts()`, immediately after `await Promise.all(promises)` — so it always reads the freshest available localStorage values.

**Note on data scope:** `updateCounts()` filters deeds by `user_email: currentUser.email`. The counts therefore reflect deeds logged by the currently logged-in user. This is a pre-existing architecture decision — both MBH and ZBH either share a login or one person tracks both portions. This spec does not change the data fetching logic; it only adds a display layer on top of the existing cached counts.

## Files Changed

| File | Change |
|---|---|
| `index.html` | Add `.net-score-bar` section inside each `.portion` div |
| `styles.css` | Add styles for `.net-score-bar`, `.net-score-header` (flex row), `.progress-track`, `.progress-fill`, `.net-score-label`, `.net-score-value`, `.net-score-status` |
| `script.js` | Add `updateProgressBars()` function; call it at end of `updateCounts()` |

## HTML Structure (per card)

```html
<div class="net-score-bar">
  <div class="net-score-header">
    <span class="net-score-label">Net Score</span>
    <span class="net-score-value" id="net-mbh">—</span>
  </div>
  <div class="progress-track">
    <div class="progress-fill" id="bar-mbh"></div>
  </div>
  <div class="net-score-status" id="status-mbh"></div>
</div>
```

## Edge Cases

- **Negative net scores:** bar stays at 0%, value displayed as e.g. `-2`
- **One person negative, other zero:** neither is a clear winner — treat same as both ≤ 0 (no crown, empty bars)
- **One person positive, other zero or negative:** the positive person is the leader (bar = 100% gold, crown), the other bar stays at 0%
- **First load (counts cached in localStorage):** `updateProgressBars()` is called once immediately after `updateCounts()` returns (which may use cached values). If all four counts are in localStorage, bars render right away. If any count is missing (first ever load), bars show `—` until the Supabase fetch resolves.
- **`null` localStorage values:** if any of the four count keys returns `null`, treat it as `0` (do not bail out). This ensures a partial cache still renders correctly. The HTML initialises the net-score-value elements with `—`; `updateProgressBars()` always overwrites them (with a number or `—` if all four counts are `null`).

### Bar fill evaluation order (explicit)
`updateProgressBars()` must evaluate in this order to avoid division by zero:
1. Parse all four counts from localStorage (null → 0). Compute `mbhNet = mbhGood - mbhBad` and `zbhNet = zbhGood - zbhBad`.
2. **If both nets ≤ 0:** set both bars to 0%, muted colour, no crown, no status text. Stop.
3. **If equal and > 0:** set both bars to 100%, gold, no crown, status = `Tied ✦`. Stop.
4. **Otherwise:** identify leader (higher net). Leader bar = 100%. Trailing bar = `max(0, trailing / leader) * 100%`. Apply crown and status text.

## DOM Selectors

`updateProgressBars()` targets the following element IDs:

| Element | MBH ID | ZBH ID |
|---|---|---|
| Net score value | `net-mbh` | `net-zbh` |
| Progress fill bar | `bar-mbh` | `bar-zbh` |
| Status text | `status-mbh` | `status-zbh` |
| Card title `<h2>` | `#portion-mbh .portion-title` | `#portion-zbh .portion-title` |

The title text is set directly (e.g. `"MBH"` or `"MBH 👑"`) — no extra `id` needed on the `<h2>` since the parent `.portion` already has a unique `id`.
