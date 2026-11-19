/* =========================================================
   MindMetric — frontend logic
   Talks to the FastAPI backend:  POST /predict
   Request fields (StudentData) : age, gender, country, academic_level,
     most_used_platform, purpose_of_use, avg_daily_usage_hours,
     daily_unlocks, study_hours, physical_activity_hours,
     sleep_hours_per_night, stress_level
   Response                     : { predicted_mental_health_score: number }

   Test status: verified in headless Chrome against a test stand-in of
   main.py (same schema + your real .pkl model). Not yet exercised against
   your real FastAPI process or the live Render URL, so run one prediction
   on the deployed site after replacing the files.
   ========================================================= */
(() => {
  "use strict";

  // Lets CSS reveal-animations apply only when JavaScript is running.
  document.documentElement.classList.add("js");

  /* -------------------------------------------------------
     CONFIG
     ------------------------------------------------------- */
  // Deployed backend (Render). Used when the site is hosted online.
  const PROD_API = "https://mindmetric-1-xijl.onrender.com";

  // Local backend(s). Only tried when this page is opened from localhost / a
  // local file, e.g. `uvicorn main:app --reload` (port 8000) or `--port 2200`.
  // If none of them is running, the deployed backend above is used instead.
  const LOCAL_APIS = ["http://127.0.0.1:8000", "http://127.0.0.1:2200"];

  const IS_LOCAL_PAGE = ["localhost", "127.0.0.1", "[::1]", ""].includes(window.location.hostname);
  const API_CANDIDATES = IS_LOCAL_PAGE ? [...LOCAL_APIS, PROD_API] : [PROD_API];

  const LOCAL_TIMEOUT_MS = 6000;
  const REMOTE_TIMEOUT_MS = 60000; // free hosting can take ~1 minute to wake up
  const SLOW_NOTICE_MS = 5000;

  const SCORE_MAX = 10;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------------------------------
     ELEMENTS
     ------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  const header = $("site-header");
  const navToggle = $("nav-toggle");
  const primaryNav = $("primary-nav");

  const form = $("predict-form");
  const formAlert = $("form-alert");
  const submitBtn = $("submit-btn");
  const clearBtn = $("clear-btn");
  const resetBtn = $("reset-btn");
  const editBtn = $("edit-btn");
  const errorRetryBtn = $("error-retry-btn");

  const resultCard = $("result-card");
  const states = {
    idle: $("state-idle"),
    loading: $("state-loading"),
    result: $("state-result"),
    error: $("state-error"),
  };
  const loadingCopy = $("loading-copy");

  const gaugeFill = $("gauge-fill");
  const gaugeMarker = $("gauge-marker");
  const gaugeTicks = $("gauge-ticks");
  const scoreNumber = $("score-number");
  const scoreMax = $("score-max");
  const scoreBand = $("score-band");
  const scoreContext = $("score-context");
  const scoreNotes = $("score-notes");
  const scoreNotesWrap = $("score-notes-wrap");
  const scaleSegs = document.querySelectorAll(".scale-bar .seg");

  const errorLabel = $("error-label");
  const errorCopy = $("error-copy");

  const stressGroup = $("stress_level_group");
  const stressInput = $("stress_level");
  const stressButtons = Array.from(stressGroup.querySelectorAll(".seg-btn"));

  /* -------------------------------------------------------
     NAVIGATION
     ------------------------------------------------------- */
  function setNavOpen(open) {
    header.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  navToggle.addEventListener("click", () => setNavOpen(!header.classList.contains("nav-open")));

  // Close the mobile menu after choosing a link, pressing Escape, or resizing up.
  primaryNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setNavOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("nav-open")) {
      setNavOpen(false);
      navToggle.focus();
    }
  });
  window.matchMedia("(min-width: 941px)").addEventListener("change", (m) => m.matches && setNavOpen(false));

  // Header shadow once the page is scrolled.
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Highlight the nav link of the section currently in view.
  const navLinks = Array.from(document.querySelectorAll(".nav-link[data-section]"));
  function updateActiveLink() {
    const probe = window.scrollY + header.offsetHeight + window.innerHeight * 0.3;
    let current = "home";
    navLinks.forEach((link) => {
      const section = document.getElementById(link.dataset.section);
      if (section && section.offsetTop <= probe) current = link.dataset.section;
    });
    // The assessment section has no text link of its own (it has the CTA button).
    const predict = $("predict");
    if (predict && predict.offsetTop <= probe) current = "";
    navLinks.forEach((link) => {
      const on = link.dataset.section === current;
      link.classList.toggle("active", on);
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", updateActiveLink, { passive: true });
  window.addEventListener("resize", updateActiveLink);
  updateActiveLink();

  // "Check Your Score" / "Try" links: scroll to the form, then focus the first field.
  document.querySelectorAll("[data-focus-form]").forEach((el) => {
    el.addEventListener("click", () => {
      window.setTimeout(() => $("age").focus({ preventScroll: true }), prefersReducedMotion ? 50 : 700);
    });
  });

  // Reveal-on-scroll animation.
  const revealEls = document.querySelectorAll(".reveal");
  revealEls.forEach((el, i) => el.style.setProperty("--d", `${(i % 3) * 0.08}s`));
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* -------------------------------------------------------
     GAUGE
     ------------------------------------------------------- */
  const GAUGE = { cx: 120, cy: 120, r: 100 };

  function drawTicks() {
    const ns = "http://www.w3.org/2000/svg";
    gaugeTicks.innerHTML = "";
    for (let i = 0; i <= SCORE_MAX; i++) {
      const angle = Math.PI - (i / SCORE_MAX) * Math.PI;
      const major = i % 5 === 0;
      const r1 = 80;
      const r2 = major ? 68 : 74;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", (GAUGE.cx + r1 * Math.cos(angle)).toFixed(2));
      line.setAttribute("y1", (GAUGE.cy - r1 * Math.sin(angle)).toFixed(2));
      line.setAttribute("x2", (GAUGE.cx + r2 * Math.cos(angle)).toFixed(2));
      line.setAttribute("y2", (GAUGE.cy - r2 * Math.sin(angle)).toFixed(2));
      gaugeTicks.appendChild(line);
    }
  }

  // Positions the arc fill and the marker for a value between 0 and SCORE_MAX.
  function setGauge(value) {
    const v = Math.max(0, Math.min(SCORE_MAX, value));
    gaugeFill.style.strokeDashoffset = String(100 - (v / SCORE_MAX) * 100);
    const angle = Math.PI - (v / SCORE_MAX) * Math.PI;
    gaugeMarker.setAttribute("cx", (GAUGE.cx + GAUGE.r * Math.cos(angle)).toFixed(2));
    gaugeMarker.setAttribute("cy", (GAUGE.cy - GAUGE.r * Math.sin(angle)).toFixed(2));
  }

  let rafId = 0;
  function animateGauge(target, onDone) {
    cancelAnimationFrame(rafId);
    gaugeMarker.classList.add("show");
    const duration = prefersReducedMotion ? 0 : 1400;
    const start = performance.now();

    const finish = () => {
      setGauge(target);
      scoreNumber.textContent = target.toFixed(2);
      if (onDone) onDone();
    };
    if (!duration) return finish();

    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = target * eased;
      setGauge(current);
      scoreNumber.textContent = current.toFixed(2);
      if (t < 1) rafId = requestAnimationFrame(frame);
      else finish();
    };
    rafId = requestAnimationFrame(frame);
  }

  function resetGauge() {
    cancelAnimationFrame(rafId);
    gaugeFill.style.strokeDashoffset = "100";
    gaugeMarker.classList.remove("show");
    gaugeMarker.setAttribute("cx", String(GAUGE.cx - GAUGE.r));
    gaugeMarker.setAttribute("cy", String(GAUGE.cy));
    scoreNumber.textContent = "–";
    scoreMax.hidden = false;
  }

  drawTicks();
  resetGauge();

  /* -------------------------------------------------------
     STRESS SEGMENTED CONTROL (accessible radio group)
     ------------------------------------------------------- */
  function selectStress(btn, { focus = false } = {}) {
    stressButtons.forEach((b) => {
      const on = b === btn;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    stressInput.value = btn ? btn.dataset.value : "";
    if (btn && focus) btn.focus();
    if (btn) clearFieldError(stressInput);
  }

  function clearStress() {
    stressButtons.forEach((b, i) => {
      b.setAttribute("aria-checked", "false");
      b.tabIndex = i === 0 ? 0 : -1;
    });
    stressInput.value = "";
  }

  stressButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => selectStress(btn));
    btn.addEventListener("keydown", (e) => {
      let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = stressButtons[(i + 1) % stressButtons.length];
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = stressButtons[(i - 1 + stressButtons.length) % stressButtons.length];
      if (next) {
        e.preventDefault();
        selectStress(next, { focus: true });
      }
    });
  });

  /* -------------------------------------------------------
     FIELD ERRORS
     ------------------------------------------------------- */
  const wrapOf = (input) => input.closest(".field");

  function setFieldError(input, message) {
    const wrap = wrapOf(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msg = wrap.querySelector(".error-msg");
    if (msg) msg.textContent = message;
    input.setAttribute("aria-invalid", "true");
  }

  function clearFieldError(input) {
    const wrap = wrapOf(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msg = wrap.querySelector(".error-msg");
    if (msg) msg.textContent = "";
    input.removeAttribute("aria-invalid");
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    hideFormAlert();
  }

  function showFormAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
  }
  function hideFormAlert() {
    formAlert.hidden = true;
    formAlert.textContent = "";
  }

  /* -------------------------------------------------------
     VALIDATION (mirrors the StudentData model in main.py)
     ------------------------------------------------------- */
  const NUMERIC_FIELDS = [
    { id: "age",                     label: "your age",                  min: 10, max: 100,      integer: true },
    { id: "avg_daily_usage_hours",   label: "your average daily usage",  min: 0,  max: 24 },
    { id: "daily_unlocks",           label: "your daily phone unlocks",  min: 0,  max: Infinity, integer: true },
    { id: "study_hours",             label: "your study hours",          min: 0,  max: 24 },
    { id: "physical_activity_hours", label: "your physical activity",    min: 0,  max: 24 },
    { id: "sleep_hours_per_night",   label: "your sleep hours",          min: 0,  max: 24 },
  ];

  const CHOICE_FIELDS = [
    { id: "gender",             label: "your gender" },
    { id: "country",            label: "your country" },
    { id: "academic_level",     label: "your academic level" },
    { id: "most_used_platform", label: "your most used platform" },
    { id: "purpose_of_use",     label: "your purpose of use" },
  ];

  function numericProblem(field, raw) {
    const text = String(raw ?? "").trim();
    if (text === "") return `Please enter ${field.label}.`;
    const val = Number(text);
    if (!Number.isFinite(val)) return "Please enter a valid number.";
    if (field.integer && !Number.isInteger(val)) return "Please enter a whole number.";
    if (val < field.min || val > field.max) {
      return field.max === Infinity
        ? `Please enter ${field.min} or more.`
        : `Please enter a value between ${field.min} and ${field.max}.`;
    }
    return "";
  }

  function validateField(id) {
    const input = $(id);
    const numeric = NUMERIC_FIELDS.find((f) => f.id === id);
    if (numeric) return numericProblem(numeric, input.value);
    const choice = CHOICE_FIELDS.find((f) => f.id === id);
    if (choice) {
      if (String(input.value).trim() === "") {
        return input.tagName === "SELECT" ? `Please choose ${choice.label}.` : `Please enter ${choice.label}.`;
      }
      return "";
    }
    if (id === "stress_level" && !stressInput.value) return "Please pick your stress level.";
    return "";
  }

  function validateAll() {
    const problems = [];
    [...NUMERIC_FIELDS, ...CHOICE_FIELDS, { id: "stress_level" }].forEach(({ id }) => {
      const message = validateField(id);
      if (message) problems.push({ input: $(id), id, message });
    });
    return problems;
  }

  // Validate a field as soon as the user leaves it; clear the error while typing.
  form.querySelectorAll("input:not([type=hidden]), select").forEach((el) => {
    el.addEventListener("input", () => clearFieldError(el));
    el.addEventListener("change", () => clearFieldError(el));
    el.addEventListener("blur", () => {
      if (String(el.value).trim() === "" && !el.dataset.touched) return; // don't nag on tab-through
      el.dataset.touched = "1";
      const message = validateField(el.id);
      if (message) setFieldError(el, message);
    });
  });

  /* -------------------------------------------------------
     PAYLOAD (exact StudentData shape expected by FastAPI)
     ------------------------------------------------------- */
  function collectPayload() {
    return {
      age: parseInt(form.age.value, 10),
      gender: form.gender.value,
      country: form.country.value.trim(),
      academic_level: form.academic_level.value,
      most_used_platform: form.most_used_platform.value,
      purpose_of_use: form.purpose_of_use.value,
      avg_daily_usage_hours: parseFloat(form.avg_daily_usage_hours.value),
      daily_unlocks: parseInt(form.daily_unlocks.value, 10),
      study_hours: parseFloat(form.study_hours.value),
      physical_activity_hours: parseFloat(form.physical_activity_hours.value),
      sleep_hours_per_night: parseFloat(form.sleep_hours_per_night.value),
      stress_level: stressInput.value,
    };
  }

  /* -------------------------------------------------------
     RESULT-CARD STATES
     ------------------------------------------------------- */
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => (el.hidden = key !== name));
    resultCard.classList.toggle("is-loading", name === "loading");
  }

  function setSubmitting(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
    submitBtn.querySelector(".btn-label").textContent = on ? "Analyzing…" : "Get my score";
  }

  const isStackedLayout = () => window.matchMedia("(max-width: 940px)").matches;

  function scrollToResult() {
    if (!isStackedLayout()) return;
    resultCard.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  function scrollToForm() {
    $("predict").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  }

  /* -------------------------------------------------------
     SCORE INTERPRETATION
     (higher score = stronger well-being, 0–10 scale)
     ------------------------------------------------------- */
  function interpret(score) {
    if (score < 5) {
      return {
        key: "low",
        label: "Lower range",
        text: "Your answers point to a period where your routine may be weighing on you. That is a signal to be gentle with yourself, not a verdict. Small, steady changes often make a real difference.",
      };
    }
    if (score < 7) {
      return {
        key: "mid",
        label: "Moderate range",
        text: "Your routine looks fairly balanced, with some room to recover and recharge. A few small tweaks to rest, movement or screen time could help you feel even steadier.",
      };
    }
    return {
      key: "high",
      label: "Higher range",
      text: "Your habits point to a well-supported, resilient baseline. Keep nurturing the routines that are working for you, and check in with yourself regularly.",
    };
  }

  // Gentle, non-clinical reflection prompts based on the user's own inputs.
  function reflectionNotes(p) {
    const notes = [];
    if (p.sleep_hours_per_night < 7) notes.push("Sleep: you reported under 7 hours a night. A consistent bedtime can make days feel lighter.");
    if (p.avg_daily_usage_hours >= 6) notes.push("Screen time: you spend a lot of the day on social media. Short breaks or phone-free windows might help.");
    if (p.physical_activity_hours < 0.5) notes.push("Movement: even a short daily walk can lift mood and energy.");
    if (p.stress_level === "High" || p.stress_level === "Very High") notes.push("Stress: you rated your stress as high. Talking to someone you trust can really help.");
    return notes.slice(0, 3);
  }

  function renderResult(score, payload) {
    const result = interpret(score);

    scoreBand.textContent = result.label;
    scoreBand.className = `band-pill band-${result.key}`;
    scoreContext.textContent = result.text;
    scaleSegs.forEach((seg) => seg.classList.toggle("on", seg.classList.contains(`seg-${result.key}`)));

    const notes = reflectionNotes(payload);
    scoreNotes.innerHTML = "";
    notes.forEach((n) => {
      const li = document.createElement("li");
      li.textContent = n;
      scoreNotes.appendChild(li);
    });
    scoreNotesWrap.hidden = notes.length === 0;

    showState("result");
    resetGauge();
    animateGauge(score);
    scrollToResult();
  }

  let retryMode = "submit"; // what the error-state button does

  function renderError(label, copy, mode = "submit") {
    errorLabel.textContent = label;
    errorCopy.textContent = copy;
    retryMode = mode;
    errorRetryBtn.textContent = mode === "review" ? "Review my answers" : "Try again";
    resetGauge();
    showState("error");
    scrollToResult();
  }

  /* -------------------------------------------------------
     API CALL
     ------------------------------------------------------- */
  async function postPredict(base, payload, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${base}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  // Tries each backend in order; only falls through on network errors / timeouts.
  async function requestPrediction(payload) {
    let lastError = null;
    for (const base of API_CANDIDATES) {
      const isRemote = base === PROD_API;
      try {
        return await postPredict(base, payload, isRemote ? REMOTE_TIMEOUT_MS : LOCAL_TIMEOUT_MS);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("No backend reachable");
  }

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return null;
    let first = null;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const input = field ? $(field) : null;
      if (input) {
        setFieldError(input, "This value was not accepted. Please check it and try again.");
        first = first || input;
      }
    });
    return first;
  }

  /* -------------------------------------------------------
     SUBMIT
     ------------------------------------------------------- */
  let submitting = false;

  async function submitAssessment() {
    if (submitting) return;
    clearAllErrors();

    const problems = validateAll();
    if (problems.length) {
      problems.forEach((p) => setFieldError(p.input, p.message));
      showFormAlert(
        problems.length === 1
          ? "Almost there. Please fix the highlighted field."
          : `Almost there. Please fix the ${problems.length} highlighted fields.`
      );
      const first = problems[0].input;
      (first.type === "hidden" ? stressButtons[0] : first).focus();
      return;
    }

    const payload = collectPayload();
    submitting = true;
    setSubmitting(true);
    resetGauge();
    showState("loading");
    loadingCopy.textContent = "Running your answers through the model.";
    const slowTimer = window.setTimeout(() => {
      loadingCopy.textContent = "Still working. The server may be waking up, which can take up to a minute.";
    }, SLOW_NOTICE_MS);
    scrollToResult();

    try {
      const res = await requestPrediction(payload);

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const first = body ? applyServerValidationErrors(body.detail) : null;
        showFormAlert("The server could not accept some of your answers. Please review the highlighted fields.");
        renderError(
          "Check your answers",
          first
            ? "A few answers were not accepted. They are highlighted in the form."
            : "The server could not accept this submission. Please review your answers and try again.",
          "review"
        );
        if (first) first.focus({ preventScroll: false });
        return;
      }

      if (!res.ok) {
        let message = `The server responded with status ${res.status}. Please try again in a moment.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") message = body.detail;
        renderError("Prediction failed", message);
        return;
      }

      const data = await res.json();
      const score = data && data.predicted_mental_health_score;
      if (typeof score !== "number" || !Number.isFinite(score)) {
        renderError("Unexpected response", "The server replied, but the score was missing or in an unexpected format.");
        return;
      }

      renderResult(score, payload);
    } catch (err) {
      const timedOut = err && err.name === "AbortError";
      renderError(
        timedOut ? "The server is taking too long" : "Can't reach the server",
        timedOut
          ? "The prediction server did not respond in time. It may be starting up, so please try again in a moment."
          : "We couldn't connect to the prediction server. Please check your internet connection and try again."
      );
    } finally {
      window.clearTimeout(slowTimer);
      submitting = false;
      setSubmitting(false);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitAssessment();
  });

  /* -------------------------------------------------------
     RESET / RETRY BUTTONS
     ------------------------------------------------------- */
  function resetAssessment() {
    form.reset();
    clearStress();
    clearAllErrors();
    form.querySelectorAll("[data-touched]").forEach((el) => delete el.dataset.touched);
    resetGauge();
    showState("idle");
  }

  // "Take the assessment again": clears everything and returns to the top of the form.
  resetBtn.addEventListener("click", () => {
    resetAssessment();
    scrollToForm();
    window.setTimeout(() => $("age").focus({ preventScroll: true }), prefersReducedMotion ? 50 : 600);
  });

  // "Clear form" in the form footer.
  clearBtn.addEventListener("click", () => {
    resetAssessment();
    $("age").focus();
  });

  // "Edit my answers": keep the answers, go back to the form.
  editBtn.addEventListener("click", () => {
    scrollToForm();
    window.setTimeout(() => $("age").focus({ preventScroll: true }), prefersReducedMotion ? 50 : 600);
  });

  errorRetryBtn.addEventListener("click", () => {
    if (retryMode === "review") {
      showState("idle");
      scrollToForm();
      const firstError = form.querySelector(".field-error input, .field-error select");
      if (firstError) window.setTimeout(() => firstError.focus({ preventScroll: true }), 500);
    } else {
      submitAssessment();
    }
  });
})();
