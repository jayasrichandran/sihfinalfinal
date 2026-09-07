# MaatriSetu AI

**Hindi–Santhali Classroom Language Bridge & FLN Learning Tool**
Smart India Hackathon 2026 — Problem Statement SIH26042

---

## ▶ How to Run

> **Important:** Do NOT open `index.html` directly as a file (via `file://` URL).
> The app uses `fetch()` to load JSON data files, which requires a real HTTP server.
> Opening the file directly will fail to load data due to browser security restrictions.

### Step 1 — Open a terminal in this folder

Right-click this folder in File Explorer → **Open in Terminal** (or `cmd` / PowerShell).

### Step 2 — Start a local HTTP server

**Python 3 (recommended):**
```bash
python -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js (npx):**
```bash
npx -y serve .
```

### Step 3 — Open in your browser

Navigate to: **http://localhost:8090**

---

## 📂 Folder Structure

```
/
  index.html          ← Main application shell
  css/
    style.css         ← Design system & all styles
  js/
    app.js            ← All application logic (vanilla JS)
  data/
    phrases.json      ← Classroom phrase bank (15 entries)
    curriculum.json   ← FLN topics with flashcard items
  README.md           ← This file
```

---

## 📱 Features

| Tab | Feature |
|-----|---------|
| **Phrasebook** | Browse Hindi classroom phrases with Santhali translations. Live search. Flag corrections (stored locally). |
| **Curriculum** | Expand FLN topic cards (Numbers, Greetings, etc.). View flashcards. Take a mini quiz — scores saved locally. |
| **Worksheet Generator** | Pick a topic, set question count, generate a fill-in-the-blank worksheet. Print / Save as PDF via browser. |
| **Corrections Log** | Inspect all submitted corrections (from localStorage), newest first. |

---

## ⚠️ Prototype Disclosures

- **Santhali translations are PLACEHOLDERS.** All `phrases.json` and `curriculum.json` entries are marked `"status": "pending_verification"`. They **must be sourced and verified by a native Santhali speaker before any real classroom use.** This is an intentional, disclosed limitation.
- **No AI/ML model is integrated.** Phrase lookup is dictionary-based. Worksheet generation is template-based. No external translation API is called.
- **Offline-first:** After first load (which fetches local JSON files), the app works with WiFi/data turned off. All state is stored in `localStorage`.
- **No backend, no database.** Everything runs in the browser.

---

## 🔧 Tech Stack

- Plain HTML5, CSS3, Vanilla JavaScript (ES2020)
- No build step. No npm. No external dependencies.
- Data: local JSON files loaded via `fetch()`
- State: `localStorage` only

---

*MaatriSetu AI — Bridging the language gap for foundational learning.*
