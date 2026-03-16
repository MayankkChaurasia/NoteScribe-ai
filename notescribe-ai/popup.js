/**
 * popup.js
 * Main controller for the NoteScribe AI popup.
 * Orchestrates: settings, recording, transcription, notes generation, history, export.
 */

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
const state = {
  isRecording:   false,
  audioSource:   'mic',       // 'mic' | 'tab'
  engine:        'browser',   // 'browser' | 'whisper'
  transcript:    '',
  notes:         null,
  currentSession: null,
  activeTab:     'transcript',
};

/* ════════════════════════════════════════════════
   INSTANCES
════════════════════════════════════════════════ */
const recorder = new AudioRecorder();
const ai       = new NoteScribeAI();

/* ════════════════════════════════════════════════
   DOM REFS
════════════════════════════════════════════════ */
const $  = id => document.getElementById(id);
const el = {
  // Header
  historyBtn:    $('historyBtn'),
  settingsBtn:   $('settingsBtn'),
  historyPanel:  $('historyPanel'),
  settingsPanel: $('settingsPanel'),
  mainContent:   $('mainContent'),

  // Settings
  apiKeyInput:   $('apiKeyInput'),
  saveApiKey:    $('saveApiKey'),
  srcMic:        $('srcMic'),
  srcTab:        $('srcTab'),
  engBrowser:    $('engBrowser'),
  engWhisper:    $('engWhisper'),

  // Record section
  statusDot:     $('statusDot'),
  statusText:    $('statusText'),
  timer:         $('timer'),
  waveformCanvas: $('waveformCanvas'),
  idleWaveform:  $('idleWaveform'),
  recordBtn:     $('recordBtn'),
  recordBtnText: $('recordBtnText'),
  sourceLabel:   $('sourceLabel'),

  // Tabs
  tabs:          document.querySelectorAll('.tab'),
  tabContents:   document.querySelectorAll('.tab-content'),

  // Transcript
  wordCount:         $('wordCount'),
  clearTranscript:   $('clearTranscript'),
  transcriptViewer:  $('transcriptViewer'),
  transcriptPlaceholder: $('transcriptPlaceholder'),
  transcriptText:    $('transcriptText'),
  generateBtn:       $('generateBtn'),

  // Notes / Insights
  notesPlaceholder:  $('notesPlaceholder'),
  notesContent:      $('notesContent'),
  notesLoading:      $('notesLoading'),
  notesOutput:       $('notesOutput'),
  insightsPlaceholder: $('insightsPlaceholder'),
  insightsContent:   $('insightsContent'),
  insightsOutput:    $('insightsOutput'),

  // History
  historyList:   $('historyList'),
  searchInput:   $('searchInput'),
  clearHistory:  $('clearHistory'),

  // Export bar
  exportBar:     $('exportBar'),
  copyBtn:       $('copyBtn'),
  markdownBtn:   $('markdownBtn'),
  pdfBtn:        $('pdfBtn'),
  downloadTranscriptBtn: $('downloadTranscriptBtn'),
};

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
async function init() {
  recorder.initCanvas(el.waveformCanvas);

  // Load saved settings
  const settings = await Storage.getSettings();
  if (settings.apiKey) {
    ai.setApiKey(settings.apiKey);
    el.apiKeyInput.value = settings.apiKey;
  }
  if (settings.audioSource) {
    state.audioSource = settings.audioSource;
    updateSourceUI();
  }
  if (settings.engine) {
    state.engine = settings.engine;
    updateEngineUI();
  }

  bindEvents();
  loadHistory();
}

