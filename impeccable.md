# Impeccable — AWS Bedrock Chatbot Implementation Spec

> React + TypeScript + Vite · Design system: DESIGN.md (Claude/Anthropic editorial)  
> Backend: AWS Bedrock Agent via API Gateway (POST `/chat` → `{ question }` → `{ answer, tools_used? }`)

---

## 1. Design Tokens (CSS Custom Properties)

Map DESIGN.md tokens to CSS variables in `src/index.css`:

```css
:root {
  /* Surface */
  --canvas:        #faf9f5;
  --surface-card:  #efe9de;
  --surface-dark:  #181715;
  --surface-dark-elevated: #252320;
  --hairline:      #e6dfd8;

  /* Brand */
  --primary:       #cc785c;
  --primary-active:#a9583e;
  --on-primary:    #ffffff;

  /* Text */
  --ink:           #141413;
  --body:          #3d3d3a;
  --muted:         #6c6a64;
  --on-dark:       #faf9f5;
  --on-dark-soft:  #a09d96;

  /* Radius */
  --r-sm:  6px;
  --r-md:  8px;
  --r-lg:  12px;
  --r-xl:  16px;
  --r-pill:9999px;

  /* Spacing */
  --sp-xs: 8px;
  --sp-sm: 12px;
  --sp-md: 16px;
  --sp-lg: 24px;
  --sp-xl: 32px;

  /* Typography */
  --font-display: "Tiempos Headline", "Cormorant Garamond", Georgia, serif;
  --font-body:    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, monospace;
}
```

---

## 2. File Structure

```
src/
├── index.css          # tokens + global reset
├── main.tsx
├── App.tsx            # root layout (canvas background)
└── components/
    ├── ChatShell.tsx  # full-page chat container
    ├── TopBar.tsx     # header with title + reset button
    ├── MessageList.tsx# scrollable message feed
    ├── Message.tsx    # single message bubble (user | ai | loading)
    └── InputBar.tsx   # text input + send button
```

---

## 3. Component Specs

### `App.tsx`
- Background: `var(--canvas)`, `min-height: 100vh`, flex center.
- Renders `<ChatShell />` constrained to `max-width: 896px`, `height: 90vh`, `border-radius: var(--r-xl)`, `border: 1px solid var(--hairline)`, `box-shadow: 0 1px 3px rgba(20,20,19,0.08)`.

---

### `TopBar.tsx`
Matches the `top-nav` + `product-mockup-card-dark` pattern from DESIGN.md.

```
background: var(--surface-dark)
color:      var(--on-dark)
height:     64px
padding:    0 var(--sp-lg)
```

- Left: small SVG bolt icon in a `var(--surface-dark-elevated)` rounded square (`var(--r-md)`), then:
  - Title: `font-family: var(--font-display)`, `font-size: 18px`, `font-weight: 400`, `letter-spacing: -0.3px`, `color: var(--on-dark)`
  - Subtitle: `font-size: 12px`, `color: var(--on-dark-soft)`, `font-family: var(--font-body)`
- Right: circular reset button (`button-icon-circular` on dark variant):
  - `background: var(--surface-dark-elevated)`, `border-radius: var(--r-pill)`, `width/height: 36px`, rotate SVG icon, `color: var(--on-dark)`

---

### `MessageList.tsx`
- `flex: 1`, `overflow-y: auto`, `padding: var(--sp-lg)`, `background: var(--canvas)`, `display: flex`, `flex-direction: column`, `gap: var(--sp-lg)`.
- Scrolls to bottom on new message (`useEffect` + `ref.scrollIntoView`).

---

### `Message.tsx`

**Props:** `sender: 'user' | 'ai' | 'loading'`, `text?: string`, `toolsUsed?: string[]`

#### User bubble
```
align-self: flex-end
background: var(--primary)
color:      var(--on-primary)
border-radius: var(--r-lg) var(--r-lg) var(--r-sm) var(--r-lg)
padding:    var(--sp-sm) var(--sp-md)
max-width:  80%
font-family: var(--font-body)
font-size:  14px
```

#### AI bubble
Row layout: avatar + bubble.

Avatar:
```
width/height: 32px
border-radius: var(--r-pill)
background: var(--surface-card)
border: 1px solid var(--hairline)
display: flex; align-items: center; justify-content: center
font-family: var(--font-body); font-size: 11px; font-weight: 500
color: var(--primary)
flex-shrink: 0
```

Bubble:
```
background: white
border: 1px solid var(--hairline)
border-radius: var(--r-sm) var(--r-lg) var(--r-lg) var(--r-lg)
padding:    var(--sp-md) var(--sp-lg)
max-width:  90%
font-family: var(--font-body)
font-size:  14px
line-height: 1.55
color:      var(--body)
```

Render markdown: `\n` → `<br>`, `**text**` → `<strong>`. Use `dangerouslySetInnerHTML` with sanitized output.

