# Main Screen Sample Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the setup screen with a functional prototype that matches `C:\Users\admin\Downloads\deguri_sample.html` while preserving the existing race and result screens.

**Architecture:** Keep the current single-page game and all JavaScript event wiring intact. Restructure only the `#setup` markup and replace its CSS with selectors scoped beneath `#setup`/`.setup-page`, reusing the existing field names, IDs, character preview images, and submit flow.

**Tech Stack:** HTML5, plain CSS, existing vanilla JavaScript, Three.js, Rapier, GSAP, Vite 8

## Global Constraints

- Modify only the setup-screen presentation; do not redesign the race HUD, countdown, result screen, Three.js scene, or Rapier behavior.
- Use `#FFF9E6` as the cream background and `#F97316` as the orange accent.
- Use existing character PNG assets; do not add Phosphor Icons or another UI dependency.
- Preserve existing DOM IDs and form field names consumed by `code/game.js`.
- Support 360–430px viewport widths without horizontal scrolling.
- Keep touch controls at least 44px and preserve focus indicators, ARIA labels, and reduced-motion support.

---

### Task 1: Build the scoped setup-screen prototype

**Files:**
- Modify: `code/index.html:8-124`
- Modify: `code/index.html:133-152`
- Reference only: `code/game.js:44-74, 1980-2052`

**Interfaces:**
- Consumes: `#setup-form`, `#decision-question`, four `input[name="name"]`, four `select[name="character"]`, `.participant`, `.mini-character-picker`, `.mini-character-preview`, `.character-step[data-direction]`, `#sound-toggle`, `#haptic-toggle`, and `#setup-submit` from the existing JavaScript.
- Produces: The same DOM query results and ordering expected by `code/game.js`, with redesigned presentation contained under `#setup`.

- [ ] **Step 1: Record the current build baseline**

Run:

```powershell
npm.cmd run build
```

Expected: Vite exits with code 0 and creates `dist/index.html` plus `dist/code/index.html`.

- [ ] **Step 2: Replace the setup-specific style layer**

In `code/index.html`, keep the existing race/result rules and replace the current setup overrides with a scoped token block and components equivalent to:

```css
#setup {
  --setup-ink: #18181b;
  --setup-cream: #fff9e6;
  --setup-orange: #f97316;
  --setup-orange-dark: #ea580c;
  display: block;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--setup-ink);
  background: var(--setup-cream);
}

#setup .setup-page {
  width: 100%;
  min-height: 100%;
  padding: max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
  font-family: "Noto Sans KR", Pretendard, system-ui, sans-serif;
  background: var(--setup-cream);
}

#setup .setup-card,
#setup #decision-question,
#setup #setup-submit {
  border: 3px solid var(--setup-ink);
  box-shadow: 4px 4px 0 var(--setup-ink);
}

#setup .character-step,
#setup #setup-submit {
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

#setup .character-step:active,
#setup #setup-submit:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: 1px 1px 0 var(--setup-ink);
}

#setup :focus-visible {
  outline: 4px solid rgb(250 204 21 / 45%);
  outline-offset: 2px;
}
```

Add the remaining scoped rules needed for the top bar, brand pill, centered title, description, overlapping question label, 2×2 cards, pastel card variants, character preview, custom checkboxes, footer button, and decorative shapes. Keep all setup selectors prefixed with `#setup` except the unchanged global reduced-motion rule.

- [ ] **Step 3: Restructure the setup markup without breaking JavaScript contracts**

Replace `code/index.html:133-152` with semantic sections in this exact order:

