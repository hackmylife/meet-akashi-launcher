/**
 * Content Script for Akashi (atnd.ak4.jp).
 *
 * Analyzes the DOM to detect clock-in/out status and
 * communicates with the Service Worker via message passing.
 *
 * NOTE: Content scripts declared in manifest.json cannot use
 * ES module imports. Constants are inlined here.
 */

const AKASHI_STATUS = {
  CLOCKED_IN: 'CLOCKED_IN',
  NOT_CLOCKED_IN: 'NOT_CLOCKED_IN',
  UNKNOWN: 'UNKNOWN',
};

const MSG = {
  AKASHI_STATUS_UPDATE: 'AKASHI_STATUS_UPDATE',
  REQUEST_AKASHI_STATUS: 'REQUEST_AKASHI_STATUS',
};

class AkashiDetector {
  constructor() {
    this.status = AKASHI_STATUS.UNKNOWN;
    this.hasClockOut = false;
    this._debounceTimer = null;
    // Record the date this page was loaded (YYYY-MM-DD)
    const d = new Date();
    this.pageLoadDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.init();
  }

  init() {
    // Initial analysis
    this.analyze();
    // Watch for SPA-like DOM changes
    this.observeDOM();
  }

  /**
   * Analyze the DOM and send status update to Service Worker.
   */
  analyze() {
    const newStatus = this.detectClockStatus();
    const newHasClockOut = this.detectHasClockOut();
    if (newStatus !== this.status || newHasClockOut !== this.hasClockOut) {
      this.status = newStatus;
      this.hasClockOut = newHasClockOut;
      this.sendStatusUpdate();
    }
  }

  sendStatusUpdate() {
    try {
      chrome.runtime.sendMessage({
        type: MSG.AKASHI_STATUS_UPDATE,
        status: this.status,
        hasClockOut: this.hasClockOut,
        pageLoadDate: this.pageLoadDate,
      });
    } catch {
      // Extension context may be invalidated after update
    }
  }

  /**
   * Detect clock-in status from Akashi DOM.
   */
  detectClockStatus() {
    // Primary: check punch info spans (most reliable)
    const punchResult = this.detectByPunchInfo();
    if (punchResult !== AKASHI_STATUS.UNKNOWN) return punchResult;

    // Fallback: button text analysis
    const buttonResult = this.detectByButtons();
    if (buttonResult !== AKASHI_STATUS.UNKNOWN) return buttonResult;

    return AKASHI_STATUS.UNKNOWN;
  }

  /**
   * Primary strategy: Check #working-start-punch-info__time and
   * #working-end-punch-info__time elements.
   * - Start time empty → NOT_CLOCKED_IN
   * - Start time filled, end time empty → CLOCKED_IN
   * - Both filled → CLOCKED_IN (already done for the day)
   */
  detectByPunchInfo() {
    const startTime = document.getElementById('working-start-punch-info__time');
    const endTime = document.getElementById('working-end-punch-info__time');

    if (!startTime) return AKASHI_STATUS.UNKNOWN;

    const startValue = (startTime.textContent || '').trim();
    if (!startValue) {
      return AKASHI_STATUS.NOT_CLOCKED_IN;
    }

    // Start time exists → clocked in
    return AKASHI_STATUS.CLOCKED_IN;
  }

  /**
   * Check if clock-out time is filled.
   */
  detectHasClockOut() {
    const endTime = document.getElementById('working-end-punch-info__time');
    if (!endTime) return false;
    return (endTime.textContent || '').trim() !== '';
  }

  /**
   * Fallback: Look for work start/end buttons.
   */
  detectByButtons() {
    const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');

    const startPatterns = ['開始する', 'テレワークを開始'];
    const endPatterns = ['終了する', 'テレワークを終了'];

    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').trim();

      for (const pattern of endPatterns) {
        if (text.includes(pattern)) return AKASHI_STATUS.CLOCKED_IN;
      }
      for (const pattern of startPatterns) {
        if (text.includes(pattern)) return AKASHI_STATUS.NOT_CLOCKED_IN;
      }
    }

    return AKASHI_STATUS.UNKNOWN;
  }

  /**
   * Observe DOM mutations (debounced) for SPA behavior.
   */
  observeDOM() {
    const observer = new MutationObserver(() => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.analyze(), 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

// --- Message listener ---
const detector = new AkashiDetector();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MSG.REQUEST_AKASHI_STATUS) {
    // Always do fresh DOM detection when explicitly asked
    detector.status = detector.detectClockStatus();
    detector.hasClockOut = detector.detectHasClockOut();
    sendResponse({
      status: detector.status,
      hasClockOut: detector.hasClockOut,
      pageLoadDate: detector.pageLoadDate,
    });
  }
  return true;
});