/* ════════════════════════════════════════════════
   EVENT BINDING
════════════════════════════════════════════════ */
function bindEvents() {
  // ── Panels ──
  el.settingsBtn.addEventListener('click', () => togglePanel('settings'));
  el.historyBtn.addEventListener('click',  () => togglePanel('history'));

  // ── Settings ──
  el.saveApiKey.addEventListener('click', saveApiKey);
  el.apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });

  el.srcMic.addEventListener('click', () => setSource('mic'));
  el.srcTab.addEventListener('click', () => setSource('tab'));
  el.engBrowser.addEventListener('click', () => setEngine('browser'));
  el.engWhisper.addEventListener('click', () => setEngine('whisper'));

  // ── Record ──
  el.recordBtn.addEventListener('click', toggleRecording);

  // ── Tabs ──
  el.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // ── Transcript ──
  el.clearTranscript.addEventListener('click', clearTranscript);
  el.generateBtn.addEventListener('click', generateNotes);

  // ── History ──
  el.searchInput.addEventListener('input', filterHistory);
  el.clearHistory.addEventListener('click', clearAllHistory);

  // ── Export ──
  el.copyBtn.addEventListener('click',              () => exportAction('copy'));
  el.markdownBtn.addEventListener('click',          () => exportAction('markdown'));
  el.pdfBtn.addEventListener('click',               () => exportAction('pdf'));
  el.downloadTranscriptBtn.addEventListener('click',() => exportAction('transcript'));
}

/* ════════════════════════════════════════════════
   PANELS (Settings / History)
════════════════════════════════════════════════ */
function togglePanel(which) {
  const settingsOpen = !el.settingsPanel.classList.contains('hidden');
  const historyOpen  = !el.historyPanel.classList.contains('hidden');

  // Close all first
  el.settingsPanel.classList.add('hidden');
  el.historyPanel.classList.add('hidden');
  el.settingsBtn.classList.remove('active');
  el.historyBtn.classList.remove('active');

  if (which === 'settings' && !settingsOpen) {
    el.settingsPanel.classList.remove('hidden');
    el.settingsBtn.classList.add('active');
  }
  if (which === 'history' && !historyOpen) {
    el.historyPanel.classList.remove('hidden');
    el.historyBtn.classList.add('active');
    loadHistory();
  }
}

/* ════════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════════ */
async function saveApiKey() {
  const key = el.apiKeyInput.value.trim();
  if (!key) { showToast('Please enter an API key'); return; }
  ai.setApiKey(key);
  const settings = await Storage.getSettings();
  await Storage.saveSettings({ ...settings, apiKey: key });
  showToast('✓ API key saved');
  el.saveApiKey.textContent = '✓ Saved';
  setTimeout(() => { el.saveApiKey.textContent = 'Save'; }, 2000);
}

async function setSource(src) {
  state.audioSource = src;
  updateSourceUI();
  const settings = await Storage.getSettings();
  await Storage.saveSettings({ ...settings, audioSource: src });
}

async function setEngine(engine) {
  state.engine = engine;
  updateEngineUI();
  const settings = await Storage.getSettings();
  await Storage.saveSettings({ ...settings, engine });
}

function updateSourceUI() {
  el.srcMic.classList.toggle('active', state.audioSource === 'mic');
  el.srcTab.classList.toggle('active', state.audioSource === 'tab');
  el.sourceLabel.textContent = state.audioSource === 'tab' ? 'Tab Audio' : 'Microphone';
}

function updateEngineUI() {
  el.engBrowser.classList.toggle('active', state.engine === 'browser');
  el.engWhisper.classList.toggle('active', state.engine === 'whisper');
}

/* ════════════════════════════════════════════════
   RECORDING
════════════════════════════════════════════════ */
async function toggleRecording() {
  if (!state.isRecording) {
    await startRecording();
  } else {
    await stopRecording();
  }
}

async function startRecording() {
  setStatus('recording', 'Recording...');
  el.timer.classList.remove('hidden');
  el.timer.textContent = '00:00';
  el.idleWaveform.classList.add('hidden');

  el.recordBtn.classList.add('recording');
  el.recordBtnText.textContent = 'Stop Recording';

  recorder.resetTranscript();
  clearTranscriptUI();

  // Register live transcript callback
  recorder.onTranscriptUpdate = handleLiveTranscript;

  const result = await recorder.start(state.audioSource);
  if (!result.success) {
    setStatus('idle', 'Ready to record');
    el.timer.classList.add('hidden');
    el.idleWaveform.classList.remove('hidden');
    el.recordBtn.classList.remove('recording');
    el.recordBtnText.textContent = 'Start Recording';
    showToast(`Mic error: ${result.error}`);
    return;
  }

  state.isRecording = true;
}