```html
<section id="setup" class="overlay" aria-labelledby="setup-title">
  <div class="setup-topbar" aria-hidden="true"></div>
  <form id="setup-form" class="setup-page">
    <header class="setup-header">
      <span class="brand-pill">D E G U L - I 🍀</span>
      <h1 id="setup-title">고민은 <em>데굴이</em>에게<br />데굴이가 골라줘!</h1>
      <p id="setup-description">선택지를 적고 캐릭터를 골라주세요.<br />가장 먼저 내려온 데굴이가 하나를 골라줘요.</p>
    </header>
    <section class="question-field" aria-labelledby="question-label">
      <label id="question-label" for="decision-question">Q. 고민인 게 뭐야?</label>
      <input id="decision-question" maxlength="30" placeholder="무엇을 골라줄까?" required />
    </section>
    <section id="name-fields" aria-label="선택지와 캐릭터">
      <div class="participant setup-card setup-card--yellow">
        <input name="name" maxlength="10" placeholder="1번째 선택지" aria-label="1번째 선택지" required />
        <select name="character" aria-label="첫 번째 캐릭터"></select>
        <div class="mini-character-picker" aria-label="첫 번째 캐릭터 선택">
          <button class="character-step" data-direction="-1" type="button" aria-label="이전 캐릭터">‹</button>
          <div class="mini-character-preview"><img alt="" /><span>곰</span></div>
          <button class="character-step" data-direction="1" type="button" aria-label="다음 캐릭터">›</button>
        </div>
      </div>
      <div class="participant setup-card setup-card--rose">
        <input name="name" maxlength="10" placeholder="2번째 선택지" aria-label="2번째 선택지" required />
        <select name="character" aria-label="두 번째 캐릭터"></select>
        <div class="mini-character-picker" aria-label="두 번째 캐릭터 선택">
          <button class="character-step" data-direction="-1" type="button" aria-label="이전 캐릭터">‹</button>
          <div class="mini-character-preview"><img alt="" /><span>토끼</span></div>
          <button class="character-step" data-direction="1" type="button" aria-label="다음 캐릭터">›</button>
        </div>
      </div>
      <div class="participant setup-card setup-card--indigo">
        <input name="name" maxlength="10" placeholder="3번째 선택지 (선택)" aria-label="3번째 선택지" />
        <select name="character" aria-label="세 번째 캐릭터"></select>
        <div class="mini-character-picker" aria-label="세 번째 캐릭터 선택">
          <button class="character-step" data-direction="-1" type="button" aria-label="이전 캐릭터">‹</button>
          <div class="mini-character-preview"><img alt="" /><span>고양이</span></div>
          <button class="character-step" data-direction="1" type="button" aria-label="다음 캐릭터">›</button>
        </div>
      </div>
      <div class="participant setup-card setup-card--sky">
        <input name="name" maxlength="10" placeholder="4번째 선택지 (선택)" aria-label="4번째 선택지" />
        <select name="character" aria-label="네 번째 캐릭터"></select>
        <div class="mini-character-picker" aria-label="네 번째 캐릭터 선택">
          <button class="character-step" data-direction="-1" type="button" aria-label="이전 캐릭터">‹</button>
          <div class="mini-character-preview"><img alt="" /><span>오리</span></div>
          <button class="character-step" data-direction="1" type="button" aria-label="다음 캐릭터">›</button>
        </div>
      </div>
    </section>
    <div class="settings">
      <label><input id="sound-toggle" type="checkbox" checked /> 소리</label>
      <label><input id="haptic-toggle" type="checkbox" checked /> 진동</label>
    </div>
    <footer class="setup-footer">
      <button id="setup-submit" class="primary" type="submit" disabled>데굴이들에게 골라달라고 하기</button>
      <small>Powered by Degul-i Game Engine</small>
    </footer>
  </form>
</section>
```

Within each `.participant`, preserve the existing name input, hidden character select, preview image, preview label, and two `.character-step` buttons. Add only presentation classes such as `.setup-card` and per-card pastel modifiers. Keep the two required name inputs first and the optional inputs third and fourth.

- [ ] **Step 4: Verify the JavaScript contract statically**

Run:

```powershell
rg -n 'id="(setup|setup-form|decision-question|name-fields|sound-toggle|haptic-toggle|setup-submit)"|name="(name|character)"|class="[^"]*(participant|mini-character-picker|mini-character-preview|character-step)' code/index.html
```

Expected: one instance of every listed ID, four `name="name"` inputs, four `name="character"` selects, four participants, four pickers, four previews, and eight character-step buttons.

- [ ] **Step 5: Build the prototype**

Run:

```powershell
npm.cmd run build
```

Expected: Vite exits with code 0 and reports both HTML entry points without missing selectors or assets.

- [ ] **Step 6: Commit the prototype**

```powershell
git add code/index.html
git commit -m "feat: prototype sample design on setup screen"
```

---

### Task 2: Validate the mobile layout and existing interaction flow

**Files:**
- Verify: `code/index.html`
- Verify: `code/game.js`

**Interfaces:**
- Consumes: The setup DOM contract produced by Task 1 and the existing `syncCharacterOptions()`, `stepCharacter()`, and form submit listener in `code/game.js`.
- Produces: Evidence that the prototype is usable at the target mobile sizes and still launches the unchanged race flow.

- [ ] **Step 1: Start the Vite server**

Run:

```powershell
npm.cmd run dev -- --port 5173
```

Expected: Vite prints a local URL at `http://localhost:5173/` and no startup error.

- [ ] **Step 2: Check the setup screen at all target sizes**

Open `/code/` at 360×800, 390×844, and 430×932. At each size verify:

```text
- no horizontal scrollbar
- the header, question input, four cards, settings, and button stay within the cream canvas
- the setup screen scrolls vertically when its content exceeds the viewport
- character PNGs use object-fit: contain and are not clipped
- every arrow and checkbox has a usable 44px touch target
```

- [ ] **Step 3: Exercise the existing form flow**

Perform this exact interaction sequence:

```text
1. Enter "오늘 뭐 먹지?" in the question field.
2. Enter "중식" and "일식" in the first two required choices.
3. Use both arrow directions and confirm the character image and name change.
4. Enter a third optional choice and confirm its character picker becomes active.
5. Confirm the same character cannot remain selected by two active choices.
6. Toggle sound and vibration off and on.
7. Submit and confirm the setup closes and the existing race view appears.
8. Finish or reveal the result, choose "선택지 변경", and confirm the redesigned setup returns.
```

Expected: All eight steps complete without a console error; the race HUD, countdown, and result presentation remain visually unchanged.

- [ ] **Step 4: Run the final build and inspect repository scope**

Run:

```powershell
npm.cmd run build
git diff main...HEAD -- code/index.html code/game.js package.json package-lock.json
```

Expected: Build succeeds; the implementation diff changes `code/index.html` only. `code/game.js`, dependencies, and lockfiles have no implementation changes.

- [ ] **Step 5: Record any verification-only fixes in one commit**

If visual verification required scoped CSS or setup-markup corrections, commit only those corrections:

```powershell
git add code/index.html
git commit -m "fix: refine setup prototype responsiveness"
```

If no correction was necessary, do not create an empty commit.
