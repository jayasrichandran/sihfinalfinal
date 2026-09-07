/* =============================================================
   MaatriSetu AI — App Logic (vanilla JS, no dependencies)
   ============================================================= */

/* ---- State ---- */
const CORRECTIONS_KEY = 'maatrisetu_corrections';
const SCORES_KEY      = 'maatrisetu_scores';

let allPhrases    = [];
let allCurriculum = [];
let allFlashcards = [];
let currentCategory = 'numbers';
let currentCardIndex = 0;
let currentMode = 'learn';
let currentAudioObj = null;
let currentPhraseAudio = null;
let currentPhraseBtnId = null;
const phraseAudioAvailability = new Map();

/* ============================================================
   ONLINE / OFFLINE STATUS BADGE
   ============================================================ */
function updateStatusBadge() {
  const badge = document.getElementById('status-badge');
  const label = document.getElementById('status-label');
  if (navigator.onLine) {
    badge.className = 'online';
    label.textContent = 'Online (app still works offline)';
  } else {
    badge.className = 'offline';
    label.textContent = 'Offline (running fully local)';
  }
}

window.addEventListener('online',  updateStatusBadge);
window.addEventListener('offline', updateStatusBadge);

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
function switchTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) {
    btn.click();
  }
}

function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels  = document.querySelectorAll('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p  => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      // Stop any playing flashcard audio when switching tabs
      if (typeof stopCurrentFlashcardAudio === 'function') stopCurrentFlashcardAudio();

      // Stop any playing phrase audio when switching tabs
      if (currentPhraseAudio) {
        currentPhraseAudio.pause();
        currentPhraseAudio = null;
        if (currentPhraseBtnId) {
          const prevBtn = document.querySelector(`.santhali-audio-btn[data-id="${currentPhraseBtnId}"]`);
          if (prevBtn) prevBtn.classList.remove('playing');
          currentPhraseBtnId = null;
        }
      }

      // Refresh corrections log when that tab is opened
      if (btn.dataset.tab === 'tab-corrections') renderCorrectionsLog();
    });
  });
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ============================================================
   SCREEN 1 — PHRASEBOOK AUDIO & CONTROLS
   ============================================================ */
async function checkAllPhraseAudio() {
  if (!allPhrases || !allPhrases.length) return;
  await Promise.all(allPhrases.map(async (p) => {
    try {
      const res = await fetch(`./assets/audio/phrases/${p.id}.mp3`, { method: 'HEAD' });
      phraseAudioAvailability.set(p.id, res.ok);
    } catch (e) {
      phraseAudioAvailability.set(p.id, false);
    }
  }));
}

function playPhraseAudio(phraseId, event) {
  if (event) event.stopPropagation();

  const isAvailable = phraseAudioAvailability.get(phraseId);
  if (!isAvailable) {
    showToast('ℹ️ Native-speaker audio recording for this phrase is not yet available.');
    return;
  }

  const btn = document.querySelector(`.santhali-audio-btn[data-id="${phraseId}"]`);

  // Stop currently playing phrase audio
  if (currentPhraseAudio) {
    currentPhraseAudio.pause();
    currentPhraseAudio.currentTime = 0;
    if (currentPhraseBtnId) {
      const prevBtn = document.querySelector(`.santhali-audio-btn[data-id="${currentPhraseBtnId}"]`);
      if (prevBtn) prevBtn.classList.remove('playing');
    }
  }

  // Toggle off if same audio button was clicked while playing
  if (currentPhraseBtnId === phraseId && currentPhraseAudio) {
    currentPhraseAudio = null;
    currentPhraseBtnId = null;
    return;
  }

  const audio = new Audio(`./assets/audio/phrases/${phraseId}.mp3`);
  currentPhraseAudio = audio;
  currentPhraseBtnId = phraseId;
  if (btn) btn.classList.add('playing');

  audio.play().catch(err => {
    console.warn('Phrase audio playback error:', err);
    if (btn) btn.classList.remove('playing');
    currentPhraseAudio = null;
    currentPhraseBtnId = null;
    showToast('⚠️ Could not play audio file.');
  });

  audio.onended = () => {
    if (btn) btn.classList.remove('playing');
    if (currentPhraseBtnId === phraseId) {
      currentPhraseAudio = null;
      currentPhraseBtnId = null;
    }
  };

  audio.onerror = () => {
    if (btn) btn.classList.remove('playing');
    if (currentPhraseBtnId === phraseId) {
      currentPhraseAudio = null;
      currentPhraseBtnId = null;
    }
  };
}

async function initPhrasebook() {
  const container = document.getElementById('phrase-cards');
  const searchEl  = document.getElementById('phrase-search');

  try {
    const res = await fetch('./data/phrases.json');
    allPhrases = await res.json();
  } catch (e) {
    container.innerHTML = '<p class="empty-state">⚠️ Could not load phrases. Make sure you are running via a local server (see README).</p>';
    return;
  }

  await checkAllPhraseAudio();
  renderPhrases(allPhrases);

  searchEl.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase().trim();
    const filtered = allPhrases.filter(p =>
      p.hindi.toLowerCase().includes(q) ||
      p.english.toLowerCase().includes(q)
    );
    renderPhrases(filtered);
  });

  initSpeechRecognition();
}

function renderPhrases(phrases) {
  const container = document.getElementById('phrase-cards');
  if (!phrases.length) {
    container.innerHTML = '<p class="empty-state">No phrases match your search.</p>';
    return;
  }
  container.innerHTML = phrases.map(p => {
    const hasAudio = phraseAudioAvailability.get(p.id) === true;
    const isPlaying = currentPhraseBtnId === p.id;
    return `
    <div class="phrase-card" data-id="${p.id}">
      <div class="phrase-hindi">${p.hindi}</div>
      <div class="phrase-english">${p.english}</div>
      <div class="phrase-santhali">
        <span>${p.santhali}</span>
        <button
          type="button"
          class="santhali-audio-btn ${hasAudio ? 'enabled' : 'disabled'} ${isPlaying ? 'playing' : ''}"
          data-id="${p.id}"
          onclick="playPhraseAudio('${p.id}', event)"
          title="${hasAudio ? 'Play Santhali audio' : 'Native-speaker audio recording for this phrase is not yet available.'}"
          aria-label="${hasAudio ? 'Play Santhali audio' : 'Native-speaker audio recording for this phrase is not yet available.'}"
          ${hasAudio ? '' : 'disabled'}
        >
          🔊
        </button>
      </div>
      <span class="status-tag ${p.status === 'verified' ? 'verified' : 'pending'}">
        ${p.status === 'verified' ? '✓ Verified' : '⏳ Pending Verification'}
      </span>
      <button
        class="btn btn-outline"
        style="margin-top:0.5rem;"
        onclick="openCorrectionModal('${p.id}')"
        id="suggest-btn-${p.id}"
      >
        ✏️ Suggest a Correction
      </button>
    </div>
  `;
  }).join('');
}

/* ============================================================
   CORRECTION MODAL
   ============================================================ */
function openCorrectionModal(phraseId) {
  const phrase = allPhrases.find(p => p.id === phraseId);
  if (!phrase) return;

  document.getElementById('modal-phrase-ref').textContent = `"${phrase.hindi}" — ${phrase.english}`;
  document.getElementById('correction-input').value = '';
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-overlay').dataset.phraseId = phraseId;
  document.getElementById('correction-input').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function saveCorrection() {
  const overlay = document.getElementById('modal-overlay');
  const phraseId = overlay.dataset.phraseId;
  const phrase   = allPhrases.find(p => p.id === phraseId);
  const suggested = document.getElementById('correction-input').value.trim();

  if (!suggested) {
    showToast('Please enter a correction before saving.');
    return;
  }

  const entry = {
    phraseId,
    hindiText:            phrase.hindi,
    originalTranslation:  phrase.santhali,
    suggestedTranslation: suggested,
    timestamp:            new Date().toISOString()
  };

  const existing = JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]');
  existing.push(entry);
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(existing));

  closeModal();
  showToast('✅ Correction saved — visible in the Corrections Log tab.');
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ============================================================
   SCREEN 2 — CURRICULUM
   ============================================================ */
async function initCurriculum() {
  const container = document.getElementById('curriculum-list');

  try {
    const res  = await fetch('./data/curriculum.json');
    allCurriculum = await res.json();
  } catch (e) {
    container.innerHTML = '<p class="empty-state">⚠️ Could not load curriculum. Make sure you are running via a local server.</p>';
    return;
  }

  renderCurriculum();
}

/* ============================================================
   SAFETY / DISPLAY / SVG HELPERS
   ============================================================ */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toOlChikiNumber(value) {
  const d = ['᱐','᱑','᱒','᱓','᱔','᱕','᱖','᱗','᱘','᱙'];
  return String(value).split('').map(c => d[Number(c)] ?? c).join('');
}

/* Inline SVG objects: zero external dependencies, 100% offline printable */
function makeObjectSvg(index) {
  const type = index % 3;
  if (type === 0) {
    return `
      <svg class="ws-object-svg" viewBox="0 0 60 60" role="img" aria-label="object">
        <circle cx="30" cy="33" r="18" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="M30 15 C28 8 34 5 40 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <path d="M39 8 C45 5 49 10 46 14 C42 16 39 13 39 8Z" fill="none" stroke="currentColor" stroke-width="2.5"/>
      </svg>`;
  }
  if (type === 1) {
    return `
      <svg class="ws-object-svg" viewBox="0 0 60 60" role="img" aria-label="object">
        <rect x="12" y="15" width="36" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="M12 25 H48" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M20 15 V45 M40 15 V45" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>`;
  }
  return `
    <svg class="ws-object-svg" viewBox="0 0 60 60" role="img" aria-label="object">
      <circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M30 10 L34 25 L50 25 L37 34 L42 49 L30 40 L18 49 L23 34 L10 25 L26 25 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
    </svg>`;
}

