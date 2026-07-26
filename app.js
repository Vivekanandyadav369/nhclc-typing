const DOM = {
  setupCard: document.getElementById('setup-card'),
  practiceCard: document.getElementById('practice-card'),
  resultsCard: document.getElementById('results-card'),
  nameInput: document.getElementById('student-name'),
  rollInput: document.getElementById('roll-number'),
  languageSelect: document.getElementById('language-select'),
  lessonSelect: document.getElementById('lesson-select'),
  modeSelect: document.getElementById('mode-select'),
  durationSelect: document.getElementById('duration-select'),
  startButton: document.getElementById('start-button'),
  textDisplay: document.getElementById('text-display'),
  inputField: document.getElementById('input-field'),
  timerDisplay: document.getElementById('timer-display'),
  lessonTitle: document.getElementById('lesson-title'),
  modeTitle: document.getElementById('mode-title'),
  wpmDisplay: document.getElementById('wpm-display'),
  accuracyDisplay: document.getElementById('accuracy-display'),
  progressDisplay: document.getElementById('progress-display'),
  progressFill: document.getElementById('progress-fill'),
  assistCard: document.getElementById('assist-card'),
  statsRow: document.querySelector('.stats-row'),
  progressTrack: document.getElementById('progress-track'),
  themeToggle: document.getElementById('theme-toggle'),
  submitButton: document.getElementById('submit-button'),
  resetButton: document.getElementById('reset-button'),
  studentNameResult: document.getElementById('student-name-result'),
  studentRollResult: document.getElementById('student-roll-result'),
  lessonNameResult: document.getElementById('lesson-name-result'),
  modeResult: document.getElementById('mode-result'),
  durationResult: document.getElementById('duration-result'),
  wpmResult: document.getElementById('wpm-result'),
  accuracyResult: document.getElementById('accuracy-result'),
  correctResult: document.getElementById('correct-result'),
  incorrectResult: document.getElementById('incorrect-result'),
  backspaceResult: document.getElementById('backspace-result'),
  marksResult: document.getElementById('marks-result'),
  originalComparison: document.getElementById('original-comparison'),
  typedComparison: document.getElementById('typed-comparison'),
  dashboardButton: document.getElementById('dashboard-button'),
  printReportButton: document.getElementById('print-report-button'),
  reportTitle: document.getElementById('report-title'),
  reportSubtitle: document.getElementById('report-subtitle'),
  reportTimestamp: document.getElementById('report-timestamp')
};

const PARAGRAPH_TOKEN = '__PARA__';

const state = {
  lessons: [],
  activeLesson: null,
  originalWords: [],
  typedWords: [],
  currentWordIndex: 0,
  timerStarted: false,
  timerId: null,
  timerSeconds: 0,
  durationSeconds: 0,
  backspaceCount: 0,
  theme: 'day',
  student: {
    name: '',
    roll: '',
    mode: 'learning'
  },
  language: 'hindi'
};

init();

async function init() {
  attachEvents();
  applyTheme(state.theme);
  state.language = DOM.languageSelect.value || state.language;
  await loadLessons(state.language);
  updateStartButtonState();
}

function attachEvents() {
  [DOM.nameInput, DOM.rollInput, DOM.languageSelect, DOM.lessonSelect, DOM.modeSelect].forEach((element) => {
    element.addEventListener('input', updateStartButtonState);
    element.addEventListener('change', updateStartButtonState);
  });

  DOM.startButton.addEventListener('click', startPractice);
  DOM.languageSelect.addEventListener('change', async () => {
    await loadLessons(DOM.languageSelect.value);
    DOM.lessonSelect.value = '';
    updateStartButtonState();
  });
  DOM.submitButton.addEventListener('click', finishTest);
  DOM.resetButton.addEventListener('click', resetSession);
  DOM.dashboardButton.addEventListener('click', goToDashboard);
  DOM.printReportButton.addEventListener('click', openPrintReport);
  DOM.themeToggle.addEventListener('click', toggleTheme);
  DOM.inputField.addEventListener('keydown', handleKeydown);
  DOM.inputField.addEventListener('input', handleTyping);
  DOM.inputField.addEventListener('paste', (event) => event.preventDefault());
  DOM.inputField.addEventListener('drop', (event) => event.preventDefault());
}

function updateStartButtonState() {
  const nameFilled = DOM.nameInput.value.trim() !== '';
  const rollFilled = DOM.rollInput.value.trim() !== '';
  const languageSelected = DOM.languageSelect.value !== '';
  const lessonSelected = DOM.lessonSelect.value !== '';
  const modeSelected = DOM.modeSelect.value !== '';
  DOM.startButton.disabled = !(nameFilled && rollFilled && languageSelected && lessonSelected && modeSelected);
}

