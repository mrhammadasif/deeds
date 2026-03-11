# Net Score Progress Bars Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-card net score progress bar inside each portion card (MBH and ZBH) that shows who is winning the month based on Good Deeds − Bad Deeds.

**Architecture:** Three files are touched — HTML gets the bar markup, CSS gets the styles, JS gets the `updateProgressBars()` function that reads the four cached localStorage counts and updates the DOM. No new files are created.

**Tech Stack:** Vanilla JS, plain CSS, no build step. Serve with `python -m http.server 8080` and open `http://localhost:8080` to test.

**Spec:** `docs/superpowers/specs/2026-03-11-net-score-progress-bars-design.md`

---

## Chunk 1: HTML markup + CSS styles

### Task 1: Add net-score-bar HTML to both portion cards

**Files:**
- Modify: `index.html` (lines 41-65 — inside each `.portion` div, after `.stars-container`)

- [ ] **Step 1: Add the net-score-bar block inside the MBH card**

  In `index.html`, locate the closing `</div>` of the MBH stars container (after line 41). Insert the following block **before** the closing `</div>` of `#portion-mbh` (i.e. before line 42):

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

- [ ] **Step 2: Add the net-score-bar block inside the ZBH card**

  Immediately after the ZBH `.stars-container` closing `</div>` (after line 64), insert the following block **before** the closing `</div>` of `#portion-zbh`:

  ```html
          <div class="net-score-bar">
              <div class="net-score-header">
                  <span class="net-score-label">Net Score</span>
                  <span class="net-score-value" id="net-zbh">—</span>
              </div>
              <div class="progress-track">
                  <div class="progress-fill" id="bar-zbh"></div>
              </div>
              <div class="net-score-status" id="status-zbh"></div>
          </div>
  ```

- [ ] **Step 3: Verify markup in browser**

  Start the server: `python -m http.server 8080`
  Open `http://localhost:8080`.
  Log in (or use an approved session).
  Expected: each card now has an unstyled `—` text and an empty bar area below the stars. It will look broken — that's fine, styles come next.

---

### Task 2: Add CSS styles for the net-score-bar

**Files:**
- Modify: `styles.css` (append at the end of the file)

- [ ] **Step 1: Append the net-score-bar styles to `styles.css`**

  Add the following at the very end of `styles.css`:

  ```css
  /* Net Score Progress Bar */
  .net-score-bar {
      width: 100%;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .net-score-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
  }

  .net-score-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--text-muted);
  }

  .net-score-value {
      font-size: 1rem;
      font-weight: 800;
      color: var(--text-muted);
      transition: color 0.3s ease;
  }

  .net-score-value.leading {
      color: var(--good-color);
      text-shadow: 0 0 10px var(--good-glow);
  }

  .progress-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
  }

  .progress-fill {
      height: 100%;
      width: 0%;
      background: rgba(255, 255, 255, 0.25);
      border-radius: 9999px;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
  }

  .progress-fill.leading {
      background: linear-gradient(90deg, #ffd700, #ffaa00);
  }

  .net-score-status {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      text-align: center;
      margin-top: 0.4rem;
      min-height: 1em;
      transition: color 0.3s ease;
  }

  .net-score-status.leading {
      color: var(--good-color);
  }
  ```

- [ ] **Step 2: Verify styles in browser**

  Reload `http://localhost:8080`.
  Expected: each card shows a "NET SCORE" label row, `—` value on the right, an empty muted track bar, and no status text. Cards should still look clean and balanced.

- [ ] **Step 3: Commit markup and styles**

  ```bash
  git add index.html styles.css
  git commit -m "feat: add net-score-bar markup and styles to portion cards"
  ```

---

## Chunk 2: JavaScript logic

### Task 3: Add `updateProgressBars()` and wire it into `updateCounts()`

**Files:**
- Modify: `script.js`

**Context:** `updateCounts()` is at line 347. It has this structure:
```js
async function updateCounts(forceFetch = false) {
  if (!currentUser || !isApproved) return
  try {
    // ... builds promises array, updates DOM from cache ...
    await Promise.all(promises)
    // <-- INSERT updateProgressBars() CALL HERE
  } catch (error) { ... }
}
```