function makeBodyPartSvg(part) {
  const hi = '#8B2635', normal = '#bdbdbd', stroke = '#333';
  const hand = part === 'hand', eye = part === 'eye', ear = part === 'ear', foot = part === 'foot';
  return `<svg class="ws-body-svg" viewBox="0 0 260 300" role="img" aria-label="body part picture">
    <circle cx="130" cy="48" r="30" fill="${normal}" stroke="${stroke}" stroke-width="3"/>
    <path d="M98 78 Q130 70 162 78 L174 150 L160 205 L100 205 L86 150 Z" fill="${normal}" stroke="${stroke}" stroke-width="3"/>
    <path d="M98 92 L60 155 L48 195" fill="none" stroke="${hand ? hi : normal}" stroke-width="18" stroke-linecap="round"/>
    <path d="M162 92 L200 155 L212 195" fill="none" stroke="${hand ? hi : normal}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="48" cy="198" r="15" fill="${hand ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <circle cx="212" cy="198" r="15" fill="${hand ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <path d="M112 205 L105 265" stroke="${foot ? hi : normal}" stroke-width="22" stroke-linecap="round"/>
    <path d="M148 205 L155 265" stroke="${foot ? hi : normal}" stroke-width="22" stroke-linecap="round"/>
    <ellipse cx="102" cy="276" rx="25" ry="10" fill="${foot ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <ellipse cx="158" cy="276" rx="25" ry="10" fill="${foot ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <ellipse cx="100" cy="48" rx="7" ry="10" fill="${eye ? hi : '#444'}"/>
    <ellipse cx="160" cy="48" rx="7" ry="10" fill="${eye ? hi : '#444'}"/>
    <ellipse cx="88" cy="48" rx="10" ry="18" fill="${ear ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <ellipse cx="172" cy="48" rx="10" ry="18" fill="${ear ? hi : normal}" stroke="${stroke}" stroke-width="3"/>
    <path d="M130 50 L124 64 L136 64" fill="none" stroke="${stroke}" stroke-width="3"/>
  </svg>`;
}

function renderCurriculum() {
  const container = document.getElementById('curriculum-list');
  const scores    = JSON.parse(localStorage.getItem(SCORES_KEY) || '{}');

  container.innerHTML = allCurriculum.map(topic => {
    const sc     = scores[topic.id] || { correct: 0, attempts: 0 };
    const pct    = sc.attempts > 0 ? Math.round((sc.correct / sc.attempts) * 100) : null;
    const isMath = Boolean(topic.worksheetType);

    const displayItems = topic.worksheetType === 'number_spelling'
      ? (topic.numberSpelling || []).map((item, index) => ({
          id: `ns${item.number ?? index + 1}`,
          hindi: item.hindi,
          santhali: item.santhali,
          number: item.number,
          olchikiNumber: item.olchikiNumber
        }))
      : (topic.items || []);

    return `
      <div class="topic-card" id="topic-${escapeHtml(topic.id)}">
        <div class="topic-header" onclick="toggleTopic('${escapeJs(topic.id)}')">
          <span class="topic-icon">${topic.icon || '📘'}</span>
          <span class="topic-title">${escapeHtml(topic.topic)}</span>
          ${isMath ? '<span class="topic-progress">Class 1 FLN</span>' : ''}
          ${pct !== null ? `<span class="topic-progress">${sc.correct}/${sc.attempts} correct (${pct}%)</span>` : ''}
          <span class="topic-chevron">▾</span>
        </div>
        <div class="topic-body">
          <div class="flashcard-grid">
            ${displayItems.map(item => `
              <div class="flashcard" id="fc-${escapeHtml(item.id)}">
                <span class="fc-hindi">${escapeHtml(item.hindi || '')}</span>
                ${item.english ? `<span class="fc-english">${escapeHtml(item.english)}</span>` : ''}
                <span class="fc-santhali">${escapeHtml(item.santhali || '')}</span>
                <button class="btn btn-outline" style="font-size:0.72rem;padding:0.35rem 0.75rem;"
                  onclick="showQuiz('${escapeJs(topic.id)}','${escapeJs(item.id)}')">
                  🎯 Practice
                </button>
              </div>
            `).join('')}
          </div>
          <div id="quiz-area-${escapeHtml(topic.id)}" style="display:none;"></div>
        </div>
      </div>`;
  }).join('');
}

function toggleTopic(topicId) {
  const card = document.getElementById(`topic-${topicId}`);
  if (card) card.classList.toggle('expanded');
}

function expandTopic(topicId) {
  const card = document.getElementById(`topic-${topicId}`);
  if (card && !card.classList.contains('expanded')) {
    card.classList.add('expanded');
  }
}