function toggleTheme() {
  state.theme = state.theme === 'day' ? 'night' : 'day';
  applyTheme(state.theme);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  DOM.themeToggle.textContent = theme === 'day' ? '🌙 Night Mode' : '☀️ Day Mode';
  DOM.themeToggle.setAttribute('aria-pressed', theme === 'night' ? 'true' : 'false');
}

async function loadLessons(language = state.language) {
  try {
    state.language = language;
    const basePath = await resolveLessonBasePath(language);
    if (!basePath) {
      throw new Error('No lesson manifest found for the selected language.');
    }

    const manifest = await fetchJson(`${basePath}/manifest.json`);
    const lessonFiles = manifest.lessons || [];
    const loadedLessons = [];

    for (const lessonEntry of lessonFiles) {
      const lessonData = await fetchJson(`${basePath}/${lessonEntry.file}`);
      loadedLessons.push({
        id: lessonEntry.id,
        title: lessonEntry.title,
        file: lessonEntry.file,
        text: lessonData.text || lessonData.content || ''
      });
    }

    state.lessons = loadedLessons;
    renderLessonOptions();
  } catch (error) {
    console.error('Unable to load lessons:', error);
    DOM.lessonSelect.innerHTML = '<option value="">Lessons unavailable</option>';
  }
}

async function resolveLessonBasePath(language) {
  const candidates = language === 'english'
    ? ['english_lessions', 'lessons/english', 'lessons']
    : ['hindi_lessions', 'lessons', 'lessons/hindi'];

  for (const candidate of candidates) {
    try {
      const manifest = await fetchJson(`${candidate}/manifest.json`);
      if (manifest && Array.isArray(manifest.lessons)) {
        return candidate;
      }
    } catch (error) {
      // Try the next candidate.
    }
  }

  return null;
}

function renderLessonOptions() {
  DOM.lessonSelect.innerHTML = '<option value="">Select a lesson</option>';
  state.lessons.forEach((lesson) => {
    const option = document.createElement('option');
    option.value = lesson.id;
    option.textContent = lesson.title;
    DOM.lessonSelect.appendChild(option);
  });
}

function startPractice() {
  const selectedLesson = state.lessons.find((lesson) => lesson.id === DOM.lessonSelect.value);
  if (!selectedLesson) {
    alert('Please select a valid lesson.');
    return;
  }

  state.student.name = DOM.nameInput.value.trim();
  state.student.roll = DOM.rollInput.value.trim();
  state.student.mode = DOM.modeSelect.value;
  state.activeLesson = selectedLesson;
  state.baseText = selectedLesson.text;
  state.originalWords = tokenizeLessonText(selectedLesson.text);
  state.typedWords = [];
  state.currentWordIndex = 0;
  state.backspaceCount = 0;
  state.timerStarted = false;
  state.timerSeconds = Number(DOM.durationSelect.value) * 60;
  state.durationSeconds = state.timerSeconds;
  clearInterval(state.timerId);

  DOM.setupCard.classList.add('hidden');
  DOM.practiceCard.classList.remove('hidden');
  DOM.resultsCard.classList.add('hidden');
  DOM.inputField.value = '';
  DOM.inputField.disabled = false;
  DOM.inputField.focus();

  DOM.textDisplay.innerHTML = renderLessonLines(selectedLesson.text);
  DOM.timerDisplay.textContent = formatTime(state.timerSeconds);
  DOM.lessonTitle.textContent = selectedLesson.title;
  DOM.modeTitle.textContent = state.student.mode === 'learning' ? 'Learning' : 'Test';
  DOM.statsRow.classList.toggle('hidden', state.student.mode === 'test');
  DOM.assistCard.classList.toggle('hidden', state.student.mode === 'test');
  DOM.progressTrack.classList.toggle('hidden', state.student.mode === 'test');
  DOM.submitButton.textContent = state.student.mode === 'test' ? 'Submit Test' : 'Finish Practice';
  updateStats();

  if (state.student.mode === 'learning') {
    highlightCurrentWord();
    renderLearningAssist('Start typing to begin the countdown.');
  } else {
    DOM.assistCard.innerHTML = '<strong>Test mode</strong><div>No live assistance during the test.</div>';
  }
}

function handleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const start = DOM.inputField.selectionStart;
    const end = DOM.inputField.selectionEnd;
    const value = DOM.inputField.value;
    DOM.inputField.value = value.slice(0, start) + '\n' + value.slice(end);
    DOM.inputField.setSelectionRange(start + 1, start + 1);
    DOM.inputField.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  if (event.key === 'Backspace' && state.student.mode === 'test') {
    state.backspaceCount += 1;
    return;
  }

  if (event.key === 'Backspace' && state.student.mode === 'learning') {
    state.backspaceCount += 1;
    event.preventDefault();
  }
}

function handleTyping(event) {
  const typedValue = event.target.value;
  if (!state.timerStarted && typedValue.trim() !== '') {
    startTimer();
  }

  state.typedWords = getCompletedWords(typedValue);

  if (state.typedWords.length >= state.originalWords.length && state.timerSeconds > 0) {
    const newWords = state.baseText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/).filter(Boolean).map(normalizeText))
      .flat();
    state.originalWords = state.originalWords.concat(newWords);
    DOM.textDisplay.insertAdjacentHTML('beforeend', renderLessonLines(state.baseText));
  }

  if (state.student.mode === 'learning') {
    const completedCount = state.typedWords.length;
    state.currentWordIndex = completedCount < state.originalWords.length ? completedCount : Math.max(0, state.originalWords.length - 1);
    highlightCurrentWord();
    renderLearningAssist();
    updateStats();
  }

  if (state.student.mode === 'test') {
    scrollCurrentWord();
    updateStats();
  }

  if (state.timerSeconds <= 0) {
    finishTest();
  }
}

function getCompletedWords(typedValue) {
  const endsWithWhitespace = /\s$/.test(typedValue);
  const tokens = tokenizeTypedText(typedValue);
  if (tokens.length === 0) {
    return [];
  }

  if (!endsWithWhitespace && tokens[tokens.length - 1] !== PARAGRAPH_TOKEN) {
    tokens.pop();
  }

  return tokens;
}

function tokenizeLessonText(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n+/);
  const tokens = [];

  paragraphs.forEach((paragraph, index) => {
    const words = paragraph
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(normalizeText);

    if (words.length > 0) {
      tokens.push(...words);
    }

    if (index < paragraphs.length - 1) {
      tokens.push(PARAGRAPH_TOKEN);
    }
  });

  return tokens;
}

function tokenizeTypedText(typedValue) {
  const normalized = typedValue.replace(/\r\n/g, '\n');
  const parts = normalized.split(/(\n+)/);
  const tokens = [];

  parts.forEach((segment) => {
    if (!segment) return;

    if (/^\n+$/.test(segment)) {
      tokens.push(PARAGRAPH_TOKEN);
      return;
    }

    const words = segment
      .split(/\s+/)
      .filter(Boolean)
      .map(normalizeText);

    tokens.push(...words);
  });

  return tokens;
}

function startTimer() {
  if (state.timerStarted) return;
  state.timerStarted = true;
  state.timerId = window.setInterval(() => {
    state.timerSeconds -= 1;
    DOM.timerDisplay.textContent = formatTime(state.timerSeconds);
    updateStats();
    if (state.timerSeconds <= 0) {
      finishTest();
    }
  }, 1000);
}

function highlightCurrentWord() {
  if (state.student.mode !== 'learning') return;
  const wordElements = Array.from(document.querySelectorAll('.word'));
  wordElements.forEach((wordElement, index) => {
    wordElement.classList.toggle('current', index === state.currentWordIndex);
  });

  const currentElement = wordElements[state.currentWordIndex];
  if (currentElement) {
    currentElement.scrollIntoView({ behavior: 'auto', block: 'center' });
  }
}

function scrollCurrentWord() {
  const wordElements = document.querySelectorAll('.word');
  const currentElement = wordElements[state.typedWords.length];
  if (currentElement) {
    currentElement.scrollIntoView({ behavior: 'auto', block: 'center' });
  }
}

function renderLearningAssist(message) {
  if (state.student.mode !== 'learning') return;

  const currentWord = state.originalWords[state.currentWordIndex] || state.originalWords[0] || '';
  const typedCurrent = state.typedWords[state.currentWordIndex] || '';
  let guidance = `Focus on: ${currentWord}`;

  if (typedCurrent && typedCurrent !== currentWord) {
    guidance = `Try again: ${currentWord}`;
  } else if (state.typedWords.length === state.originalWords.length) {
    guidance = 'Excellent! You have completed the lesson flow.';
  } else if (state.typedWords.length > 0) {
    guidance = `Continue with: ${currentWord}`;
  }

  DOM.assistCard.innerHTML = `<strong>Learning assistance</strong><div>${message || guidance}</div>`;
}

