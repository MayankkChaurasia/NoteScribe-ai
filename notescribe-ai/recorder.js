/**
 * recorder.js
 * Handles all audio capture: microphone and tab audio.
 * Provides waveform visualization via AudioContext + AnalyserNode.
 */

class AudioRecorder {
  constructor() {
    this.mediaRecorder   = null;
    this.audioChunks     = [];
    this.stream          = null;
    this.audioContext    = null;
    this.analyser        = null;
    this.animationFrame  = null;
    this.startTime       = null;
    this.timerInterval   = null;
    this.isRecording     = false;
    this.canvas          = null;
    this.canvasCtx       = null;
    this.onTranscriptUpdate = null; // callback for live transcription
    this.recognition     = null;   // SpeechRecognition instance
    this.fullTranscript  = '';
  }

  /**
   * Initialise the canvas used for waveform drawing.
   * Must be called after DOM is ready.
   */
  initCanvas(canvasEl) {
    this.canvas    = canvasEl;
    this.canvasCtx = canvasEl.getContext('2d');
  }

  /* ─────────────────────────────────────────────────
     START RECORDING
  ───────────────────────────────────────────────── */
  async start(source = 'mic') {
    try {
      if (source === 'tab') {
        // Tab capture requires background.js coordination
        this.stream = await this._getTabStream();
      } else {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate:       16000,
          }
        });
      }

      // Set up MediaRecorder
      const mimeType = this._getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks   = [];

      this.mediaRecorder.addEventListener('dataavailable', e => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      });

      // Collect in 1-second chunks so data is always available
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      // Waveform visualisation
      this._startVisualizer();

      // Timer
      this.startTime = Date.now();
      this._startTimer();

      // Browser Speech Recognition (live transcript)
      this._startSpeechRecognition();

      return { success: true };
    } catch (err) {
      console.error('[NoteScribe] Recording start error:', err);
      return { success: false, error: err.message };
    }
  }

  /* ─────────────────────────────────────────────────
     STOP RECORDING
  ───────────────────────────────────────────────── */
  stop() {
    return new Promise(resolve => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.addEventListener('stop', () => {
        const blob     = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        resolve({ blob, duration, transcript: this.fullTranscript });
      });

      this.mediaRecorder.stop();
      this.isRecording = false;

      // Clean up all streams/timers
      this._stopVisualizer();
      this._stopTimer();
      this._stopSpeechRecognition();

      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    });
  }

  /* ─────────────────────────────────────────────────
     TAB AUDIO CAPTURE
  ───────────────────────────────────────────────── */
  async _getTabStream() {
    // Send message to background.js to get tab stream ID
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'captureTab' }, async (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.streamId) {
          reject(new Error('Could not capture tab audio. Make sure a tab is active.'));
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource:   'tab',
                chromeMediaSourceId: response.streamId,
              }
            },
            video: false
          });
          resolve(stream);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /* ─────────────────────────────────────────────────
     WAVEFORM VISUALIZER
  ───────────────────────────────────────────────── */
  _startVisualizer() {
    if (!this.stream || !this.canvas) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser     = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);

    const bufferLen = this.analyser.frequencyBinCount;
    const dataArr   = new Uint8Array(bufferLen);

    const W = this.canvas.offsetWidth  || 380;
    const H = this.canvas.offsetHeight || 64;
    this.canvas.width  = W;
    this.canvas.height = H;
    this.canvas.classList.add('active');

    const accent = '#7c6af7';

    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(dataArr);

      const ctx = this.canvasCtx;
      ctx.clearRect(0, 0, W, H);

      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0,   'rgba(124,106,247,0.3)');
      gradient.addColorStop(0.5, 'rgba(124,106,247,1)');
      gradient.addColorStop(1,   'rgba(124,106,247,0.3)');

      ctx.lineWidth   = 2;
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const sliceW = W / bufferLen;
      let x = 0;

      for (let i = 0; i < bufferLen; i++) {
        const v = dataArr[i] / 128.0;
        const y = (v * H) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }

      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Mirror glow
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < bufferLen; i++) {
        const v  = dataArr[i] / 128.0;
        const y  = H - (v * H) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    draw();
  }

  _stopVisualizer() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.canvas) {
      this.canvas.classList.remove('active');
      this.canvasCtx && this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /* ─────────────────────────────────────────────────
     TIMER
  ───────────────────────────────────────────────── */
  _startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const ss = String(elapsed % 60).padStart(2, '0');
      const timerEl = document.getElementById('timer');
      if (timerEl) timerEl.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  _stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  /* ─────────────────────────────────────────────────
     LIVE SPEECH RECOGNITION (Browser Web Speech API)
  ───────────────────────────────────────────────── */
  _startSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('[NoteScribe] SpeechRecognition not available in this browser.');
      return;
    }

    this.recognition                  = new SR();
    this.recognition.continuous       = true;
    this.recognition.interimResults   = true;
    this.recognition.lang             = 'en-US';
    this.recognition.maxAlternatives  = 1;

    let segmentStart = 0;

    this.recognition.onresult = (event) => {
      let interim = '';
      let final   = '';

      for (let i = segmentStart; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final      += result[0].transcript + ' ';
          segmentStart = i + 1;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) this.fullTranscript += final;

      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate({ final, interim, full: this.fullTranscript });
      }
    };

    this.recognition.onerror = (e) => {
      // 'no-speech' is expected; ignore
      if (e.error !== 'no-speech') {
        console.warn('[NoteScribe] SpeechRecognition error:', e.error);
      }
    };

    // Restart on end if still recording (recognition auto-stops after silence)
    this.recognition.onend = () => {
      if (this.isRecording) {
        try { this.recognition.start(); } catch(_) {}
      }
    };

    try { this.recognition.start(); }
    catch(e) { console.warn('[NoteScribe] Could not start SpeechRecognition:', e); }
  }

  _stopSpeechRecognition() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch(_) {}
      this.recognition = null;
    }
  }

  /* ─────────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────────── */
  _getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  /** Reset transcript for a new session */
  resetTranscript() {
    this.fullTranscript = '';
  }

  /** Return audio blob as base64 for Whisper API */
  async blobToBase64(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }
}

// Expose globally for popup.js
window.AudioRecorder = AudioRecorder;