function showQuiz(topicId, itemId) {
  const topic = allCurriculum.find(t => t.id === topicId);
  if (!topic) return;

  const item = topic.worksheetType === 'number_spelling'
    ? (topic.numberSpelling || []).find((entry, index) => `ns${entry.number ?? index + 1}` === itemId)
    : (topic.items || []).find(i => i.id === itemId);
  const quizEl = document.getElementById(`quiz-area-${topicId}`);
  if (!item || !quizEl) return;

  let questionText = '';
  let correctAnswer = '';
  let correctDisplay = '';
  let optionLabels = [];
  let distractors = [];

  if (topic.worksheetType === 'colors' || topic.worksheetType === 'body_parts') {
    const worksheetItems = topic.worksheetItems || [];
    const itemIndex = (topic.items || []).findIndex(i => i.id === itemId);
    const practiceItem = worksheetItems[itemIndex >= 0 ? itemIndex : 0];
    if (!practiceItem) return;

    correctAnswer = practiceItem.santhali;
    correctDisplay = `${practiceItem.hindi} / ${practiceItem.santhali}`;
    const pool = worksheetItems.filter((_, idx) => idx !== (itemIndex >= 0 ? itemIndex : 0));

    if (topic.worksheetType === 'colors') {
      questionText = `
        <div><strong>चित्र का रंग पहचानिए:</strong></div>
        <div class="quiz-santhali">ᱪᱤᱛᱟᱹᱨ ᱨᱮᱭᱟᱜ ᱨᱚᱝ ᱧᱮᱞ ᱠᱟᱛᱮ ᱧᱩᱛᱩᱢ ᱚᱞ ᱢᱮ:</div>
        <div class="quiz-picture-swatch" style="background:${escapeHtml(practiceItem.color)};"></div>`;
    } else {
      questionText = `
        <div><strong>चित्र में शरीर के अंग का नाम पहचानिए:</strong></div>
        <div class="quiz-santhali">ᱪᱤᱛᱟᱹᱨ ᱨᱮ ᱦᱚᱲᱢᱚ ᱵᱷᱟᱜ ᱨᱮᱭᱟᱜ ᱧᱩᱛᱩᱢ ᱧᱮᱞ ᱢᱮ:</div>
        <div class="quiz-body-picture">${makeBodyPartSvg(practiceItem.part)}</div>`;
    }

    optionLabels = shuffle([practiceItem, ...pool.slice(0, 3)]).map(x => ({
      value: x.santhali,
      label: `${x.hindi} / ${x.santhali}`
    }));
  } else if (topic.worksheetType === 'number_spelling') {
    correctAnswer = item.santhali;
    correctDisplay = `${item.hindi} / ${item.santhali}`;
    questionText = `
      <div><strong>संख्या ${escapeHtml(item.number)} का नाम चुनिए:</strong></div>
      <div class="quiz-santhali">ᱮᱞ ${escapeHtml(item.olchikiNumber || item.number)} ᱨᱮᱭᱟᱜ ᱧᱩᱛᱩᱢ ᱵᱟᱪᱷᱱᱟᱣ ᱢᱮ:</div>`;

    const pool = (topic.numberSpelling || []).filter(x => x.number !== item.number);
    optionLabels = shuffle([item, ...pool.slice(0, 3)]).map(x => ({
      value: x.santhali,
      label: `${x.hindi} / ${x.santhali}`
    }));
  } else if (topic.worksheetType === 'addition' || topic.worksheetType === 'subtraction') {
    correctAnswer = String(item.answer);
    correctDisplay = `${item.answer} / ${toOlChikiNumber(item.answer)}`;
    const operator = topic.worksheetType === 'addition' ? '+' : '−';
    questionText = topic.worksheetType === 'addition'
      ? `<div><strong>जोड़कर सही उत्तर चुनिए: ${item.hindi} = ?</strong></div><div class="quiz-santhali">ᱡᱚᱲ ᱠᱟᱛᱮ ᱴᱷᱤᱠ ᱡᱚᱵᱟᱵ ᱵᱟᱪᱷᱱᱟᱣ ᱢᱮ: ${item.a ?? ''} ${operator} ${item.b ?? ''} = ?</div>`
      : `<div><strong>घटाकर सही उत्तर चुनिए: ${item.hindi} = ?</strong></div><div class="quiz-santhali">ᱠᱟᱹᱴ ᱠᱟᱛᱮ ᱴᱷᱤᱠ ᱡᱚᱵᱟᱵ ᱵᱟᱪᱷᱱᱟᱣ ᱢᱮ: ${item.a ?? ''} ${operator} ${item.b ?? ''} = ?</div>`;
    distractors = (topic.items || [])
      .filter(i => i.id !== itemId)
      .map(i => String(i.answer))
      .filter(Boolean);
  } else if (topic.worksheetType === 'counting') {
    correctAnswer = String(item.answer);
    correctDisplay = `${item.answer} / ${toOlChikiNumber(item.answer)}`;
    questionText = `
      <div><strong>चित्रों को गिनकर सही संख्या चुनिए:</strong></div>
      <div class="quiz-santhali">ᱪᱤᱛᱟᱹᱨ ᱠᱚ ᱮᱞ ᱠᱟᱛᱮ ᱴᱷᱤᱠ ᱮᱞ ᱵᱟᱪᱷᱱᱟᱣ ᱢᱮ:</div>
      <div class="ws-counting-objects quiz-counting-preview">${Array.from({length:Number(item.answer)},(_,i)=>makeObjectSvg(i)).join('')}</div>`;
    distractors = (topic.items || [])
      .filter(i => i.id !== itemId)
      .map(i => String(i.answer))
      .filter(Boolean);
  } else {
    // Regular language topics (Numbers, Greetings, Family Words, etc.)
    correctAnswer = item.santhali || '';
    correctDisplay = `${item.hindi || ''} / ${item.santhali || ''}`;
    questionText = `
      <div><strong>हिन्दी शब्द <span class="quiz-highlight">${escapeHtml(item.hindi)}</span> का सही संताली शब्द चुनिए:</strong></div>
      <div class="quiz-santhali">ᱦᱤᱱᱫᱤ ᱥᱟᱵᱫ <span class="quiz-highlight">${escapeHtml(item.hindi)}</span> ᱨᱮᱭᱟᱜ ᱴᱷᱤᱠ ᱥᱟᱱᱛᱟᱲᱤ ᱥᱟᱵᱫ ᱵᱟᱪᱷᱱᱟᱣ ᱢᱮ:</div>`;
    distractors = (topic.items || [])
      .filter(i => i.id !== itemId)
      .map(i => i.santhali)
      .filter(Boolean)
      .filter(v => !String(v).toLowerCase().includes('placeholder'));
    optionLabels = shuffle([item, ...(topic.items || [])
      .filter(i => i.id !== itemId)
      .filter(i => i.santhali && !String(i.santhali).toLowerCase().includes('placeholder'))
      .slice(0, 3)]).map(x => ({
        value: x.santhali,
        label: `${x.hindi} / ${x.santhali}`
      }));
  }

  // Math/counting questions use bilingual numeral options.
  if (!optionLabels.length) {
    const generic = ['1','2','3','4','5','6','7','8','9','10'];
    for (const g of generic) {
      if (distractors.length >= 3) break;
      if (g !== String(correctAnswer) && !distractors.includes(g)) distractors.push(g);
    }
    optionLabels = shuffle([String(correctAnswer), ...distractors.slice(0, 3)])
      .map(v => ({ value: String(v), label: `${v} / ${toOlChikiNumber(v)}` }));
  }

  quizEl.style.display = 'block';
  quizEl.innerHTML = `
    <div class="quiz-area" id="quiz-inner-${escapeHtml(itemId)}" data-correct="${escapeHtml(String(correctAnswer))}">
      <div class="quiz-question">${questionText}</div>
      <div class="quiz-options">
        ${optionLabels.map((opt, idx) => `
          <button type="button" class="quiz-option"
                  id="qopt-${escapeHtml(itemId)}-${idx}"
                  data-value="${escapeHtml(String(opt.value))}"
                  aria-label="${escapeHtml(opt.label)}">
            ${escapeHtml(opt.label)}
          </button>
        `).join('')}
      </div>
      <div class="quiz-feedback" id="quiz-fb-${escapeHtml(itemId)}" aria-live="polite"></div>
    </div>
  `;

  const quizInner = document.getElementById(`quiz-inner-${itemId}`);
  if (quizInner) {
    quizInner.querySelectorAll('.quiz-option').forEach((button, idx) => {
      button.addEventListener('click', () => {
        checkAnswer(topicId, itemId, button.dataset.value, correctAnswer, idx, correctDisplay);
      });
    });
  }

  quizEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function checkAnswer(topicId, itemId, chosen, correct, idx, correctDisplay) {
  const options  = Array.from(document.querySelectorAll(`[id^="qopt-${itemId}-"]`));
  const chosenEl = document.getElementById(`qopt-${itemId}-${idx}`);
  const fbEl     = document.getElementById(`quiz-fb-${itemId}`);

  if (!chosenEl || !fbEl || !options.length) return;

  options.forEach(el => {
    el.disabled = true;
    el.classList.remove('correct', 'wrong');
  });

  const isCorrect = String(chosen).trim() === String(correct).trim();

  options.forEach(el => {
    if (String(el.dataset.value).trim() === String(correct).trim()) {
      el.classList.add('correct');
    }
  });

  if (isCorrect) {
    fbEl.innerHTML = '✓ <strong>सही उत्तर / ᱴᱷᱤᱠ ᱡᱚᱵᱟᱵ</strong>';
    fbEl.className = 'quiz-feedback correct';
  } else {
    chosenEl.classList.add('wrong');
    fbEl.innerHTML = '✗ <strong>गलत उत्तर / ᱵᱟᱝ ᱴᱷᱤᱠ</strong><br><span>सही उत्तर / ᱴᱷᱤᱠ ᱡᱚᱵᱟᱵ: <strong>' + escapeHtml(String(correctDisplay || correct)) + '</strong></span>';
    fbEl.className = 'quiz-feedback wrong';
  }

  // Persist score in localStorage (master functionality preserved)
  const scores = JSON.parse(localStorage.getItem(SCORES_KEY) || '{}');
  if (!scores[topicId]) scores[topicId] = { correct: 0, attempts: 0 };
  scores[topicId].attempts++;
  if (isCorrect) scores[topicId].correct++;
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));

  renderCurriculumProgressLabel(topicId, scores[topicId]);
}