- [ ] **Step 1: Add the `updateProgressBars()` function to `script.js`**

  Append the following function at the **end** of `script.js` (after line 394):

  ```js
  /**
   * Reads the four deed counts from localStorage, computes net scores
   * (Good − Bad) for MBH and ZBH, and updates the progress bar DOM elements.
   * Evaluation order avoids division-by-zero (see spec).
   */
  function updateProgressBars () {
    const mbhGood = parseInt( localStorage.getItem( 'count-mbh-good' ) ) || 0
    const mbhBad  = parseInt( localStorage.getItem( 'count-mbh-bad' ) )  || 0
    const zbhGood = parseInt( localStorage.getItem( 'count-zbh-good' ) ) || 0
    const zbhBad  = parseInt( localStorage.getItem( 'count-zbh-bad' ) )  || 0

    const mbhNet = mbhGood - mbhBad
    const zbhNet = zbhGood - zbhBad

    const mbhValueEl  = document.getElementById( 'net-mbh' )
    const zbhValueEl  = document.getElementById( 'net-zbh' )
    const mbhBarEl    = document.getElementById( 'bar-mbh' )
    const zbhBarEl    = document.getElementById( 'bar-zbh' )
    const mbhStatusEl = document.getElementById( 'status-mbh' )
    const zbhStatusEl = document.getElementById( 'status-zbh' )
    const mbhTitle    = document.querySelector( '#portion-mbh .portion-title' )
    const zbhTitle    = document.querySelector( '#portion-zbh .portion-title' )

    if (
      !mbhValueEl || !zbhValueEl ||
      !mbhBarEl   || !zbhBarEl   ||
      !mbhStatusEl || !zbhStatusEl
    ) return

    // Format net score for display: +5, 0, -2
    const fmt = n => n > 0 ? `+${n}` : `${n}`

    // Helper: set a card to its bar state
    function applyBar ( valueEl, barEl, statusEl, titleEl, titleBase, net, pct, isLeading, statusText ) {
      valueEl.textContent = fmt( net )
      valueEl.className = 'net-score-value' + ( isLeading ? ' leading' : '' )
      barEl.style.width = pct + '%'
      barEl.className = 'progress-fill' + ( isLeading ? ' leading' : '' )
      statusEl.textContent = statusText
      statusEl.className = 'net-score-status' + ( isLeading ? ' leading' : '' )
      if ( titleEl ) titleEl.textContent = titleBase + ( isLeading ? ' 👑' : '' )
    }

    // Branch 1: both nets ≤ 0 — no winner
    if ( mbhNet <= 0 && zbhNet <= 0 ) {
      applyBar( mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet, 0, false, '' )
      applyBar( zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet, 0, false, '' )
      return
    }

    // Branch 2: tied and both positive — gold bars, no crown
    if ( mbhNet === zbhNet ) {
      ;[
        [ mbhValueEl, mbhBarEl, mbhStatusEl, mbhTitle, 'MBH', mbhNet ],
        [ zbhValueEl, zbhBarEl, zbhStatusEl, zbhTitle, 'ZBH', zbhNet ]
      ].forEach( ( [ vEl, bEl, sEl, tEl, base, net ] ) => {
        vEl.textContent = fmt( net )
        vEl.className = 'net-score-value leading'
        bEl.style.width = '100%'
        bEl.className = 'progress-fill leading'
        sEl.textContent = 'Tied ✦'
        sEl.className = 'net-score-status leading'
        if ( tEl ) tEl.textContent = base   // no crown on a tie
      } )
      return
    }

    // Branch 3: one is ahead
    const mbhLeading = mbhNet > zbhNet
    const leaderNet  = mbhLeading ? mbhNet  : zbhNet
    const trailNet   = mbhLeading ? zbhNet  : mbhNet
    const trailPct   = Math.max( 0, ( trailNet / leaderNet ) * 100 )
    const gap        = leaderNet - trailNet

    applyBar(
      mbhLeading ? mbhValueEl : zbhValueEl,
      mbhLeading ? mbhBarEl   : zbhBarEl,
      mbhLeading ? mbhStatusEl : zbhStatusEl,
      mbhLeading ? mbhTitle   : zbhTitle,
      mbhLeading ? 'MBH'      : 'ZBH',
      mbhLeading ? mbhNet     : zbhNet,
      100, true, `Leading by ${gap} ✦`
    )
    applyBar(
      mbhLeading ? zbhValueEl : mbhValueEl,
      mbhLeading ? zbhBarEl   : mbhBarEl,
      mbhLeading ? zbhStatusEl : mbhStatusEl,
      mbhLeading ? zbhTitle   : mbhTitle,
      mbhLeading ? 'ZBH'      : 'MBH',
      mbhLeading ? zbhNet     : mbhNet,
      trailPct, false, `${gap} behind`
    )
  }
  ```

- [ ] **Step 2: Call `updateProgressBars()` inside `updateCounts()` after `await Promise.all(promises)`**

  In `script.js`, find this line inside `updateCounts()`:
  ```js
      await Promise.all( promises )
  ```

  Add the call on the very next line:
  ```js
      await Promise.all( promises )
      updateProgressBars()
  ```

- [ ] **Step 3: Verify in browser — leader scenario**

  Reload `http://localhost:8080`. Log in with an approved account that has deeds.
  Expected:
  - The card with more net-positive good deeds shows a full gold bar, `+N` in gold, "Leading by N ✦" in gold, and a `👑` next to its title.
  - The trailing card shows a proportionally shorter muted bar, its net score in muted colour, and `N behind`.
  - Both bars animate smoothly when they fill.

- [ ] **Step 4: Verify in browser — tie scenario**

  Manually adjust localStorage to simulate a tie:
  Open DevTools → Application → Local Storage → set `count-mbh-good=5`, `count-mbh-bad=2`, `count-zbh-good=5`, `count-zbh-bad=2`. Reload.
  Expected: both bars fill to 100% **with the gold gradient** (not muted white), both net score values show `+3` in gold, both status lines show `Tied ✦` in gold, and neither card title has a crown.

- [ ] **Step 5: Verify in browser — both zero/negative scenario**

  In DevTools Local Storage set `count-mbh-good=1`, `count-mbh-bad=3`, `count-zbh-good=0`, `count-zbh-bad=2`. Reload.
  Expected: both bars are empty (0% width), both values show their net (`-2` and `-2`), no crown, no status text.

- [ ] **Step 6: Verify in browser — one positive, one negative scenario**

  In DevTools Local Storage set `count-mbh-good=4`, `count-mbh-bad=1`, `count-zbh-good=1`, `count-zbh-bad=3`. Reload.
  Expected: MBH shows full gold bar (`+3`), ZBH shows empty bar (`-2`), crown on MBH, "Leading by 5 ✦" / "5 behind" labels.

- [ ] **Step 7: Verify bars update live on new deed**

  From the live app, click a star button to log a deed.
  Expected: after the deed is logged, the bar widths and values update without a page refresh.

- [ ] **Step 8: Commit**

  ```bash
  git add script.js
  git commit -m "feat: add updateProgressBars() to show net score competition indicators"
  ```