async function stopRecording() {
  setStatus('processing', 'Processing...');

  el.recordBtn.classList.remove('recording');
  el.recordBtnText.textContent = 'Start Recording';
  el.timer.classList.add('hidden');
  el.idleWaveform.classList.remove('hidden');

  const result = await recorder.stop();
  state.isRecording = false;

  if (!result) {
    setStatus('idle', 'Ready to record');
    return;
  }

  // If using Whisper, transcribe now
  if (state.engine === 'whisper' && ai.hasApiKey()) {
    try {
      setStatus('processing', 'Transcribing with Whisper...');
      const whisperTranscript = await ai.transcribeWithWhisper(result.blob);
      state.transcript = whisperTranscript;
      renderTranscript(state.transcript);
    } catch (err) {
      showToast(`Whisper error: ${err.message}`);
      // Fall back to browser transcript
      state.transcript = result.transcript || '';
    }
  } else {
    // Use browser SpeechRecognition transcript gathered during recording
    state.transcript = result.transcript || state.transcript || '';
  }

  setStatus('done', `Done · ${formatDuration(result.duration)}`);

  // Save session to history (without notes yet)
  const sessionId = generateId();
  state.currentSession = {
    id:         sessionId,
    title:      `Meeting ${new Date().toLocaleDateString()}`,
    date:       new Date().toISOString(),
    duration:   result.duration,
    transcript: state.transcript,
    notes:      null,
    audioBlob:  null, // don't store blob in storage
  };

  updateGenerateButton();
  updateExportBar();
}

/* ════════════════════════════════════════════════
   LIVE TRANSCRIPT (Browser SpeechRecognition)
════════════════════════════════════════════════ */
function handleLiveTranscript({ final, interim, full }) {
  state.transcript = full;

  el.transcriptPlaceholder.classList.add('hidden');
  el.transcriptText.innerHTML = '';

  // Segment by speaker turns (double newline in transcript)
  const segments = full.split('\n\n').filter(Boolean);

  // Add final segments
  segments.forEach((seg, i) => {
    const div = document.createElement('div');
    div.className = 'transcript-segment';

    if (seg.startsWith('Speaker ')) {
      const colonIdx = seg.indexOf(':');
      const speaker  = seg.slice(0, colonIdx).trim();
      const text     = seg.slice(colonIdx + 1).trim();
      div.innerHTML  = `<div class="segment-speaker">${speaker}</div><div class="segment-text">${text}</div>`;
    } else {
      div.innerHTML = `<div class="segment-text">${seg}</div>`;
    }
    el.transcriptText.appendChild(div);
  });

  // Append interim text
  if (interim) {
    const interimDiv = document.createElement('div');
    interimDiv.className   = 'transcript-segment';
    interimDiv.innerHTML   = `<div class="segment-text interim-text">${interim}</div>`;
    el.transcriptText.appendChild(interimDiv);
  }

  // Auto-scroll
  el.transcriptViewer.scrollTop = el.transcriptViewer.scrollHeight;

  // Word count
  el.wordCount.textContent = `${countWords(full)} words`;

  updateGenerateButton();
}

function renderTranscript(text) {
  state.transcript = text;
  el.transcriptPlaceholder.classList.add('hidden');
  el.transcriptText.innerHTML = '';

  const segments = text.split('\n\n').filter(Boolean);
  segments.forEach(seg => {
    const div = document.createElement('div');
    div.className = 'transcript-segment';

    if (seg.startsWith('Speaker ')) {
      const colonIdx = seg.indexOf(':');
      const speaker  = seg.slice(0, colonIdx).trim();
      const text     = seg.slice(colonIdx + 1).trim();
      div.innerHTML  = `<div class="segment-speaker">${speaker}</div><div class="segment-text">${text}</div>`;
    } else {
      div.innerHTML = `<div class="segment-text">${seg}</div>`;
    }
    el.transcriptText.appendChild(div);
  });

  el.transcriptViewer.scrollTop = el.transcriptViewer.scrollHeight;
  el.wordCount.textContent = `${countWords(text)} words`;
}