function renderCurriculumProgressLabel(topicId, sc) {
  const header = document.querySelector(`#topic-${topicId} .topic-progress`);
  if (!header) {
    const titleEl = document.querySelector(`#topic-${topicId} .topic-title`);
    if (titleEl) {
      const span = document.createElement('span');
      span.className = 'topic-progress';
      titleEl.after(span);
    }
  }
  const el = document.querySelector(`#topic-${topicId} .topic-progress`);
  if (el && sc.attempts > 0) {
    const pct = Math.round((sc.correct / sc.attempts) * 100);
    el.textContent = `${sc.correct}/${sc.attempts} correct (${pct}%)`;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   SCREEN 3 — WORKSHEET GENERATOR
   ============================================================ */
async function initWorksheet() {
  const topicSelect = document.getElementById('ws-topic');
  const countInput  = document.getElementById('ws-count');
  const langSelect  = document.getElementById('ws-language');
  const genBtn      = document.getElementById('ws-generate-btn');
  const printBtn    = document.getElementById('ws-print-btn');

  if (!allCurriculum.length) {
    try {
      const res  = await fetch('./data/curriculum.json');
      allCurriculum = await res.json();
    } catch (e) { return; }
  }

  // Populate options: First Standard FLN Math/Visual topics first, then standard vocabulary topics
  const mathTopics     = allCurriculum.filter(t => t.worksheetType);
  const standardTopics = allCurriculum.filter(t => !t.worksheetType);

  let topicOptionsHtml = '';
  if (mathTopics.length) {
    topicOptionsHtml += `<optgroup label="First Standard (FLN Mathematics & Visuals)">`;
    topicOptionsHtml += mathTopics.map(t => `<option value="${escapeHtml(t.id)}">${t.icon || '📘'} ${escapeHtml(t.topic)}</option>`).join('');
    topicOptionsHtml += `</optgroup>`;
  }
  if (standardTopics.length) {
    topicOptionsHtml += `<optgroup label="Curriculum Vocabulary Topics">`;
    topicOptionsHtml += standardTopics.map(t => `<option value="${escapeHtml(t.id)}">${t.icon || '📘'} ${escapeHtml(t.topic)}</option>`).join('');
    topicOptionsHtml += `</optgroup>`;
  }
  if (allFlashcards && allFlashcards.length) {
    topicOptionsHtml += `<optgroup label="Flashcard Modules">`;
    topicOptionsHtml += `<option value="fc-numbers-1-20">🔢 Numbers 1–20 (Class 1 Mathematics)</option>`;
    topicOptionsHtml += `</optgroup>`;
  }

  topicSelect.innerHTML = topicOptionsHtml;

  if (langSelect) langSelect.value = 'bilingual';
  countInput.value = Math.min(10, Math.max(3, parseInt(countInput.value, 10) || 5));

  genBtn.addEventListener('click', generateWorksheet);
  printBtn.addEventListener('click', () => window.print());
}

function generateWorksheet() {
  const topicId  = document.getElementById('ws-topic').value;
  const count    = Math.min(10, Math.max(3, parseInt(document.getElementById('ws-count').value, 10) || 5));
  let topic      = allCurriculum.find(t => t.id === topicId);
  const output   = document.getElementById('worksheet-output');
  const printBtn = document.getElementById('ws-print-btn');
  const today    = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });

  // Mode A: Flashcards Numbers 1-20 (master original preserved)
  if (topicId === 'fc-numbers-1-20') {
    topic = {
      id: 'fc-numbers-1-20',
      topic: 'Numbers 1–20 (Class 1 Mathematics)',
      icon: '🔢'
    };
    const pool = allFlashcards
      .filter(fc => fc.category === 'numbers' || fc.number !== undefined)
      .map(fc => ({
        hindi: `${fc.hindi} (${fc.number})`,
        english: `Number ${fc.number}`,
        santhali: `${fc.olChiki}`
      }));

    const questions = [];
    for (let i = 0; i < count; i++) {
      const item = pool[i % pool.length];
      const type = i % 2 === 0 ? 'fill' : 'match';
      questions.push({ item, type });
    }

    const qHtml = questions.map((q, i) => {
      if (q.type === 'fill') {
        return `<div class="ws-question">
          <span class="ws-q-num">${i + 1}.</span>
          <span>The Santhali word for <strong>${q.item.hindi}</strong> (${q.item.english}) is
            <span class="ws-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>.
          </span>
        </div>`;
      } else {
        return `<div class="ws-question">
          <span class="ws-q-num">${i + 1}.</span>
          <span>Match: <strong>${q.item.hindi}</strong> (${q.item.english})
            ↔ <span class="ws-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
            (write the Santhali translation)
          </span>
        </div>`;
      }
    }).join('');

    const ansHtml = questions.map((q, i) => `
      <div class="ws-answer">
        <span class="ws-a-num">${i + 1}.</span>
        <span>${q.item.santhali}</span>
      </div>
    `).join('');

    output.className = '';
    output.innerHTML = `
      <div class="ws-header">
        <h2>MaatriSetu AI — FLN Worksheet</h2>
        <p>Topic: ${topic.icon} ${topic.topic} &nbsp;|&nbsp; Date: ${today} &nbsp;|&nbsp; Name: _______________________</p>
      </div>
      <div class="ws-questions">${qHtml}</div>
      <hr class="ws-divider">
      <div class="ws-answer-key">
        <h3>Answer Key</h3>
        ${ansHtml}
      </div>
      <p class="ws-caption">Generated from structured curriculum data — template-based generation, not AI-authored content.</p>
    `;

    output.style.display = 'block';
    printBtn.style.display = 'inline-flex';
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (!topic) return;

  // Mode B: First Standard FLN Visual / Math Worksheet (new unique feature)
  if (topic.worksheetType) {
    const questions = buildWorksheetQuestions(topic, count);
    const qHtml = questions.map((q, i) => renderWorksheetQuestion(q, i)).join('');
    const ansHtml = questions.map((q, i) => renderWorksheetAnswer(q, i)).join('');

    output.className = 'worksheet-output-bilingual';
    output.innerHTML = `
      <div class="ws-header">
        <h2>MaatriSetu AI — कक्षा 1 कार्यपत्रक / ᱯᱟᱹᱦᱤᱞ ᱥᱮᱱᱛᱟᱲᱤ ᱯᱟᱹᱦᱟᱣ</h2>
        <p>हिन्दी + ᱥᱟᱱᱛᱟᱲᱤ &nbsp;|&nbsp; दिनांक / ᱢᱟᱦᱤᱛ: ${today} &nbsp;|&nbsp; नाम / ᱧᱩᱛᱩᱢ: _______________________</p>
      </div>
      <div class="ws-questions">${qHtml}</div>
      <hr class="ws-divider">
      <div class="ws-answer-key">
        <h3>उत्तरमाला / ᱡᱚᱵᱟᱵ ᱠᱟᱹᱴ</h3>
        ${ansHtml}
      </div>
      <p class="ws-caption">Generated from structured curriculum data — template-based generation, not AI-authored content.</p>
    `;

    output.style.display = 'block';
    printBtn.style.display = 'inline-flex';
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Mode C: Standard Curriculum Vocabulary Topic (master original preserved)
  const pool = topic.items || [];
  if (!pool.length) return;

  const questions = [];
  for (let i = 0; i < count; i++) {
    const item = pool[i % pool.length];
    const type = i % 2 === 0 ? 'fill' : 'match';
    questions.push({ item, type });
  }

  const qHtml = questions.map((q, i) => {
    if (q.type === 'fill') {
      return `<div class="ws-question">
        <span class="ws-q-num">${i + 1}.</span>
        <span>The Santhali word for <strong>${q.item.hindi}</strong> (${q.item.english}) is
          <span class="ws-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>.
        </span>
      </div>`;
    } else {
      return `<div class="ws-question">
        <span class="ws-q-num">${i + 1}.</span>
        <span>Match: <strong>${q.item.hindi}</strong> (${q.item.english})
          ↔ <span class="ws-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          (write the Santhali translation)
        </span>
      </div>`;
    }
  }).join('');

  const ansHtml = questions.map((q, i) => `
    <div class="ws-answer">
      <span class="ws-a-num">${i + 1}.</span>
      <span>${q.item.santhali}</span>
    </div>
  `).join('');

  output.className = '';
  output.innerHTML = `
    <div class="ws-header">
      <h2>MaatriSetu AI — FLN Worksheet</h2>
      <p>Topic: ${topic.icon} ${topic.topic} &nbsp;|&nbsp; Date: ${today} &nbsp;|&nbsp; Name: _______________________</p>
    </div>
    <div class="ws-questions">${qHtml}</div>
    <hr class="ws-divider">
    <div class="ws-answer-key">
      <h3>Answer Key</h3>
      ${ansHtml}
    </div>
    <p class="ws-caption">Generated from structured curriculum data — template-based generation, not AI-authored content.</p>
  `;

  output.style.display = 'block';
  printBtn.style.display = 'inline-flex';
  output.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildWorksheetQuestions(topic, count) {
  const type = topic.worksheetType;
  const questions = [];

  if (type === 'counting') {
    const values = shuffle([1,2,3,4,5,6,7,8,9,10]);
    for (let i = 0; i < count; i++) questions.push({ type, answer: values[i % values.length] });
  }

  if (type === 'addition') {
    for (let i = 0; i < count; i++) {
      const a = 1 + Math.floor(Math.random() * 5);
      const b = 1 + Math.floor(Math.random() * (6 - a));
      questions.push({ type, a, b, answer: a + b });
    }
  }

  if (type === 'subtraction') {
    for (let i = 0; i < count; i++) {
      const a = 2 + Math.floor(Math.random() * 9);
      const b = Math.floor(Math.random() * (a + 1));
      questions.push({ type, a, b, answer: a - b });
    }
  }

  if (type === 'number_spelling') {
    shuffle(topic.numberSpelling || []).slice(0, count).forEach(item => questions.push({
      type, number: item.number, hindi: item.hindi, santhali: item.santhali, olchikiNumber: item.olchikiNumber
    }));
  }

  if (type === 'colors' || type === 'body_parts') {
    const pool = shuffle(topic.worksheetItems || []);
    for (let i = 0; i < count && pool.length; i++) {
      const item = pool[i % pool.length];
      questions.push({
        type, hindi: item.hindi, santhali: item.santhali, color: item.color, part: item.part
      });
    }
  }

  return questions;
}

function renderWorksheetQuestion(q, index) {
  const n = index + 1;
  if (q.type === 'counting') return `
    <div class="ws-question ws-counting-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>चित्रों को गिनकर संख्या लिखिए:</div><div class="ws-santhali-text">ᱪᱤᱛᱟᱹᱨ ᱠᱚ ᱮᱞ ᱮᱢ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-counting-objects">${Array.from({length: q.answer}, (_, i) => makeObjectSvg(i)).join('')}</div>
      <div class="ws-answer-line"><span class="ws-blank ws-number-blank"></span></div></div></div>`;

  if (q.type === 'addition') return `
    <div class="ws-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>जोड़कर उत्तर लिखिए:</div><div class="ws-santhali-text">ᱡᱚᱲ ᱠᱟᱛᱮ ᱡᱚᱵᱟᱵ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-math-equation">${q.a} + ${q.b} = <span class="ws-blank ws-number-blank"></span></div></div></div>`;

  if (q.type === 'subtraction') return `
    <div class="ws-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>घटाकर उत्तर लिखिए:</div><div class="ws-santhali-text">ᱠᱟᱹᱴ ᱠᱟᱛᱮ ᱡᱚᱵᱟᱵ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-math-equation">${q.a} − ${q.b} = <span class="ws-blank ws-number-blank"></span></div></div></div>`;

  if (q.type === 'number_spelling') return `
    <div class="ws-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>संख्या का नाम लिखिए:</div><div class="ws-santhali-text">ᱮᱞ ᱨᱮᱭᱟᱜ ᱧᱩᱛᱩᱢ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-number-spelling-row"><span class="ws-large-number">${q.number} / ${q.olchikiNumber || q.number}</span><span class="ws-blank ws-spelling-blank"></span></div></div></div>`;

  if (q.type === 'colors') return `
    <div class="ws-question ws-picture-identification-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>चित्र का रंग पहचानकर उसका नाम लिखिए:</div><div class="ws-santhali-text">ᱪᱤᱛᱟᱹᱨ ᱨᱮᱭᱟᱜ ᱨᱚᱝ ᱧᱮᱞ ᱠᱟᱛᱮ ᱧᱩᱛᱩᱢ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-color-picture"><svg viewBox="0 0 150 100" class="ws-color-svg"><circle cx="75" cy="50" r="34" fill="${q.color}" stroke="#222" stroke-width="3"/></svg></div>
      <div class="ws-answer-line"><span class="ws-blank ws-spelling-blank"></span></div></div></div>`;

  if (q.type === 'body_parts') return `
    <div class="ws-question ws-picture-identification-question"><span class="ws-q-num">${n}.</span><div class="ws-q-content">
      <div class="ws-instruction"><div>चित्र में दिखाए गए शरीर के अंग का नाम लिखिए:</div><div class="ws-santhali-text">ᱪᱤᱛᱟᱹᱨ ᱨᱮ ᱩᱫᱜᱟᱹ ᱦᱚᱲᱢᱚ ᱵᱷᱟᱜ ᱨᱮᱭᱟᱜ ᱧᱩᱛᱩᱢ ᱚᱞ ᱢᱮ:</div></div>
      <div class="ws-body-picture">${makeBodyPartSvg(q.part)}</div>
      <div class="ws-answer-line"><span class="ws-blank ws-spelling-blank"></span></div></div></div>`;
  return '';
}

function renderWorksheetAnswer(q, index) {
  const n = index + 1;
  let hindiAnswer = '', santhaliAnswer = '';
  if (q.type === 'number_spelling' || q.type === 'colors' || q.type === 'body_parts') {
    hindiAnswer = q.hindi; santhaliAnswer = q.santhali;
  } else {
    hindiAnswer = String(q.answer); santhaliAnswer = toOlChikiNumber(q.answer);
  }
  return `<div class="ws-answer"><span class="ws-a-num">${n}.</span><span><strong>हिन्दी:</strong> ${escapeHtml(hindiAnswer)}</span><span class="ws-answer-santhali"><strong>ᱥᱟᱱᱛᱟᱲᱤ:</strong> ${escapeHtml(santhaliAnswer)}</span></div>`;
}


/* ============================================================
   SCREEN 4 — CORRECTIONS LOG
   ============================================================ */
function renderCorrectionsLog() {
  const container = document.getElementById('corrections-log');
  const raw = localStorage.getItem(CORRECTIONS_KEY);
  const entries = raw ? JSON.parse(raw) : [];

  if (!entries.length) {
    container.innerHTML = `
      <div class="log-empty">
        <div class="log-empty-icon">📋</div>
        <p>No corrections submitted yet — try flagging one from the <strong>Phrasebook</strong> tab.</p>
      </div>`;
    return;
  }

  // Newest first
  const sorted = [...entries].reverse();

  container.innerHTML = `
    <table class="log-table">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Hindi Phrase</th>
          <th>Original (Placeholder)</th>
          <th>Suggested Correction</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(e => `
          <tr>
            <td style="white-space:nowrap;font-size:0.75rem;">${formatDate(e.timestamp)}</td>
            <td class="td-hindi">${e.hindiText}</td>
            <td style="font-size:0.78rem;">${e.originalTranslation}</td>
            <td style="color:var(--clr-white);font-weight:600;">${e.suggestedTranslation}</td>
            <td>
              ${e.status === 'unmatched_phrase'
                ? '<span class="log-status-tag unmatched">⚠️ Unmatched Phrase</span>'
                : '<span class="log-status-tag">⏳ Awaiting native-speaker review</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

/* ============================================================
   SPEECH RECOGNITION & PHRASE / CURRICULUM MATCHING (ONLINE / BROWSER-DEPENDENT)
   ============================================================ */
let recognitionInstance = null;
let isLiveSessionActive = false;
let speechRestartTimeout = null;

function initSpeechRecognition() {
  const speechBtn = document.getElementById('speech-btn');
  const speechStatus = document.getElementById('speech-status');
  if (!speechBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    speechBtn.addEventListener('click', () => {
      if (speechStatus) {
        speechStatus.className = 'speech-status-msg warning offline-notice';
        speechStatus.textContent = "Live speech recognition isn't supported in this browser. Try Google Chrome or Microsoft Edge. All other educational features continue to work offline.";
      }
    });
    return;
  }

  try {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'hi-IN';
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
  } catch (err) {
    speechBtn.addEventListener('click', () => {
      if (speechStatus) {
        speechStatus.className = 'speech-status-msg warning offline-notice';
        speechStatus.textContent = "Live speech recognition could not be initialized in this browser. All other educational features continue to work offline.";
      }
    });
    return;
  }

  speechBtn.addEventListener('click', () => {
    if (isLiveSessionActive) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  });

  recognitionInstance.onresult = (event) => {
    const speechEndTime = performance.now();
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const recognizedText = event.results[i][0].transcript.trim();
        if (recognizedText) {
          handleRecognizedHindi(recognizedText, speechEndTime);
        }
      }
    }
  };

  recognitionInstance.onerror = (event) => {
    if (event.error === 'network') {
      handleOfflineSpeechError();
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      isLiveSessionActive = false;
      updateLiveSessionUI(false);
      if (speechStatus) {
        speechStatus.className = 'speech-status-msg error';
        speechStatus.textContent = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
      }
    } else if (event.error === 'no-speech') {
      // Silence timeout — automatic silent restart in onend handles this while session is active
    } else {
      console.warn('Speech recognition event:', event.error);
    }
  };

  recognitionInstance.onend = () => {
    if (isLiveSessionActive) {
      clearTimeout(speechRestartTimeout);
      speechRestartTimeout = setTimeout(() => {
        if (isLiveSessionActive) {
          try {
            recognitionInstance.start();
          } catch (e) {
            if (!navigator.onLine) {
              handleOfflineSpeechError();
            }
          }
        }
      }, 150);
    } else {
      updateLiveSessionUI(false);
    }
  };
}

function handleOfflineSpeechError() {
  isLiveSessionActive = false;
  clearTimeout(speechRestartTimeout);
  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch (e) {}
  }
  updateLiveSessionUI(false);

  const speechStatus = document.getElementById('speech-status');
  if (speechStatus) {
    speechStatus.className = 'speech-status-msg warning offline-notice';
    speechStatus.textContent = 'Live speech recognition requires an internet connection in this browser. All other educational features continue to work offline.';
  }
}

function startLiveSession() {
  const speechStatus = document.getElementById('speech-status');
  if (!recognitionInstance) return;

  if (!navigator.onLine) {
    handleOfflineSpeechError();
    return;
  }

  isLiveSessionActive = true;
  clearTimeout(speechRestartTimeout);

  updateLiveSessionUI(true);
  if (speechStatus) {
    speechStatus.className = 'speech-status-msg';
    speechStatus.textContent = '🎙️ Live Classroom Session active — listening for continuous classroom instructions…';
  }

  try {
    recognitionInstance.start();
  } catch (e) {
    if (!navigator.onLine) {
      handleOfflineSpeechError();
    }
  }
}

function stopLiveSession() {
  isLiveSessionActive = false;
  clearTimeout(speechRestartTimeout);
  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch (e) {}
  }
  updateLiveSessionUI(false);
  const speechStatus = document.getElementById('speech-status');
  if (speechStatus) {
    speechStatus.className = 'speech-status-msg';
    speechStatus.textContent = 'Live session ended.';
  }
}

function updateLiveSessionUI(isActive) {
  const speechBtn = document.getElementById('speech-btn');
  const liveIndicator = document.getElementById('live-indicator');
  if (!speechBtn) return;

  if (isActive) {
    speechBtn.classList.add('listening');
    speechBtn.innerHTML = '🔴 Stop Live Session';
    if (liveIndicator) liveIndicator.style.display = 'inline-flex';
  } else {
    speechBtn.classList.remove('listening');
    speechBtn.innerHTML = '🎙️ Start Live Session';
    if (liveIndicator) liveIndicator.style.display = 'none';
  }
}

function normalizeHindiText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[।.,?!;:\-"'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingPhrase(speechText, phrases) {
  const normSpeech = normalizeHindiText(speechText);
  if (!normSpeech) return null;

  // 1. Exact match first
  for (const p of phrases) {
    const normHindi = normalizeHindiText(p.hindi);
    if (normHindi === normSpeech) {
      return p;
    }
  }

  // 2. Partial / fuzzy match (substring & word overlap)
  const speechWords = normSpeech.split(' ').filter(w => w.length > 0);
  let bestMatch = null;
  let highestScore = 0;

  for (const p of phrases) {
    const normHindi = normalizeHindiText(p.hindi);

    // Substring match check
    if (normHindi.includes(normSpeech) || normSpeech.includes(normHindi)) {
      const minLen = Math.min(normHindi.length, normSpeech.length);
      const maxLen = Math.max(normHindi.length, normSpeech.length);
      const score = 0.75 + (minLen / maxLen) * 0.25;
      if (score > highestScore) {
        highestScore = score;
        bestMatch = p;
      }
      continue;
    }

    // Word overlap check
    const phraseWords = normHindi.split(' ').filter(w => w.length > 0);
    if (speechWords.length === 0 || phraseWords.length === 0) continue;

    let matchingWordsCount = 0;
    for (const word of speechWords) {
      if (phraseWords.includes(word)) {
        matchingWordsCount++;
      }
    }

    const speechOverlap = matchingWordsCount / speechWords.length;
    const phraseOverlap = matchingWordsCount / phraseWords.length;
    const score = (speechOverlap * 0.6) + (phraseOverlap * 0.4);

    if (matchingWordsCount > 0 && score > highestScore) {
      highestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch && highestScore >= 0.3) {
    return bestMatch;
  }

  return null;
}

function findMatchingCurriculumItem(speechText, curriculum) {
  const flattened = [];
  for (const topic of curriculum) {
    const displayItems = topic.worksheetType === 'number_spelling'
      ? (topic.numberSpelling || []).map((item, index) => ({
          id: `ns${item.number ?? index + 1}`,
          hindi: item.hindi,
          english: item.english || '',
          santhali: item.santhali
        }))
      : (topic.items || []);

    for (const item of displayItems) {
      flattened.push({
        ...item,
        topicId: topic.id,
        topicName: topic.topic
      });
    }
  }
  return findMatchingPhrase(speechText, flattened);
}

async function ensureCurriculumLoaded() {
  if (!allCurriculum.length) {
    try {
      const res = await fetch('./data/curriculum.json');
      allCurriculum = await res.json();
    } catch (e) {
      console.error('Could not load curriculum data for matching:', e);
    }
  }
}

async function handleRecognizedHindi(recognizedText, speechEndTime) {
  const speechStatus = document.getElementById('speech-status');
  const latencyBadge = document.getElementById('latency-badge');
  const latencyVal   = document.getElementById('latency-val');

  function updateLatencyDisplay() {
    if (speechEndTime && latencyBadge && latencyVal) {
      const playbackStartTime = performance.now();
      const latencySec = Math.max(0.1, (playbackStartTime - speechEndTime) / 1000).toFixed(1);
      latencyVal.textContent = `${latencySec}s`;
      latencyBadge.style.display = 'inline-flex';
    }
  }

  // 1. Search phrases first
  const phraseMatched = findMatchingPhrase(recognizedText, allPhrases);

  if (phraseMatched) {
    // Reset search filter if active
    const searchEl = document.getElementById('phrase-search');
    if (searchEl && searchEl.value) {
      searchEl.value = '';
      renderPhrases(allPhrases);
    }

    // Automatically trigger phrase audio playback if available
    const hasAudio = phraseAudioAvailability.get(phraseMatched.id);
    if (hasAudio) {
      playPhraseAudio(phraseMatched.id);
    }
    updateLatencyDisplay();

    if (speechStatus) {
      speechStatus.className = 'speech-status-msg success';
      speechStatus.textContent = `✓ Recognized: "${recognizedText}" — Matched phrase: "${phraseMatched.hindi}"`;
    }

    switchTab('tab-phrasebook');

    // Scroll to and visually highlight the matched phrase card
    setTimeout(() => {
      const cardEl = document.querySelector(`.phrase-card[data-id="${phraseMatched.id}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.classList.add('card-highlight');
        setTimeout(() => {
          cardEl.classList.remove('card-highlight');
        }, 3500);
      }
    }, 150);
    return;
  }

  // 2. Search curriculum next
  await ensureCurriculumLoaded();
  const curriculumMatched = findMatchingCurriculumItem(recognizedText, allCurriculum);

  if (curriculumMatched) {
    updateLatencyDisplay();
    if (speechStatus) {
      speechStatus.className = 'speech-status-msg success';
      speechStatus.textContent = `✓ Recognized: "${recognizedText}" — Found in Curriculum: ${curriculumMatched.topicName}`;
    }

    // Automatically switch to Curriculum tab, expand topic, and highlight matching term
    switchTab('tab-curriculum');
    expandTopic(curriculumMatched.topicId);

    setTimeout(() => {
      const cardEl = document.getElementById(`fc-${curriculumMatched.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.classList.add('card-highlight');
        setTimeout(() => {
          cardEl.classList.remove('card-highlight');
        }, 3500);
      }
    }, 150);
    return;
  }

  // 3. No match in phrases OR curriculum — treat as unmatched
  if (speechStatus) {
    speechStatus.className = 'speech-status-msg warning';
    speechStatus.textContent = `⚠️ Recognized: "${recognizedText}" — Phrase not in bank (auto-flagged for review)`;
  }

  logUnmatchedPhrase(recognizedText);
}

function logUnmatchedPhrase(hindiText) {
  const norm = normalizeHindiText(hindiText);
  if (!norm) return;

  const existing = JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]');
  const isDuplicate = existing.some(e => 
    e.status === 'unmatched_phrase' && normalizeHindiText(e.hindiText) === norm
  );
  if (isDuplicate) return;

  const entry = {
    phraseId: 'unmatched_' + Date.now(),
    hindiText: hindiText,
    originalTranslation: 'N/A (Speech input)',
    suggestedTranslation: 'Phrase not in bank — auto-flagged for review',
    status: 'unmatched_phrase',
    timestamp: new Date().toISOString()
  };
  existing.push(entry);
  localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(existing));

  const correctionsTab = document.getElementById('tab-corrections');
  if (correctionsTab && correctionsTab.classList.contains('active')) {
    renderCorrectionsLog();
  }
}

/* ============================================================
   SCREEN 5 — FLASHCARDS (FLN Multilingual Foundation)
   ============================================================ */

const FLASHCARD_CATEGORIES = {
  numbers: {
    name: 'Numbers',
    badge: 'Class 1 • Foundational Numeracy',
    subBadge: 'Numbers 1–20 • Counting',
    headerSub: 'Class 1 Foundational Numeracy: Numbers 1–20 with quantity visuals, Hindi & Ol Chiki scripts, and native audio.'
  },
  colours: {
    name: 'Colours',
    badge: 'Class 1 • Language & Visual Skills',
    subBadge: 'Colours • 10 Verified Tones',
    headerSub: 'Foundational colour recognition: Hindi & Santali (Ol Chiki) with visual colour swatches and native audio.'
  },
  body: {
    name: 'Body Parts',
    badge: 'Class 1 • Foundational Vocabulary',
    subBadge: 'Parts of the Body • शरीर के अंग',
    headerSub: 'Human body parts: Hindi & Santali (Ol Chiki) with friendly highlighted illustrations and native audio.'
  },
  shapes: {
    name: 'Shapes',
    badge: 'Class 1 • Foundational Geometry',
    subBadge: 'Shapes • आकार / ᱢᱩᱴᱷᱟᱹᱱ',
    headerSub: 'Foundational geometric shapes: Hindi & Santali (Ol Chiki) with crisp vector graphics and native audio.'
  }
};

// Reusable Flashcard Data Object for Worksheet Generator & other modules
window.FlashcardData = {
  class: 1,
  subject: 'Foundational Multilingual Learning',
  topic: 'Numbers, Colours, Body Parts, Shapes',
  learningSkill: 'Foundational vocabulary, numeracy, and script recognition',
  getCards: (category) => category ? allFlashcards.filter(c => c.category === category) : allFlashcards,
  getCardById: (id) => allFlashcards.find(c => c.id === id),
  getCardByNumber: (num) => allFlashcards.find(c => c.number === num),
  getCategories: () => ['numbers', 'colours', 'body', 'shapes']
};

function getCategoryCards(cat = currentCategory) {
  return allFlashcards.filter(c => c.category === cat);
}

async function initFlashcards() {
  const wrapper = document.getElementById('fc-card-wrapper');

  try {
    const res = await fetch('./data/flashcards.json');
    allFlashcards = await res.json();
  } catch (e) {
    if (wrapper) {
      wrapper.innerHTML = '<p class="empty-state">⚠️ Could not load flashcard data. Ensure local server is running.</p>';
    }
    return;
  }

  // Update worksheet generator dropdown if already initialized
  const wsTopic = document.getElementById('ws-topic');
  if (wsTopic && !wsTopic.querySelector('option[value="fc-numbers-1-20"]')) {
    const opt = document.createElement('option');
    opt.value = 'fc-numbers-1-20';
    opt.textContent = '🔢 Numbers 1–20 (Class 1 Mathematics)';
    wsTopic.appendChild(opt);
  }

  // Setup Category Selector buttons
  const catButtons = document.querySelectorAll('.fc-cat-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      stopCurrentFlashcardAudio();
      catButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      currentCategory = btn.dataset.category || 'numbers';
      currentCardIndex = 0;

      // Update Header & Badge Meta
      const meta = FLASHCARD_CATEGORIES[currentCategory] || FLASHCARD_CATEGORIES.numbers;
      const subEl = document.getElementById('fc-header-sub');
      const badgePill = document.getElementById('fc-badge-pill');
      const badgeSub = document.getElementById('fc-badge-sub');

      if (subEl) subEl.textContent = meta.headerSub;
      if (badgePill) badgePill.textContent = meta.badge;
      if (badgeSub) badgeSub.textContent = meta.subBadge;

      if (currentMode === 'learn') {
        renderFlashcard(0);
      } else {
        renderPracticeQuestion();
      }
    });
  });

  // Setup Mode Navigation buttons (Learn / Practice)
  const modeButtons = document.querySelectorAll('.fc-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      stopCurrentFlashcardAudio();
      modeButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const mode = btn.dataset.mode || 'learn';
      switchFlashcardMode(mode);
    });
  });

  // Setup Prev / Next buttons
  const prevBtn = document.getElementById('fc-btn-prev');
  const nextBtn = document.getElementById('fc-btn-next');

  if (prevBtn) prevBtn.addEventListener('click', prevFlashcard);
  if (nextBtn) nextBtn.addEventListener('click', nextFlashcard);

  // Setup touch swipe navigation on the card wrapper
  setupSwipeNavigation();

  // Setup keyboard navigation (ArrowLeft / ArrowRight)
  setupKeyboardNavigation();

  // Initial render in Learn mode
  renderFlashcard(0);
}

