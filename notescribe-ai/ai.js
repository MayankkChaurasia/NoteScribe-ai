/**
 * ai.js
 * Handles:
 *  1. Audio → Text via OpenAI Whisper API
 *  2. Transcript → Structured Notes via GPT-4o-mini
 *  3. Notes → Meeting Insights (tasks, decisions, deadlines)
 *
 * Falls back to browser-based SpeechRecognition if no API key is set.
 */

class NoteScribeAI {
  constructor() {
    this.apiKey  = '';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  setApiKey(key) { this.apiKey = key.trim(); }

  hasApiKey() { return this.apiKey.length > 0; }

  /* ─────────────────────────────────────────────────
     WHISPER — Audio transcription
  ───────────────────────────────────────────────── */
  /**
   * @param {Blob} audioBlob - The recorded audio
   * @returns {Promise<string>} - Raw transcript text
   */
  async transcribeWithWhisper(audioBlob) {
    if (!this.hasApiKey()) {
      throw new Error('No API key. Please add your OpenAI API key in Settings.');
    }

    const formData = new FormData();
    formData.append('file',            new File([audioBlob], 'recording.webm', { type: audioBlob.type }));
    formData.append('model',           'whisper-1');
    formData.append('response_format', 'verbose_json');  // includes segments + timestamps
    formData.append('language',        'en');

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body:    formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Whisper API error: ${response.status}`);
    }

    const data = await response.json();

    // Build speaker-segmented transcript from Whisper segments
    // (Basic: group consecutive segments into logical paragraphs)
    if (data.segments && data.segments.length > 0) {
      return this._buildSegmentedTranscript(data.segments);
    }
    return data.text || '';
  }

  /**
   * Group Whisper segments into logical paragraphs (pseudo-speaker turns).
   * Real diarization requires a separate service, but we can segment by
   * silence gaps > 2 seconds.
   */
  _buildSegmentedTranscript(segments) {
    const GAP_THRESHOLD = 2.0; // seconds
    const paragraphs    = [];
    let   currentPara   = [];
    let   prevEnd       = 0;
    let   speakerIdx    = 1;

    for (const seg of segments) {
      const gap = seg.start - prevEnd;
      if (gap > GAP_THRESHOLD && currentPara.length > 0) {
        paragraphs.push({ speaker: `Speaker ${speakerIdx}`, text: currentPara.join(' ') });
        currentPara = [];
        speakerIdx  = speakerIdx === 1 ? 2 : 1; // alternate speakers
      }
      currentPara.push(seg.text.trim());
      prevEnd = seg.end;
    }

    if (currentPara.length > 0) {
      paragraphs.push({ speaker: `Speaker ${speakerIdx}`, text: currentPara.join(' ') });
    }

    return paragraphs.map(p => `${p.speaker}: ${p.text}`).join('\n\n');
  }

  /* ─────────────────────────────────────────────────
     GPT — Generate structured notes
  ───────────────────────────────────────────────── */
  /**
   * @param {string} transcript
   * @returns {Promise<Object>} Parsed notes object
   */
  async generateNotes(transcript) {
    if (!this.hasApiKey()) {
      throw new Error('No API key. Please add your OpenAI API key in Settings.');
    }

    if (!transcript || transcript.trim().length < 20) {
      throw new Error('Transcript is too short to generate notes.');
    }

    // For long transcripts, summarise in chunks
    const truncated = transcript.length > 12000
      ? transcript.slice(0, 12000) + '\n\n[Transcript truncated for length]'
      : transcript;

    const systemPrompt = `You are NoteScribe AI, an expert meeting and lecture note-taker.
Your job is to produce highly structured, actionable notes from transcripts.
Always respond with valid JSON only — no markdown fences, no extra text.`;

    const userPrompt = `Analyse this transcript and return a JSON object with these exact keys:

{
  "title": "Short meeting/lecture title (5-8 words)",
  "summary": "2-4 sentence executive summary",
  "keyPoints": ["bullet 1", "bullet 2", ...],      // 3-8 key points
  "concepts": ["concept 1", "concept 2", ...],      // important terms/concepts mentioned
  "actionItems": ["action 1", "action 2", ...],     // concrete tasks identified
  "questions": ["question 1", ...],                 // questions raised or discussed
  "tasks": [{"task": "...", "assignee": "...", "deadline": "..."}],
  "decisions": ["decision 1", ...],
  "deadlines": [{"item": "...", "date": "..."}],
  "followUps": ["follow-up 1", ...]
}

Transcript:
${truncated}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:   2000,
        temperature:  0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `GPT API error: ${response.status}`);
    }

    const data    = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Could not parse AI response. Please try again.');
    }
  }

  /* ─────────────────────────────────────────────────
     FALLBACK — Demo notes when no API key present
  ───────────────────────────────────────────────── */
  generateDemoNotes(transcript) {
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);

    return {
      title:       'Meeting Notes (Demo)',
      summary:     `This transcript contains approximately ${wordCount} words across ${sentences.length} sentences. Add your OpenAI API key in Settings to generate real AI-powered notes with summaries, action items, and insights.`,
      keyPoints:   sentences.slice(0, 5).map(s => s.trim()),
      concepts:    this._extractKeywords(transcript).slice(0, 6),
      actionItems: ['Add your OpenAI API key in Settings to unlock AI notes'],
      questions:   transcript.match(/[^.!?]*\?/g)?.slice(0, 3).map(q => q.trim()) || [],
      tasks:       [],
      decisions:   [],
      deadlines:   [],
      followUps:   ['Review and edit transcript manually', 'Add API key for AI-generated notes'],
    };
  }

  /** Simple keyword extraction without an API */
  _extractKeywords(text) {
    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for',
      'of','with','by','is','are','was','were','be','been','have','has','had',
      'do','does','did','will','would','could','should','may','might','this',
      'that','these','those','i','we','you','he','she','they','it']);

    const words    = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const freq     = {};
    words.forEach(w => {
      if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }
}

// Expose globally
window.NoteScribeAI = NoteScribeAI;
