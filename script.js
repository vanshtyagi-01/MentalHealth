(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:2200";
  const GAUGE_ARC_LENGTH = 314.16; // pi * r(100)
  const PLATFORMS = ["Instagram","TikTok","YouTube","WhatsApp","Snapchat","Facebook","Twitter","LinkedIn","LINE","KakaoTalk","VKontakte","WeChat"];

  const $ = (id) => document.getElementById(id);
  const form = $("predict-form");
  const submitBtn = $("submit-btn");
  const states = { idle: $("state-idle"), loading: $("state-loading"), result: $("state-result"), error: $("state-error") };

  const scoreNumberEl = $("score-number");
  const scoreBandEl = $("score-band");
  const scoreContextEl = $("score-context");
  const insightsEl = $("insights");
  const gaugeFill = $("gauge-fill");
  const needle = $("needle");
  const errorLabelEl = $("error-label");
  const errorCopyEl = $("error-copy");
  const progressBar = $("progress-bar");

  const stressHidden = $("stress_level");
  const platformHidden = $("most_used_platform");
  const segGroup = $("stress_level_group");
  const platformGroup = $("platform_group");

  // ---------------------------------------------------------
  // Gauge ticks
  // ---------------------------------------------------------
  document.querySelectorAll(".gauge-ticks").forEach((g) => {
    const cx = 120, cy = 140, rO = 100, rI = 89;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      const rIn = i % 5 === 0 ? rI - 4 : rI;
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", (cx + rO * Math.cos(a)).toFixed(1));
      l.setAttribute("y1", (cy - rO * Math.sin(a)).toFixed(1));
      l.setAttribute("x2", (cx + rIn * Math.cos(a)).toFixed(1));
      l.setAttribute("y2", (cy - rIn * Math.sin(a)).toFixed(1));
      g.appendChild(l);
    }
  });

  // ---------------------------------------------------------
  // Platform chips + stress segmented control
  // ---------------------------------------------------------
  PLATFORMS.forEach((p) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.dataset.value = p; b.textContent = p;
    platformGroup.appendChild(b);
  });

  function wireChoice(group, selector, hidden) {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(selector);
      if (!btn) return;
      setChoice(group, selector, hidden, btn.dataset.value);
    });
  }
  function setChoice(group, selector, hidden, value) {
    group.querySelectorAll(selector).forEach((b) => b.classList.toggle("active", b.dataset.value === value));
    hidden.value = value;
    clearFieldError(hidden);
    updateProgress();
  }
  wireChoice(segGroup, ".seg-btn", stressHidden);
  wireChoice(platformGroup, ".chip", platformHidden);

  // ---------------------------------------------------------
  // Sliders <-> number inputs
  // ---------------------------------------------------------
  function paintRange(r) {
    const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--pct", Math.max(0, Math.min(100, pct)) + "%");
  }
  document.querySelectorAll(".range").forEach((r) => {
    const num = $(r.dataset.sync);
    paintRange(r);
    r.addEventListener("input", () => { num.value = r.value; paintRange(r); clearFieldError(num); updateProgress(); });
    num.addEventListener("input", () => {
      if (num.value !== "") r.value = num.value;
      paintRange(r);
    });
  });

  // ---------------------------------------------------------
  // Progress bar (fraction of fields filled)
  // ---------------------------------------------------------
  const REQUIRED = ["age","gender","country","academic_level","most_used_platform","purpose_of_use","avg_daily_usage_hours","daily_unlocks","study_hours","physical_activity_hours","sleep_hours_per_night","stress_level"];
  function updateProgress() {
    const filled = REQUIRED.filter((id) => String($(id).value).trim() !== "").length;
    progressBar.style.width = (filled / REQUIRED.length) * 100 + "%";
  }

  // ---------------------------------------------------------
  // Field-level error helpers
  // ---------------------------------------------------------
  const fieldWrapper = (input) => input.closest(".field");
  function setFieldError(input, message) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.add("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = message;
  }
  function clearFieldError(input) {
    const wrap = fieldWrapper(input);
    if (!wrap) return;
    wrap.classList.remove("field-error");
    const msgEl = wrap.querySelector(".error-msg");
    if (msgEl) msgEl.textContent = "";
  }
  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------------------------------------------------------
  // Validation mirroring the StudentData model
  // ---------------------------------------------------------
  function validate(payload) {
    const errors = [];
    [["age",10,100],["avg_daily_usage_hours",0,24],["daily_unlocks",0,Infinity],["study_hours",0,24],["physical_activity_hours",0,24],["sleep_hours_per_night",0,24]]
      .forEach(([key, min, max]) => {
        const input = $(key), val = payload[key];
        if (val === "" || val === null || Number.isNaN(val)) errors.push([input, "This field is required."]);
        else if (val < min || val > max) errors.push([input, `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
      });
    ["gender","country","academic_level","most_used_platform","purpose_of_use"].forEach((key) => {
      if (!payload[key] || String(payload[key]).trim() === "") errors.push([$(key), key === "most_used_platform" ? "Pick a platform." : "This field is required."]);
    });
    if (!payload.stress_level) errors.push([stressHidden, "Pick a stress level."]);
    return errors;
  }

  function collectPayload() {
    const fd = new FormData(form);
    const num = (k, int) => (fd.get(k) === "" ? NaN : int ? parseInt(fd.get(k), 10) : parseFloat(fd.get(k)));
    return {
      age: num("age", true),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: num("avg_daily_usage_hours"),
      daily_unlocks: num("daily_unlocks", true),
      study_hours: num("study_hours"),
      physical_activity_hours: num("physical_activity_hours"),
      sleep_hours_per_night: num("sleep_hours_per_night"),
      stress_level: fd.get("stress_level") || "",
    };
  }

  // ---------------------------------------------------------
  // UI state
  // ---------------------------------------------------------
  function showState(name) {
    Object.entries(states).forEach(([k, el]) => (el.hidden = k !== name));
  }
  function setSubmitting(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
  }

  function bandFor(score) {
    if (score < 4) return { label: "Signal: strained", color: "var(--coral)", context: "Your responses suggest elevated strain right now. Small shifts in sleep or screen time can go a long way." };
    if (score < 7) return { label: "Signal: balanced", color: "var(--amber)", context: "Your rhythm looks fairly steady, with some room to recover and reset." };
    return { label: "Signal: strong", color: "var(--green)", context: "Your habits point to a well-supported, resilient baseline. Keep it up." };
  }

  // personalised, rule-based nudges from the user's own inputs
  function buildInsights(p) {
    const out = [];
    const add = (kind, title, text) => out.push({ kind, title, text });

    if (p.sleep_hours_per_night >= 7 && p.sleep_hours_per_night <= 9) add("good", "Sleep is on target", `${p.sleep_hours_per_night} h a night sits in the healthy 7–9 h window.`);
    else if (p.sleep_hours_per_night < 7) add(p.sleep_hours_per_night < 6 ? "bad" : "warn", "Sleep is running short", `${p.sleep_hours_per_night} h a night — even +30 min can lift mood and focus.`);

    if (p.avg_daily_usage_hours >= 6) add("bad", "Heavy screen time", `${p.avg_daily_usage_hours} h a day. Try app timers or a phone-free hour before bed.`);
    else if (p.avg_daily_usage_hours >= 4) add("warn", "Screen time is creeping up", `${p.avg_daily_usage_hours} h a day — worth keeping an eye on.`);
    else add("good", "Healthy screen balance", `${p.avg_daily_usage_hours} h a day keeps you well within a comfortable range.`);

    if (p.daily_unlocks > 100) add("warn", "Frequent phone checks", `${p.daily_unlocks} unlocks a day suggests fragmented attention.`);

    if (p.physical_activity_hours >= 1) add("good", "Active routine", `${p.physical_activity_hours} h of movement a day is a strong stress buffer.`);
    else add("warn", "Add some movement", "A short daily walk is one of the easiest mood boosters.");

    if (p.stress_level === "High" || p.stress_level === "Very High") add("bad", "Stress is elevated", "Consider breaks, breathing exercises, or talking to someone you trust.");

    // show most important first: bad → warn → good, cap at 4
    const rank = { bad: 0, warn: 1, good: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 4);
  }

  function countUp(el, to, ms = 1300) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = (to * eased).toFixed(2);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function renderResult(score, payload) {
    const clamped = Math.max(0, Math.min(10, score));
    const band = bandFor(clamped);

    scoreBandEl.textContent = band.label;
    scoreBandEl.style.setProperty("--band", band.color);
    scoreContextEl.textContent = band.context;

    insightsEl.innerHTML = "";
    buildInsights(payload).forEach((i, idx) => {
      const d = document.createElement("div");
      d.className = `insight ${i.kind}`;
      d.style.animationDelay = `${0.5 + idx * 0.12}s`;
      d.innerHTML = `<span class="dot"></span><span><b></b><span class="t"></span></span>`;
      d.querySelector("b").textContent = i.title;
      d.querySelector(".t").textContent = i.text;
      insightsEl.appendChild(d);
    });

    // reset, then animate on next frame
    gaugeFill.style.transition = "none";
    needle.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
    needle.style.transform = "rotate(-90deg)";
    scoreNumberEl.textContent = "0.00";
    showState("result");
    void gaugeFill.getBoundingClientRect(); // force reflow
    requestAnimationFrame(() => {
      gaugeFill.style.transition = "";
      needle.style.transition = "";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH * (1 - clamped / 10));
      needle.style.transform = `rotate(${-90 + (clamped / 10) * 180}deg)`;
      countUp(scoreNumberEl, score);
    });

    if (window.matchMedia("(max-width: 920px)").matches) $("state-result").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderError(label, copy) {
    errorLabelEl.textContent = label;
    errorCopyEl.textContent = copy;
    showState("error");
  }

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const target = field ? $(field) : null;
      if (target) { setFieldError(target, err.msg || "Invalid value."); matched = true; }
    });
    return matched;
  }

  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const clientErrors = validate(payload);
    if (clientErrors.length > 0) {
      clientErrors.forEach(([input, msg]) => input && setFieldError(input, msg));
      const first = clientErrors[0][0];
      (first.type === "hidden" ? fieldWrapper(first) : first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first.type !== "hidden") first.focus?.({ preventScroll: true });
      return;
    }

    setSubmitting(true);
    showState("loading");
    const minWait = new Promise((r) => setTimeout(r, 700)); // let the loader breathe

    try {
      const [res] = await Promise.all([
        fetch(`${API_BASE}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
        minWait,
      ]);

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        renderError("Check your inputs", matched ? "The API rejected a few fields — details are marked on the form." : "The API rejected this submission. Please review your inputs and try again.");
        return;
      }
      if (!res.ok) {
        let msg = `The API responded with status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") msg = body.detail;
        renderError("Prediction failed", msg);
        return;
      }
      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        renderError("Unexpected response", "The API responded, but the score was missing or malformed.");
        return;
      }
      renderResult(data.predicted_mental_health_score, payload);
    } catch (err) {
      renderError("Can't reach the server", `Couldn't connect to ${API_BASE}. Make sure the backend is running (uvicorn main:app --port 2200 --reload) and reachable from this page.`);
    } finally {
      setSubmitting(false);
    }
  });

  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => { clearFieldError(el); updateProgress(); });
    el.addEventListener("change", () => { clearFieldError(el); updateProgress(); });
  });

  // ---------------------------------------------------------
  // Sample data + resets
  // ---------------------------------------------------------
  $("sample-btn").addEventListener("click", () => {
    const sample = { age: 21, gender: "Female", country: "India", academic_level: "Undergraduate", purpose_of_use: "Entertainment",
      avg_daily_usage_hours: 5.5, daily_unlocks: 85, study_hours: 4, physical_activity_hours: 0.5, sleep_hours_per_night: 6.5 };
    Object.entries(sample).forEach(([k, v]) => { $(k).value = v; clearFieldError($(k)); });
    setChoice(platformGroup, ".chip", platformHidden, "Instagram");
    setChoice(segGroup, ".seg-btn", stressHidden, "High");
    document.querySelectorAll(".range").forEach((r) => { r.value = $(r.dataset.sync).value; paintRange(r); });
    updateProgress();
  });

  $("reset-btn").addEventListener("click", () => { showState("idle"); window.scrollTo({ top: 0, behavior: "smooth" }); });
  $("error-retry-btn").addEventListener("click", () => showState("idle"));

  updateProgress();
})();