function switchFlashcardMode(mode) {
  currentMode = mode;
  stopCurrentFlashcardAudio();

  document.querySelectorAll('.fc-view').forEach(view => view.classList.remove('active'));

  if (mode === 'learn') {
    const learnView = document.getElementById('fc-view-learn');
    if (learnView) learnView.classList.add('active');
    renderFlashcard(currentCardIndex);
  } else {
    const practiceView = document.getElementById('fc-view-practice');
    if (practiceView) practiceView.classList.add('active');
    initPracticeMode();
  }
}

/* ---- Mode 1: Learn ---- */
function renderFlashcard(index) {
  const cards = getCategoryCards();
  if (!cards || !cards.length) return;

  if (index < 0) index = 0;
  if (index >= cards.length) index = cards.length - 1;
  currentCardIndex = index;

  stopCurrentFlashcardAudio();

  const card = cards[currentCardIndex];
  const wrapper = document.getElementById('fc-card-wrapper');
  const counter = document.getElementById('fc-counter');
  const prevBtn = document.getElementById('fc-btn-prev');
  const nextBtn = document.getElementById('fc-btn-next');

  if (counter) counter.textContent = `${currentCardIndex + 1} / ${cards.length}`;
  if (prevBtn) prevBtn.disabled = (currentCardIndex === 0);
  if (nextBtn) nextBtn.disabled = (currentCardIndex === cards.length - 1);

  const visualHtml = generateCardVisual(card);
  const categoryMeta = FLASHCARD_CATEGORIES[card.category] || { name: card.category };

  if (wrapper) {
    wrapper.innerHTML = `
      <div class="child-flashcard" id="fc-active-card" role="region" aria-label="${card.english || card.hindi}">
        <div class="fc-card-top">
          <div class="fc-card-tags">
            <span class="fc-id-tag">${card.id}</span>
            <span class="fc-category-tag">${categoryMeta.name}</span>
          </div>
          <span class="fc-verified-tag">✓ Verified</span>
        </div>

        <!-- Central Visual Stage -->
        <div class="fc-visual-stage">
          ${visualHtml}
        </div>

        <!-- Bilingual Display: Hindi & Santali (Ol Chiki) -->
        <div class="fc-words-container">
          <span class="fc-hindi-label">Hindi</span>
          <div class="fc-hindi-word">${card.hindi}</div>

          <div class="fc-ol-chiki-section">
            <span class="fc-ol-chiki-label">Santali / Ol Chiki</span>
            <div class="fc-ol-chiki-glyph">${card.olChiki}</div>
          </div>
        </div>

        <!-- Audio Button -->
        <div class="fc-audio-section">
          <button class="fc-audio-btn-pill" id="fc-audio-btn"
                  onclick="playFlashcardAudio('${card.id}', '${card.audio}')"
                  aria-label="Play Santali audio for ${card.english || card.hindi}">
            🔊 Play Santali Audio
          </button>
          <div class="fc-audio-status" id="fc-audio-status" aria-live="polite"></div>
        </div>
      </div>
    `;
  }
}