/* ════════════════════════════════════════════════
   NOTES GENERATION
════════════════════════════════════════════════ */
async function generateNotes() {
  if (!state.transcript.trim()) {
    showToast('No transcript to generate notes from');
    return;
  }

  switchTab('notes');

  el.notesPlaceholder.classList.add('hidden');
  el.notesContent.classList.remove('hidden');
  el.notesLoading.classList.remove('hidden');
  el.notesOutput.innerHTML = '';

  try {
    let notes;
    if (ai.hasApiKey()) {
      notes = await ai.generateNotes(state.transcript);
    } else {
      notes = ai.generateDemoNotes(state.transcript);
      showToast('Demo mode — add API key for real AI notes');
    }

    state.notes = notes;
    if (state.currentSession) {
      state.currentSession.notes = notes;
      state.currentSession.title = notes.title || state.currentSession.title;
      await Storage.saveSession(state.currentSession);
    }

    renderNotes(notes);
    renderInsights(notes);
    el.notesLoading.classList.add('hidden');
    updateExportBar();
  } catch (err) {
    el.notesLoading.classList.add('hidden');
    el.notesContent.classList.add('hidden');
    el.notesPlaceholder.classList.remove('hidden');
    showToast(`Error: ${err.message}`);
  }
}

/* ════════════════════════════════════════════════
   RENDER NOTES
════════════════════════════════════════════════ */
function renderNotes(notes) {
  const sections = [
    {
      key:   'summary',
      title: 'Summary',
      icon:  '📝',
      color: '#4eca8b',
      type:  'text',
    },
    {
      key:   'keyPoints',
      title: 'Key Points',
      icon:  '⚡',
      color: '#7c6af7',
      type:  'bullets',
    },
    {
      key:   'concepts',
      title: 'Important Concepts',
      icon:  '💡',
      color: '#f5a623',
      type:  'bullets',
    },
    {
      key:   'actionItems',
      title: 'Action Items',
      icon:  '✅',
      color: '#4eca8b',
      type:  'bullets',
    },
    {
      key:   'questions',
      title: 'Questions Discussed',
      icon:  '❓',
      color: '#f25f5c',
      type:  'bullets',
    },
  ];

  el.notesOutput.innerHTML = '';

  sections.forEach(({ key, title, icon, color, type }) => {
    const data = notes[key];
    if (!data || (Array.isArray(data) && !data.length)) return;

    const section = document.createElement('div');
    section.className = 'note-section';
    section.innerHTML = `
      <div class="note-section-header">
        <div class="note-section-icon" style="background:${color}22">
          <span style="font-size:12px">${icon}</span>
        </div>
        <div class="note-section-title" style="color:${color}">${title}</div>
      </div>
      <div class="note-section-body" id="section-${key}"></div>
    `;
    el.notesOutput.appendChild(section);

    const body = document.getElementById(`section-${key}`);
    if (type === 'text') {
      body.textContent = data;
    } else {
      (Array.isArray(data) ? data : [data]).forEach(item => {
        const bullet = document.createElement('div');
        bullet.className = 'note-bullet';
        bullet.textContent = item;
        body.appendChild(bullet);
      });
    }
  });
}

/* ════════════════════════════════════════════════
   RENDER INSIGHTS
════════════════════════════════════════════════ */
function renderInsights(notes) {
  el.insightsPlaceholder.classList.add('hidden');
  el.insightsContent.classList.remove('hidden');
  el.insightsOutput.innerHTML = '';

  const categories = [
    { key: 'tasks',     label: 'Task',     badge: 'badge-task',
      render: t => `${t.task}${t.assignee ? ` → <strong>${t.assignee}</strong>` : ''}${t.deadline ? ` · <em>${t.deadline}</em>` : ''}` },
    { key: 'decisions', label: 'Decision', badge: 'badge-decision', render: d => d },
    { key: 'deadlines', label: 'Deadline', badge: 'badge-deadline',
      render: d => `<strong>${d.item}</strong> — ${d.date}` },
    { key: 'followUps', label: 'Follow-up', badge: 'badge-followup', render: f => f },
  ];

  let hasContent = false;

  categories.forEach(({ key, label, badge, render }) => {
    const items = notes[key];
    if (!items || !items.length) return;
    hasContent = true;

    const card = document.createElement('div');
    card.className = 'insight-card';
    card.innerHTML = `
      <div class="insight-card-header">
        <span class="insight-badge ${badge}">${label}</span>
        <span style="font-size:11px;color:var(--text-muted)">${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>
    `;

    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'insight-item';
      row.innerHTML = render(item);
      card.appendChild(row);
    });

    el.insightsOutput.appendChild(card);
  });

  if (!hasContent) {
    el.insightsOutput.innerHTML = `
      <div class="notes-placeholder">
        <p style="color:var(--text-muted);font-size:12px">No specific tasks, decisions, or deadlines were identified.</p>
      </div>
    `;
  }
}