function updateStats() {
  const totalTypedTokens = state.typedWords.length;
  const totalTypedWords = state.typedWords.filter((token) => token !== PARAGRAPH_TOKEN).length;
  const originalWordCount = state.originalWords.filter((token) => token !== PARAGRAPH_TOKEN).length;
  const correctWordCount = state.typedWords.reduce((count, token, index) => {
    return count + (token !== PARAGRAPH_TOKEN && index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const correctTokenCount = state.typedWords.reduce((count, token, index) => {
    return count + (index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const incorrectWords = totalTypedTokens - correctTokenCount;
  const elapsed = Math.max(1, state.durationSeconds - state.timerSeconds);
  const wpm = totalTypedWords > 0 ? Math.round(correctWordCount / Math.max(1, elapsed / 60)) : 0;
  const accuracy = totalTypedTokens > 0 ? Math.round((correctTokenCount / totalTypedTokens) * 100) : 100;
  const progressPercent = originalWordCount > 0
    ? Math.min(100, Math.round((totalTypedWords / originalWordCount) * 100))
    : 0;

  DOM.wpmDisplay.textContent = `${wpm} WPM`;
  DOM.accuracyDisplay.textContent = `${accuracy}%`;
  DOM.progressDisplay.textContent = `${progressPercent}%`;
  DOM.progressFill.style.width = `${progressPercent}%`;

  if (state.student.mode === 'test') {
    DOM.timerDisplay.textContent = formatTime(state.timerSeconds);
    DOM.wpmDisplay.textContent = '0 WPM';
    DOM.accuracyDisplay.textContent = '100%';
    DOM.progressDisplay.textContent = '0%';
    DOM.progressFill.style.width = '0%';
  }
}

function finishTest() {
  clearInterval(state.timerId);
  state.timerStarted = false;
  DOM.inputField.disabled = true;

  const totalTypedTokens = state.typedWords.length;
  const totalTypedWords = state.typedWords.filter((token) => token !== PARAGRAPH_TOKEN).length;
  const originalWordCount = state.originalWords.filter((token) => token !== PARAGRAPH_TOKEN).length;
  const correctTokenCount = state.typedWords.reduce((count, token, index) => {
    return count + (index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const correctWordCount = state.typedWords.reduce((count, token, index) => {
    return count + (token !== PARAGRAPH_TOKEN && index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const incorrectWords = totalTypedTokens - correctTokenCount;
  const elapsed = Math.max(1, state.durationSeconds - state.timerSeconds);
  const wpm = totalTypedWords > 0 ? Math.round(correctWordCount / Math.max(1, elapsed / 60)) : 0;
  const accuracy = totalTypedTokens > 0 ? Math.round((correctTokenCount / totalTypedTokens) * 100) : 100;
  const marks = Math.round(Math.min(100, (accuracy * 0.7) + (Math.min(wpm, 80) / 80) * 30));

  const elapsedTime = Math.max(1, state.durationSeconds - state.timerSeconds);

  DOM.studentNameResult.textContent = state.student.name;
  DOM.studentRollResult.textContent = state.student.roll;
  DOM.lessonNameResult.textContent = state.activeLesson?.title || 'Selected lesson';
  DOM.modeResult.textContent = state.student.mode === 'learning' ? 'Learning Mode' : 'Test Mode';
  DOM.durationResult.textContent = formatTime(elapsedTime);
  DOM.reportTitle.textContent = `${state.activeLesson?.title || 'Selected lesson'} • ${state.student.mode === 'learning' ? 'Learning' : 'Test'}`;
  DOM.reportSubtitle.textContent = `${state.student.name || 'Student'} • ${state.student.roll || 'Roll N/A'} • ${state.language === 'english' ? 'English' : 'Hindi'}`;
  DOM.reportTimestamp.textContent = `Generated on ${new Date().toLocaleString()}`;
  DOM.wpmResult.textContent = `${wpm} WPM`;
  DOM.accuracyResult.textContent = `${accuracy}%`;
  DOM.correctResult.textContent = `${correctWordCount}`;
  DOM.incorrectResult.textContent = `${incorrectWords}`;
  DOM.backspaceResult.textContent = state.student.mode === 'test' ? `${state.backspaceCount}` : 'Not tracked';
  DOM.marksResult.textContent = `${marks}/100`;

  DOM.originalComparison.innerHTML = renderComparisonWords(state.originalWords.slice(0, totalTypedTokens));
  DOM.typedComparison.innerHTML = renderComparisonWords(state.typedWords, true);

  DOM.practiceCard.classList.add('hidden');
  DOM.resultsCard.classList.remove('hidden');
}

// Export PDF feature removed per user's request.

function openPrintReport() {
  const totalTypedTokens = state.typedWords.length;
  const totalTypedWords = state.typedWords.filter((token) => token !== PARAGRAPH_TOKEN).length;
  const correctTokenCount = state.typedWords.reduce((count, token, index) => {
    return count + (index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const correctWordCount = state.typedWords.reduce((count, token, index) => {
    return count + (token !== PARAGRAPH_TOKEN && index < state.originalWords.length && token === state.originalWords[index] ? 1 : 0);
  }, 0);
  const incorrectWords = totalTypedTokens - correctTokenCount;
  const elapsed = Math.max(1, state.durationSeconds - state.timerSeconds);
  const wpm = totalTypedWords > 0 ? Math.round(correctWordCount / Math.max(1, elapsed / 60)) : 0;
  const accuracy = totalTypedTokens > 0 ? Math.round((correctTokenCount / totalTypedTokens) * 100) : 100;
  const marks = Math.round(Math.min(100, (accuracy * 0.7) + (Math.min(wpm, 80) / 80) * 30));

  const reportData = {
    date: new Date().toISOString(),
    student_name: state.student.name || 'Student',
    roll_number: state.student.roll || 'N/A',
    language: state.language === 'english' ? 'English' : 'Hindi',
    lesson: state.activeLesson?.title || 'Selected lesson',
    mode: state.student.mode === 'learning' ? 'Learning Mode' : 'Test Mode',
    duration: formatTime(elapsed) + ' Minutes',
    marks: marks,
    wpm: wpm,
    accuracy: accuracy,
    total_words: totalTypedWords,
    correct_words: correctWordCount,
    incorrect_words: incorrectWords,
    backspaces: state.student.mode === 'test' ? state.backspaceCount : '0'
  };

  localStorage.setItem('typingReportData', JSON.stringify(reportData));
  window.open('./report.html', '_blank');
}

function goToDashboard() {
  clearInterval(state.timerId);
  state.timerStarted = false;
  DOM.resultsCard.classList.add('hidden');
  DOM.practiceCard.classList.add('hidden');
  DOM.setupCard.classList.remove('hidden');
  DOM.inputField.value = '';
  DOM.inputField.disabled = false;
  DOM.assistCard.innerHTML = '';
  DOM.timerDisplay.textContent = '05:00';
  DOM.wpmDisplay.textContent = '0 WPM';
  DOM.accuracyDisplay.textContent = '100%';
  DOM.progressDisplay.textContent = '0%';
  DOM.progressFill.style.width = '0%';
  updateStartButtonState();
}

function resetSession() {
  clearInterval(state.timerId);
  DOM.setupCard.classList.remove('hidden');
  DOM.practiceCard.classList.add('hidden');
  DOM.resultsCard.classList.add('hidden');
  DOM.inputField.value = '';
  DOM.inputField.disabled = false;
  DOM.nameInput.value = '';
  DOM.rollInput.value = '';
  DOM.languageSelect.value = state.language;
  DOM.lessonSelect.value = '';
  DOM.modeSelect.value = '';
  DOM.durationSelect.value = '5';
  DOM.timerDisplay.textContent = '05:00';
  DOM.wpmDisplay.textContent = '0 WPM';
  DOM.accuracyDisplay.textContent = '100%';
  DOM.progressDisplay.textContent = '0%';
  DOM.progressFill.style.width = '0%';
  DOM.assistCard.innerHTML = '';
  updateStartButtonState();
}

function renderLessonLines(text) {
  const tokens = tokenizeLessonText(text);
  return tokens.map((token) => {
    if (token === PARAGRAPH_TOKEN) {
      return `<span class="word paragraph-break" aria-hidden="true">⏎</span>`;
    }
    return `<span class="word">${escapeHtml(token)}</span>`;
  }).join(' ');
}

function renderComparisonWords(words, isTyped = false) {
  return words.map((word, index) => {
    if (word === PARAGRAPH_TOKEN) {
      return `<span class="compare-word paragraph-break">⏎</span>`;
    }
    const isWrong = isTyped && index < state.originalWords.length && word !== state.originalWords[index];
    return `<span class="compare-word${isWrong ? ' incorrect' : ''}">${escapeHtml(word)}</span>`;
  }).join(' ');
}

function normalizeText(text) {
  return text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchJson(url) {
  const resolvedUrl = new URL(url, window.location.href).toString();
  const response = await fetch(resolvedUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${resolvedUrl}`);
  }
  return response.json();
}