function prevFlashcard() {
  if (currentCardIndex > 0) {
    renderFlashcard(currentCardIndex - 1);
  }
}

function nextFlashcard() {
  const cards = getCategoryCards();
  if (currentCardIndex < cards.length - 1) {
    renderFlashcard(currentCardIndex + 1);
  }
}

/* ---- Visual Stage Renderers (Pure SVG / CSS, Lightweight & 100% Offline) ---- */
function generateCardVisual(card) {
  if (card.category === 'numbers' || card.number !== undefined) {
    const n = card.number;
    const rows = Math.ceil(n / 5);
    let rowsHtml = '';
    for (let r = 0; r < rows; r++) {
      const countInRow = Math.min(5, n - r * 5);
      let items = '';
      for (let d = 0; d < countInRow; d++) {
        items += `<span class="fc-apple-item" aria-hidden="true">🍎</span>`;
      }
      rowsHtml += `<div class="fc-dot-row">${items}</div>`;
    }
    return `
      <div class="fc-arabic-number" aria-label="Number ${n}">${n}</div>
      <div class="fc-quantity-container" aria-label="${n} objects">
        ${rowsHtml}
      </div>
    `;
  }

  if (card.category === 'colours') {
    const hex = card.visual || '#FFFFFF';
    const isWhite = hex.toUpperCase() === '#FFFFFF';
    const borderStyle = isWhite ? 'border: 3px solid #888;' : '';
    return `
      <div class="fc-colour-swatch-container">
        <div class="fc-colour-swatch" style="background-color: ${hex}; ${borderStyle}" aria-label="${card.english} colour">
          <span class="fc-colour-shine" aria-hidden="true"></span>
        </div>
      </div>
    `;
  }

  if (card.category === 'body') {
    return generateBodyVisualSvg(card.visual);
  }

  if (card.category === 'shapes') {
    return generateShapeVisualSvg(card.visual);
  }

  return `<div class="fc-arabic-number">★</div>`;
}