Tools badge (if `toolsUsed.length > 0`):
```
margin-top: var(--sp-xs)
font-size:  11px
color:      var(--muted)
background: var(--surface-card)
border: 1px solid var(--hairline)
border-radius: var(--r-pill)
padding:    2px 10px
display: inline-block
font-family: var(--font-body)
```
Text: `🛠 {toolsUsed.join(', ')}`

#### Loading bubble
Same row layout as AI. Bubble contains three-dot animation:

```css
/* dot-flashing — three dots, indigo primary color */
.dot { width:8px; height:8px; border-radius:50%; background:var(--primary); }
/* animate opacity 1 → 0.2 staggered 0s / 0.2s / 0.4s */
```

---

### `InputBar.tsx`
```
background: white
border-top: 1px solid var(--hairline)
padding:    var(--sp-sm) var(--sp-lg)
display:    flex
gap:        var(--sp-sm)
align-items: center
```

Input (`text-input`):
```
flex: 1
background: var(--canvas)
border: 1px solid var(--hairline)
border-radius: var(--r-pill)
padding:    10px var(--sp-md)
font-family: var(--font-body)
font-size:  14px
color:      var(--ink)
outline:    none
```
Focus: `border-color: var(--primary)`, `box-shadow: 0 0 0 3px rgba(204,120,92,0.15)`

Send button (`button-primary`):
```
background: var(--primary)
color:      var(--on-primary)
border-radius: var(--r-pill)
width/height: 40px
display:    flex; align-items: center; justify-content: center
border:     none; cursor: pointer
```
Active: `background: var(--primary-active)`  
Disabled: `background: var(--hairline)`, `cursor: not-allowed`

---

## 4. State & API

### `ChatShell.tsx` — state

```ts
type Message = {
  id: string
  sender: 'user' | 'ai' | 'loading'
  text?: string
  toolsUsed?: string[]
}

const WELCOME = "Hello! I'm your AWS Bedrock AI assistant. Ask me anything."
const API_URL = import.meta.env.VITE_API_URL  // set in .env
```

### `sendMessage(question: string)`

```ts
// 1. append user message
// 2. append loading message (id: 'loading')
// 3. POST { question } to API_URL
// 4. remove loading message
// 5. parse response: data.body (string or object) → { answer, tools_used? }
// 6. append ai message with text + toolsUsed
// 7. on error: append ai message with error text
```

Response shape (from index.html reference):
```ts
type ApiResponse = {
  answer: string
  tools_used?: Array<{ tool: string }>
}
```

### Reset
Clear messages, re-append welcome message, focus input.

---

## 5. Environment

`.env`:
```
VITE_API_URL=https://214mfgj0r5.execute-api.us-east-1.amazonaws.com/prod/chat
```

`.env` is gitignored. Document in README that this variable must be set.

---

## 6. Typography Rules (from DESIGN.md)

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| App title | `var(--font-display)` | 18px | 400 | letter-spacing: -0.3px |
| Subtitle | `var(--font-body)` | 12px | 400 | color: on-dark-soft |
| Message body | `var(--font-body)` | 14px | 400 | line-height: 1.55 |
| Avatar label | `var(--font-body)` | 11px | 500 | |
| Tools badge | `var(--font-body)` | 11px | 400 | uppercase optional |
| Input placeholder | `var(--font-body)` | 14px | 400 | color: muted |

Display serif is used **only** for the app title — never for message content.

---

## 7. Responsive

- Mobile (`< 640px`): `height: 100vh`, `border-radius: 0`, `border: none`. Input padding reduces to `var(--sp-sm)`.
- Message max-width: user `80%`, ai `90%` — unchanged at all breakpoints.
- TopBar title truncates with `text-overflow: ellipsis` on narrow screens.

---

## 8. Accessibility

- Input has `aria-label="Message"`.
- Send button has `aria-label="Send message"`.
- Loading bubble has `role="status"` and `aria-label="Loading response"`.
- Message list has `role="log"` and `aria-live="polite"`.
- Color contrast: `var(--primary)` on white passes AA at 14px bold (3.2:1 — use `font-weight: 500` for badge text to meet threshold).

---

## 9. Do's and Don'ts (design guardrails)

**Do**
- Keep the canvas (`var(--canvas)`) as the message area background — never pure white.
- Use `var(--surface-dark)` exclusively for the TopBar — the cream-to-dark contrast is the brand's pacing mechanism.
- Use coral (`var(--primary)`) only on the user bubble and the send button.
- Keep display serif only on the title. Message text is always body sans.

**Don't**
- Don't use cool grays or `#ffffff` for the chat background.
- Don't bold the display serif title — weight 400 is non-negotiable.
- Don't add hover animations beyond the button active-state color change.
- Don't introduce a fourth surface color (no purple, no green).
