(() => {
  "use strict";

  const STORAGE_KEY = "js_flashcards_v1";
  const GRADING_STORAGE_KEY = "js_flashcards_grading_v1";

  /** @type {{id: string, front: string, back: string}[]} */
  let deckCards = [];
  /** @type {Record<string, boolean>} */
  let masteredById = {};

  const cardGrid = document.getElementById("flashcard-grid");
  const cardCountEl = document.getElementById("card-count");
  const shuffleBtn = document.getElementById("shuffle-deck");
  const progressLabelEl = document.getElementById("progress-label");
  const progressPercentEl = document.getElementById("progress-percent");
  const progressTrackEl = document.getElementById("progress-track");
  const progressBarEl = document.getElementById("progress-bar");
  const gradeStatusEl = document.getElementById("grade-status");

  const form = document.getElementById("card-form");
  const frontInput = document.getElementById("front-input");
  const backInput = document.getElementById("back-input");
  const clearBtn = document.getElementById("clear-form");
  const errorEl = document.getElementById("form-error");

  const defaultCards = [
    {
      id: "default-1",
      front: "What is JavaScript?",
      back: "JavaScript is the language used to add interactivity to web pages (running in the browser or on servers).",
    },
    {
      id: "default-2",
      front: "`let` vs `var`",
      back: "`let` is block-scoped; `var` is function-scoped (and variables are hoisted differently). Use `let`/`const` in modern code.",
    },
    {
      id: "default-3",
      front: "`const` means...",
      back: "`const` creates a binding you can't reassign. For objects/arrays, you can still mutate the contents.",
    },
    {
      id: "default-4",
      front: "`===` vs `==`",
      back: "`===` checks both value and type (no coercion). `==` allows type coercion, which can hide bugs.",
    },
    {
      id: "default-5",
      front: "What is a closure?",
      back: 'A closure is when a function "remembers" variables from the scope where it was created, even after that scope has finished.',
    },
  ];

  const uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `fc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  function loadCards() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...defaultCards];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return [...defaultCards];

      return parsed
        .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
        .map((c) => ({
          id: typeof c.id === "string" ? c.id : uid(),
          front: String(c.front),
          back: String(c.back),
        }));
    } catch {
      return [...defaultCards];
    }
  }

  function saveCards(nextCards) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCards));
    } catch {
      // If storage is unavailable, the app still works in-memory.
    }
  }

  function loadGradingState() {
    try {
      const raw = localStorage.getItem(GRADING_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};

      /** @type {Record<string, boolean>} */
      const next = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "boolean") next[k] = v;
      }
      return next;
    } catch {
      return {};
    }
  }

  function saveGradingState() {
    try {
      localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(masteredById));
    } catch {
      // Ignore if storage is unavailable.
    }
  }

  function updateProgressUI() {
    const total = deckCards.length || 0;
    const masteredCount = deckCards.reduce((acc, c) => acc + (masteredById[c.id] ? 1 : 0), 0);
    const stuckCount = total - masteredCount;
    const percent = total === 0 ? 0 : Math.round((masteredCount / total) * 100);

    if (progressLabelEl) progressLabelEl.textContent = `${masteredCount} mastered • ${stuckCount} stuck`;
    if (progressPercentEl) progressPercentEl.textContent = `${percent}%`;
    if (progressTrackEl) progressTrackEl.setAttribute("aria-valuenow", String(percent));
    if (progressBarEl) progressBarEl.style.width = `${percent}%`;
  }

  function updateCount() {
    if (!cardCountEl) return;
    const count = deckCards.length;
    cardCountEl.textContent = `${count} card${count === 1 ? "" : "s"}`;
    updateProgressUI();
  }

  function setFlipped(el, flipped) {
    el.classList.toggle("is-flipped", flipped);
    el.setAttribute("aria-pressed", String(flipped));
  }

  function flipCard(cardEl) {
    if (!cardEl) return;

    const alreadyFlipped = cardEl.classList.contains("is-flipped");
    const flippedEls = cardGrid?.querySelectorAll(".flashcard.is-flipped") || [];

    // Unflip others so flipping feels like a study session.
    flippedEls.forEach((el) => {
      if (el !== cardEl) setFlipped(el, false);
    });

    setFlipped(cardEl, !alreadyFlipped);
  }

  function isMastered(cardId) {
    return Boolean(masteredById[cardId]);
  }

  function getOrderedDeckForSession() {
    // “Spaced repetition lite” ordering:
    // - Stuck cards first
    // - Mastered cards later (completed for this session)
    const stuck = deckCards.filter((c) => !isMastered(c.id));
    const mastered = deckCards.filter((c) => isMastered(c.id));
    return [...stuck, ...mastered];
  }

  function setGradeStatus(msg) {
    if (!gradeStatusEl) return;
    gradeStatusEl.textContent = msg || "";
  }

  function playSuccessSound() {
    try {
      const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextImpl) return;

      const ctx = new AudioContextImpl();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;

      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      osc.start(t);
      osc.stop(t + 0.13);
      osc.onended = () => {
        try {
          ctx.close();
        } catch {}
      };
    } catch {
      // Audio is best-effort; ignore failures.
    }
  }

  let renderTimer = 0;
  function scheduleRender(delayMs) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = 0;
      renderCards();
    }, delayMs);
  }

  function handleGrade(cardId, knewIt, cardEl) {
    masteredById[cardId] = Boolean(knewIt);
    saveGradingState();

    if (knewIt) {
      setGradeStatus("Success! Marked as known.");
      if (cardEl) {
        cardEl.classList.remove("is-forgot");
        cardEl.classList.add("is-success");
      }
      playSuccessSound();
      updateProgressUI();
      scheduleRender(340);
    } else {
      setGradeStatus("No worries. Kept in rotation.");
      if (cardEl) {
        cardEl.classList.remove("is-success");
        cardEl.classList.add("is-forgot");
      }
      updateProgressUI();
      scheduleRender(250);
    }

    // Clear the status after a moment so it doesn't dominate the UI.
    window.setTimeout(() => setGradeStatus(""), 900);
  }

  function renderCards() {
    updateCount();

    if (!cardGrid) return;
    cardGrid.innerHTML = "";

    const ordered = getOrderedDeckForSession();
    ordered.forEach((card, idx) => {
      const cardEl = document.createElement("div");
      cardEl.className = "flashcard";
      if (isMastered(card.id)) cardEl.classList.add("is-mastered");
      cardEl.tabIndex = 0;
      cardEl.setAttribute("role", "button");
      cardEl.setAttribute("aria-pressed", "false");
      cardEl.setAttribute(
        "aria-label",
        `Flashcard ${idx + 1}${isMastered(card.id) ? " (mastered)" : ""}. Click to flip.`
      );

      const inner = document.createElement("div");
      inner.className = "flashcard-inner";

      const front = document.createElement("div");
      front.className = "flashcard-face flashcard-front";

      const frontTop = document.createElement("div");
      frontTop.className = "flashcard-front-top";

      const frontText = document.createElement("div");
      frontText.className = "flashcard-front-text";
      frontText.textContent = card.front;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "flashcard-delete-btn";
      deleteBtn.setAttribute("aria-label", "Delete this flashcard");
      deleteBtn.textContent = "✕";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleDeleteCard(card.id);
      });

      frontTop.append(frontText, deleteBtn);
      front.append(frontTop);

      const back = document.createElement("div");
      back.className = "flashcard-face flashcard-back";

      const backText = document.createElement("div");
      backText.textContent = card.back;
      back.append(backText);

      const gradeActions = document.createElement("div");
      gradeActions.className = "fc-grade-actions";

      const knewBtn = document.createElement("button");
      knewBtn.type = "button";
      knewBtn.className = "btn btn-grade-known";
      knewBtn.textContent = "I Knew It ✅";
      knewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleGrade(card.id, true, cardEl);
      });

      const forgotBtn = document.createElement("button");
      forgotBtn.type = "button";
      forgotBtn.className = "btn btn-grade-forgot";
      forgotBtn.textContent = "I Forgot ❌";
      forgotBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleGrade(card.id, false, cardEl);
      });

      gradeActions.append(knewBtn, forgotBtn);
      back.append(gradeActions);

      inner.append(front, back);
      cardEl.append(inner);

      cardEl.addEventListener("click", (e) => {
        // Don’t trigger flip when interacting with grading controls.
        if (e.target.closest(".fc-grade-actions")) return;
        if (e.target.closest("button")) return;
        flipCard(cardEl);
      });
      cardEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          flipCard(cardEl);
        }
      });

      cardGrid.append(cardEl);
    });
  }

  function setError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  }

  function handleAddCard(e) {
    if (e) e.preventDefault();

    const front = (frontInput?.value || "").trim();
    const back = (backInput?.value || "").trim();

    if (!front || !back) {
      setError("Please provide both a front and a back for the flashcard.");
      return;
    }

    const newCard = { id: uid(), front, back };
    deckCards = [newCard, ...deckCards];
    saveCards(deckCards);

    // New cards start “stuck” unless the user grades them.
    if (!(newCard.id in masteredById)) masteredById[newCard.id] = false;
    saveGradingState();

    renderCards();

    if (frontInput) frontInput.value = "";
    if (backInput) backInput.value = "";
    setError("");
    frontInput?.focus();
  }

  function handleClear() {
    if (frontInput) frontInput.value = "";
    if (backInput) backInput.value = "";
    setError("");
    frontInput?.focus();
  }

  function handleDeleteCard(cardId) {
    deckCards = deckCards.filter((c) => c.id !== cardId);
    delete masteredById[cardId];
    saveCards(deckCards);
    saveGradingState();
    renderCards();
  }

  function shuffleArray(arr) {
    const next = [...arr];
    // Fisher–Yates shuffle
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function init() {
    deckCards = loadCards();
    masteredById = loadGradingState();

    // Drop grading entries for cards that no longer exist.
    const deckIds = new Set(deckCards.map((c) => c.id));
    for (const id of Object.keys(masteredById)) {
      if (!deckIds.has(id)) delete masteredById[id];
    }

    renderCards();

    form?.addEventListener("submit", handleAddCard);
    clearBtn?.addEventListener("click", handleClear);
    frontInput?.addEventListener("input", () => setError(""));
    backInput?.addEventListener("input", () => setError(""));

    shuffleBtn?.addEventListener("click", () => {
      deckCards = shuffleArray(deckCards);
      saveCards(deckCards);
      setGradeStatus("Deck shuffled.");
      renderCards();
      window.setTimeout(() => setGradeStatus(""), 900);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