/* ════════════════════════════════════════════════
   TABS
════════════════════════════════════════════════ */
function switchTab(tabName) {
  state.activeTab = tabName;
  el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabName}`);
    c.classList.toggle('hidden', c.id !== `tab-${tabName}`);
  });
}

/* ════════════════════════════════════════════════
   HISTORY
════════════════════════════════════════════════ */
async function loadHistory(query = '') {
  const sessions = await Storage.getSessions();
  const filtered = query ? searchSessions(sessions, query) : sessions;
  renderHistory(filtered);
}

function renderHistory(sessions) {
  if (!sessions.length) {
    el.historyList.innerHTML = `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.3">
          <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2"/>
          <path d="M16 10v6l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>No recordings found</p>
      </div>`;
    return;
  }

  el.historyList.innerHTML = sessions.map(s => `
    <div class="history-item" data-id="${s.id}">
      <div class="history-item-title">${s.title || 'Untitled Session'}</div>
      <div class="history-item-meta">${formatDate(s.date)} · ${formatDuration(s.duration)} · ${countWords(s.transcript || '')} words</div>
    </div>
  `).join('');

  // Click to load session
  el.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => loadSession(item.dataset.id, sessions));
  });
}

async function loadSession(id, sessions) {
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  state.currentSession = session;
  state.transcript     = session.transcript || '';
  state.notes          = session.notes || null;

  // Render transcript
  if (state.transcript) {
    el.transcriptPlaceholder.classList.add('hidden');
    renderTranscript(state.transcript);
  }

  // Render notes if available
  if (session.notes) {
    el.notesPlaceholder.classList.add('hidden');
    el.notesContent.classList.remove('hidden');
    el.notesLoading.classList.add('hidden');
    renderNotes(session.notes);
    renderInsights(session.notes);
  }

  togglePanel(null); // close panels
  setStatus('done', `Loaded: ${session.title}`);
  updateGenerateButton();
  updateExportBar();
  showToast(`Session loaded: ${session.title}`);
}

async function filterHistory() {
  await loadHistory(el.searchInput.value);
}

async function clearAllHistory() {
  if (!confirm('Clear all recording history?')) return;
  await Storage.clearSessions();
  renderHistory([]);
  showToast('History cleared');
}

/* ════════════════════════════════════════════════
   EXPORT
════════════════════════════════════════════════ */
async function exportAction(type) {
  const session = state.currentSession || {
    title:      'Meeting Notes',
    date:       new Date().toISOString(),
    duration:   0,
    transcript: state.transcript,
    notes:      state.notes,
  };

  try {
    switch (type) {
      case 'copy':
        await Exporter.copyToClipboard(session);
        showToast('✓ Copied to clipboard');
        break;
      case 'markdown':
        Exporter.exportMarkdown(session);
        showToast('✓ Markdown downloaded');
        break;
      case 'pdf':
        Exporter.exportPDF(session);
        break;
      case 'transcript':
        Exporter.exportTranscript(session);
        showToast('✓ Transcript downloaded');
        break;
    }
  } catch (err) {
    showToast(`Export failed: ${err.message}`);
  }
}

/* ════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════ */
function setStatus(type, text) {
  el.statusDot.className = `status-dot ${type}`;
  el.statusText.textContent = text;
}

function clearTranscript() {
  state.transcript = '';
  recorder.resetTranscript();
  clearTranscriptUI();
  el.wordCount.textContent = '0 words';
  updateGenerateButton();
}

function clearTranscriptUI() {
  el.transcriptText.innerHTML = '';
  el.transcriptPlaceholder.classList.remove('hidden');
}

function updateGenerateButton() {
  el.generateBtn.disabled = state.transcript.trim().length < 10;
}

function updateExportBar() {
  const hasContent = state.transcript || state.notes;
  el.exportBar.classList.toggle('hidden', !hasContent);
}

/* ════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