/* Friendly Child Face SVG for Body Parts */
function generateBodyVisualSvg(part) {
  const isHead   = part === 'head';
  const isHair   = part === 'hair';
  const isFace   = part === 'face';
  const isEye    = part === 'eye';
  const isEar    = part === 'ear';
  const isNose   = part === 'nose';
  const isMouth  = part === 'mouth';
  const isTeeth  = part === 'teeth';
  const isTongue = part === 'tongue';

  return `
  <div class="fc-body-illustration-box">
    <svg class="fc-body-svg" viewBox="0 0 160 150" aria-label="Body part illustration: ${part}">
      <!-- Neck -->
      <rect x="70" y="112" width="20" height="26" rx="5" fill="#f0c294" />
      <!-- Shoulders -->
      <path d="M 38 145 C 55 125, 105 125, 122 145 Z" fill="#8B2635" />

      <!-- Ears -->
      <ellipse cx="32" cy="72" rx="9" ry="12" fill="#e8b284"
               class="${isEar ? 'fc-highlight-pulse' : ''}"
               stroke="${isEar ? '#ffeb3b' : '#c9966e'}" stroke-width="${isEar ? '4' : '1.5'}" />
      <ellipse cx="128" cy="72" rx="9" ry="12" fill="#e8b284"
               class="${isEar ? 'fc-highlight-pulse' : ''}"
               stroke="${isEar ? '#ffeb3b' : '#c9966e'}" stroke-width="${isEar ? '4' : '1.5'}" />

      <!-- Face base -->
      <ellipse cx="80" cy="74" rx="48" ry="52" fill="#f5cba7"
               class="${isFace ? 'fc-highlight-pulse' : ''}"
               stroke="${isFace ? '#ffeb3b' : '#d89b6c'}" stroke-width="${isFace ? '4' : '2'}" />

      <!-- Head / Forehead highlight zone -->
      ${isHead ? `
        <path d="M 42 55 C 50 28, 110 28, 118 55 Z" fill="rgba(255, 235, 59, 0.45)" stroke="#ffeb3b" stroke-width="3.5" class="fc-highlight-pulse" />
      ` : ''}

      <!-- Hair -->
      <path d="M 32 58 C 30 25, 55 10, 80 10 C 105 10, 130 25, 128 58 C 118 42, 98 42, 80 44 C 62 42, 42 42, 32 58 Z"
            fill="${isHair ? '#ffc107' : '#4a2c11'}"
            class="${isHair ? 'fc-highlight-pulse' : ''}"
            stroke="${isHair ? '#ffffff' : '#2b1704'}" stroke-width="${isHair ? '3.5' : '1.5'}" />

      <!-- Eyebrows -->
      <path d="M 52 56 Q 62 52 70 56" stroke="#4a2c11" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 90 56 Q 98 52 108 56" stroke="#4a2c11" stroke-width="2.5" fill="none" stroke-linecap="round" />

      <!-- Eyes -->
      <g class="${isEye ? 'fc-highlight-pulse' : ''}">
        <ellipse cx="61" cy="67" rx="8" ry="6" fill="#ffffff" stroke="${isEye ? '#ffeb3b' : '#666'}" stroke-width="${isEye ? '3' : '1'}" />
        <circle cx="61" cy="67" r="4.5" fill="#2d1c0b" />
        <circle cx="63" cy="65" r="1.5" fill="#ffffff" />
        ${isEye ? '<circle cx="61" cy="67" r="12" fill="none" stroke="#ffeb3b" stroke-width="2.5" stroke-dasharray="3,2" />' : ''}

        <ellipse cx="99" cy="67" rx="8" ry="6" fill="#ffffff" stroke="${isEye ? '#ffeb3b' : '#666'}" stroke-width="${isEye ? '3' : '1'}" />
        <circle cx="99" cy="67" r="4.5" fill="#2d1c0b" />
        <circle cx="101" cy="65" r="1.5" fill="#ffffff" />
        ${isEye ? '<circle cx="99" cy="67" r="12" fill="none" stroke="#ffeb3b" stroke-width="2.5" stroke-dasharray="3,2" />' : ''}
      </g>

      <!-- Cheeks (cute blush) -->
      <ellipse cx="48" cy="80" rx="6" ry="3.5" fill="rgba(235, 87, 87, 0.25)" />
      <ellipse cx="112" cy="80" rx="6" ry="3.5" fill="rgba(235, 87, 87, 0.25)" />

      <!-- Nose -->
      <g class="${isNose ? 'fc-highlight-pulse' : ''}">
        <path d="M 77 72 Q 80 81 83 81 Q 86 81 85 78" fill="none" stroke="${isNose ? '#ffeb3b' : '#ba7a4e'}" stroke-width="${isNose ? '4' : '2.5'}" stroke-linecap="round" />
        ${isNose ? '<circle cx="80" cy="78" r="10" fill="none" stroke="#ffeb3b" stroke-width="2.5" stroke-dasharray="3,2" />' : ''}
      </g>

      <!-- Mouth / Teeth / Tongue -->
      <g class="${isMouth || isTeeth || isTongue ? 'fc-highlight-pulse' : ''}">
        <!-- Open smiling mouth -->
        <path d="M 60 92 Q 80 93 100 92 Q 80 114 60 92 Z" fill="#6d1b24"
              stroke="${isMouth ? '#ffeb3b' : '#b24c56'}" stroke-width="${isMouth ? '3.5' : '1.5'}" />

        <!-- Teeth -->
        <path d="M 66 93 Q 80 94 94 93 L 92 98 Q 80 99 68 98 Z"
              fill="#ffffff"
              stroke="${isTeeth ? '#ffeb3b' : '#dddddd'}" stroke-width="${isTeeth ? '2.5' : '0.5'}" />

        <!-- Tongue -->
        <path d="M 72 102 Q 80 99 88 102 Q 80 114 72 102 Z"
              fill="${isTongue ? '#ff5252' : '#e57373'}"
              stroke="${isTongue ? '#ffeb3b' : '#d32f2f'}" stroke-width="${isTongue ? '2.5' : '0.5'}" />

        ${isMouth ? '<ellipse cx="80" cy="99" rx="24" ry="14" fill="none" stroke="#ffeb3b" stroke-width="2.5" stroke-dasharray="4,2" />' : ''}
        ${isTeeth ? '<rect x="63" y="90" width="34" height="12" rx="4" fill="none" stroke="#ffeb3b" stroke-width="2" stroke-dasharray="3,2" />' : ''}
        ${isTongue ? '<ellipse cx="80" cy="104" rx="14" ry="9" fill="none" stroke="#ffeb3b" stroke-width="2" stroke-dasharray="3,2" />' : ''}
      </g>
    </svg>
  </div>
  `;
}

