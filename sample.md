Build a working prototype web app called "MaatriSetu AI" — an offline-first
Hindi–Santhali classroom language bridge and FLN (Foundational Literacy &
Numeracy) learning tool. This is a hackathon prototype for Smart India
Hackathon 2026 (Problem Statement SIH26042), to be demoed live tomorrow.

TECH CONSTRAINTS (important):
- Plain HTML, CSS, and vanilla JavaScript. No build step, no npm install
  required to run it. It must work by serving the folder with a simple
  static server (e.g. `python -m http.server`) and opening it in a browser.
- No external API calls and no CDN dependencies for core functionality —
  everything must keep working with WiFi/data turned off after the first
  load. Fonts/icons should be system fonts or bundled locally, not loaded
  from a CDN.
- Data lives in local JSON files under a /data folder, loaded via fetch().
- Any state that needs to persist (corrections, quiz progress) should use
  localStorage — no backend server, no database.

VISUAL STYLE:
- Dark charcoal/near-black top navbar with a small circular maroon/brick-red
  logo mark, app name "MaatriSetu AI" in a serif font (e.g. Georgia/Times),
  and a subtitle underneath in a smaller grey sans-serif font.
- A live "Online" / "Offline" status badge in the top-right of the navbar,
  driven by real navigator.onLine + window 'online'/'offline' event
  listeners — not hardcoded. Label it "Online (app still works offline)"
  when online, and "Offline (running fully local)" when offline.
- Tab navigation below the navbar: Phrasebook | Curriculum | Worksheet
  Generator | Corrections Log. Active tab underlined in maroon.
- Clean, minimal, card-based layout. Maroon/brick-red as the single accent
  color for buttons and active states; everything else neutral grey/white/
  charcoal. Serif headings, sans-serif body text.

FOLDER STRUCTURE:
/
  index.html
  /css/style.css
  /js/app.js
  /data/phrases.json
  /data/curriculum.json
  README.md   (must explain: "Run `python -m http.server 8000` in this
               folder, then open http://localhost:8000 — do NOT open
               index.html directly as a file, it will fail to load data.")

SCREEN 1 — PHRASEBOOK (default/active tab):
- Loads phrases.json and displays each entry as a card: Hindi phrase,
  Santhali translation, and a small "Verified" or "Pending Verification"
  tag (from the JSON data).
- Each card has a "Suggest a correction" button that opens a modal with:
  a textarea labeled "Correct Santhali translation", Cancel and
  "Save Correction" buttons.
- On Save: store an object {phraseId, hindiText, originalTranslation,
  suggestedTranslation, timestamp} into a localStorage array
  "maatrisetu_corrections". Close the modal. Show a brief confirmation
  (e.g. a toast or inline message), not just a silent close.
- Include a text input above the cards to filter/search phrases by Hindi
  text as-you-type.

DATA — phrases.json — seed it with this placeholder structure (mark ALL
entries "status": "pending_verification" since none of these are native-
speaker verified yet — this is a real, disclosed limitation of the
prototype, not hidden):
[
  { "id": "p1", "hindi": "अपनी किताब खोलो", "english": "Open your book",
    "santhali": "PLACEHOLDER - source and fill before demo",
    "status": "pending_verification" },
  { "id": "p2", "hindi": "बैठ जाओ", "english": "Sit down",
    "santhali": "PLACEHOLDER - source and fill before demo",
    "status": "pending_verification" },
  ... (generate 10-15 total common classroom-instruction placeholders
       like these, in the same format, covering: sit down, stand up,
       listen carefully, repeat after me, open your book, count the
       numbers, raise your hand, good job, be quiet, line up, write
       your name, look at the board)
]

SCREEN 2 — CURRICULUM:
- Loads curriculum.json and displays a simple list of FLN lesson topics
  (e.g. "Numbers 1-10", "Greetings", "Family Words") as cards.
- Clicking a topic expands it to show 3-4 flashcard-style items: an
  English/Hindi term, its Santhali translation, and a "Practice" button
  that shows a simple one-question multiple-choice quiz for that term.
- Track a basic score in localStorage: correct answers out of attempts,
  shown as a small progress indicator per topic.

SCREEN 3 — WORKSHEET GENERATOR:
- Let the user pick a curriculum topic from a dropdown (reuse
  curriculum.json) and a number of questions (3-10).
- Generate a simple printable-looking worksheet in the page: a numbered
  list of fill-in-the-blank or matching questions built from that
  topic's terms, plus an answer key section below a visible divider.
- Add a "Print / Save as PDF" button using window.print() — no need for
  real PDF generation, browser print-to-PDF is enough for a demo.
- Be honest in a small caption under the generator: "Generated from
  structured curriculum data" (since this is template-based generation,
  not AI-generated — don't imply AI wrote the worksheet unless it
  actually does).

SCREEN 4 — CORRECTIONS LOG:
- Read the "maatrisetu_corrections" array from localStorage and display
  each entry as a row: timestamp, original Hindi phrase, the suggested
  correction, and a status tag "Awaiting native-speaker review".
- Show newest first. If empty, show a friendly empty state: "No
  corrections submitted yet — try flagging one from the Phrasebook tab."
- This tab exists to make the verification-loop concept from our
  concept note tangible and demoable — it should feel like a real,
  inspectable log, not decoration.

DO NOT:
- Do not attempt to integrate any real ASR, machine translation, or TTS
  model — that is out of scope for this prototype build.
- Do not call any external translation API (e.g. Google Translate) —
  this would contradict the offline-first, phrase-bank-based design.
- Do not add user authentication, a backend server, or a database.
- Do not use placeholder Lorem Ipsum text anywhere visible in the UI —
  use the real classroom-phrase content specified above.

DELIVERABLE:
A fully working static site in the folder structure above, that runs
immediately via a local static server with zero build step, works with
WiFi turned off after first load, and demonstrates: phrase lookup,
correction flagging with a real persisted log, curriculum browsing with
flashcards and a mini quiz, and worksheet generation with print support.