/* Crisp Vector Shapes for Shapes Category */
function generateShapeVisualSvg(shapeType) {
  if (shapeType === 'circle') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Circle">
          <circle cx="60" cy="55" r="44" fill="#E53935" stroke="#ffffff" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }
  if (shapeType === 'square') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Square">
          <rect x="22" y="17" width="76" height="76" rx="6" fill="#1E88E5" stroke="#ffffff" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }
  if (shapeType === 'triangle') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Triangle">
          <polygon points="60,14 106,96 14,96" fill="#FDD835" stroke="#ffffff" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }
  if (shapeType === 'rectangle') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Rectangle">
          <rect x="12" y="30" width="96" height="50" rx="6" fill="#43A047" stroke="#ffffff" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }
  if (shapeType === 'oval') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Oval">
          <ellipse cx="60" cy="55" rx="50" ry="32" fill="#8E24AA" stroke="#ffffff" stroke-width="2.5" />
        </svg>
      </div>
    `;
  }
  if (shapeType === 'line') {
    return `
      <div class="fc-shape-box">
        <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Line">
          <line x1="12" y1="55" x2="108" y2="55" stroke="#FB8C00" stroke-width="10" stroke-linecap="round" />
        </svg>
      </div>
    `;
  }
  // general shapes composite
  return `
    <div class="fc-shape-box">
      <svg class="fc-shape-svg" viewBox="0 0 120 110" aria-label="Geometric Shapes">
        <circle cx="36" cy="38" r="22" fill="#E53935" stroke="#ffffff" stroke-width="2"/>
        <rect x="68" y="16" width="38" height="38" rx="4" fill="#1E88E5" stroke="#ffffff" stroke-width="2"/>
        <polygon points="40,65 65,102 15,102" fill="#FDD835" stroke="#ffffff" stroke-width="2"/>
        <rect x="70" y="70" width="42" height="26" rx="4" fill="#43A047" stroke="#ffffff" stroke-width="2"/>
      </svg>
    </div>
  `;
}

/* ---- Audio Playback Handling (Local Files On-Demand, Graceful Missing File Handling) ---- */
function playFlashcardAudio(id, audioPath) {
  stopCurrentFlashcardAudio();

  const statusEl = document.getElementById('fc-audio-status');
  const btn = document.getElementById('fc-audio-btn');

  if (!audioPath) {
    if (statusEl) {
      statusEl.textContent = 'Audio not available';
      statusEl.className = 'fc-audio-status unavailable';
    }
    return;
  }

  // Load purely on demand
  const audio = new Audio(audioPath);
  currentAudioObj = audio;

  if (btn) btn.classList.add('playing');
  if (statusEl) {
    statusEl.textContent = 'Playing Santali audio…';
    statusEl.className = 'fc-audio-status playing';
  }

  audio.onended = () => {
    if (btn) btn.classList.remove('playing');
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'fc-audio-status';
    }
    currentAudioObj = null;
  };

  audio.onerror = () => {
    if (btn) btn.classList.remove('playing');
    if (statusEl) {
      statusEl.textContent = 'Audio not available';
      statusEl.className = 'fc-audio-status unavailable';
    }
    currentAudioObj = null;
  };

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      if (btn) btn.classList.remove('playing');
      if (statusEl) {
        statusEl.textContent = 'Audio not available';
        statusEl.className = 'fc-audio-status unavailable';
      }
      currentAudioObj = null;
    });
  }
}

function stopCurrentFlashcardAudio() {
  if (currentAudioObj) {
    try {
      currentAudioObj.pause();
      currentAudioObj.currentTime = 0;
    } catch (e) {}
    currentAudioObj = null;
  }
  const btn = document.getElementById('fc-audio-btn');
  if (btn) btn.classList.remove('playing');
}

/* ---- Mode 2: Interactive Local Practice Mode ---- */
function initPracticeMode() {
  renderPracticeQuestion();
}

function renderPracticeQuestion() {
  const container = document.getElementById('fc-practice-box');
  const cards = getCategoryCards();
  if (!container || !cards || !cards.length) return;

  const targetIndex = Math.floor(Math.random() * cards.length);
  const targetCard = cards[targetIndex];

  // Pick 2 distinct distractors from the current category
  const distractors = [];
  const candidatePool = cards.filter(c => c.id !== targetCard.id);
  const shuffledCandidates = shuffle([...candidatePool]);
  distractors.push(...shuffledCandidates.slice(0, 2));

  const choices = shuffle([targetCard, ...distractors]);

  // Tailor question prompt and text based on active category
  let questionPrompt = 'Mode • Practice Activity';
  let questionText = 'Choose the correct match:';

  if (currentCategory === 'numbers') {
    questionPrompt = 'Mode • Foundational Numeracy';
    questionText = 'How many objects are there? / कितने हैं?';
  } else if (currentCategory === 'colours') {
    questionPrompt = 'Mode • Colour Recognition';
    questionText = 'Which colour is this? / कौन सा रंग है?';
  } else if (currentCategory === 'body') {
    questionPrompt = 'Mode • Body Vocabulary';
    questionText = 'Which body part is highlighted? / कौन सा अंग है?';
  } else if (currentCategory === 'shapes') {
    questionPrompt = 'Mode • Shape Recognition';
    questionText = 'Which shape is this? / कौन सा आकार है?';
  }

  // Visual for practice (hide answers)
  let practiceVisualHtml = '';
  if (currentCategory === 'numbers') {
    const n = targetCard.number;
    const rows = Math.ceil(n / 5);
    let rowsHtml = '';
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(5, n - r * 5);
      let items = '';
      for (let d = 0; d < inRow; d++) {
        items += `<span class="fc-apple-item" aria-hidden="true">🍎</span>`;
      }
      rowsHtml += `<div class="fc-dot-row">${items}</div>`;
    }
    practiceVisualHtml = `<div class="fc-quantity-container">${rowsHtml}</div>`;
  } else if (currentCategory === 'colours') {
    const hex = targetCard.visual || '#FFFFFF';
    const border = hex.toUpperCase() === '#FFFFFF' ? 'border: 3px solid #888;' : '';
    practiceVisualHtml = `
      <div class="fc-colour-swatch-container">
        <div class="fc-colour-swatch" style="background-color: ${hex}; ${border}">
          <span class="fc-colour-shine"></span>
        </div>
      </div>
    `;
  } else if (currentCategory === 'body') {
    practiceVisualHtml = generateBodyVisualSvg(targetCard.visual);
  } else if (currentCategory === 'shapes') {
    practiceVisualHtml = generateShapeVisualSvg(targetCard.visual);
  }

  container.innerHTML = `
    <div class="fc-quiz-prompt">${questionPrompt}</div>
    <h3 class="fc-quiz-question">${questionText}</h3>
    <div class="fc-quiz-visual-card">
      ${practiceVisualHtml}
    </div>
    <div class="fc-choices-grid" id="fc-practice-choices">
      ${choices.map((choice, i) => {
        const mainText = (currentCategory === 'numbers') ? choice.number : choice.hindi;
        const subText = choice.olChiki;
        return `
          <button class="fc-choice-btn" id="fc-choice-btn-${i}"
                  onclick="checkPracticeAnswer('${choice.id}', '${targetCard.id}', ${i})">
            <span class="fc-choice-main">${mainText}</span>
            <span class="fc-choice-sub">${subText}</span>
          </button>
        `;
      }).join('')}
    </div>
    <div class="fc-quiz-feedback" id="fc-practice-feedback"></div>
  `;
}

function checkPracticeAnswer(chosenId, correctId, choiceIndex) {
  const choicesContainer = document.getElementById('fc-practice-choices');
  if (!choicesContainer) return;

  const buttons = choicesContainer.querySelectorAll('.fc-choice-btn');
  buttons.forEach(btn => btn.disabled = true);

  const fb = document.getElementById('fc-practice-feedback');
  const chosenBtn = document.getElementById(`fc-choice-btn-${choiceIndex}`);

  // Highlight correct choice
  buttons.forEach(btn => {
    if (btn.getAttribute('onclick').includes(`'${correctId}'`)) {
      btn.classList.add('correct');
    }
  });

  if (chosenId === correctId) {
    fb.innerHTML = `
      <div class="fc-fb-msg correct">✓ Correct! शाबाश!</div>
      <button class="btn btn-maroon" onclick="renderPracticeQuestion()">Next Question →</button>
    `;
  } else {
    if (chosenBtn) chosenBtn.classList.add('wrong');
    fb.innerHTML = `
      <div class="fc-fb-msg wrong">Try again / फिर से प्रयास करें</div>
      <button class="btn btn-ghost" onclick="renderPracticeQuestion()">Try Another Question →</button>
    `;
  }
}

/* ---- Swipe and Keyboard Navigation ---- */
function setupSwipeNavigation() {
  const wrapper = document.getElementById('fc-card-wrapper');
  if (!wrapper) return;

  let startX = 0;
  let startY = 0;

  wrapper.addEventListener('touchstart', e => {
    if (e.touches && e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', e => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - startX;
    const deltaY = e.changedTouches[0].clientY - startY;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 60) {
      if (deltaX < 0) {
        nextFlashcard();
      } else {
        prevFlashcard();
      }
    }
  }, { passive: true });
}

function setupKeyboardNavigation() {
  document.addEventListener('keydown', e => {
    const flashcardsTab = document.getElementById('tab-flashcards');
    if (flashcardsTab && flashcardsTab.classList.contains('active') && currentMode === 'learn') {
      if (e.key === 'ArrowLeft') {
        prevFlashcard();
      } else if (e.key === 'ArrowRight') {
        nextFlashcard();
      }
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateStatusBadge();
  initTabs();

  await initPhrasebook();
  await initCurriculum();
  await initFlashcards();
  await initWorksheet();
});
