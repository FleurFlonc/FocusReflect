(() => {
  const STORAGE_KEY = "focus_reflect_v1";
  const PRIVACY_KEY = "focus_reflect_privacy_v1";

  const DAYS = [
    { id: 1, label: "Ma" }, { id: 2, label: "Di" }, { id: 3, label: "Wo" },
    { id: 4, label: "Do" }, { id: 5, label: "Vr" }, { id: 6, label: "Za" }, { id: 0, label: "Zo" }
  ];

  const $ = (id) => document.getElementById(id);

  const state = loadState();
  ensureShape();
  wireUI();
  setView("home"); // default: Vandaag
  renderAll();

  function defaultState(){
    const anchor = mondayOfThisWeekISO(todayISO());
    return {
      version: 1,
      viewMode: "business", // business | personal
      settings: {
        business: { activeDays: [3,4,5], reviewDay: 0, leadTargetPerCycle: 8, cycleLengthDays: 28, cycleAnchorISO: anchor },
        personal: { activeDays: [0,6], reviewDay: 0, leadTargetPerCycle: 0, cycleLengthDays: 28, cycleAnchorISO: anchor }
      },
      daily: { business: {}, personal: {} },
      weekly: { business: {}, personal: {} },
      kpi: { business: { leadEvents: [] }, personal: { leadEvents: [] } }
    };
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.settings || !parsed.daily) return defaultState();
      return parsed;
    } catch {
      return defaultState();
    }
  }

  function ensureShape(){
    if (!state.viewMode) state.viewMode = "business";
    if (!["business","personal"].includes(state.viewMode)) state.viewMode = "business";

    state.settings = state.settings || defaultState().settings;
    state.daily = state.daily || { business:{}, personal:{} };
    state.weekly = state.weekly || { business:{}, personal:{} };
    state.kpi = state.kpi || { business:{ leadEvents: [] }, personal:{ leadEvents: [] } };

    for (const m of ["business","personal"]) {
      state.settings[m] = state.settings[m] || defaultState().settings[m];
      state.daily[m] = state.daily[m] || {};
      state.weekly[m] = state.weekly[m] || {};
      state.kpi[m] = state.kpi[m] || { leadEvents: [] };
      if (!Array.isArray(state.kpi[m].leadEvents)) state.kpi[m].leadEvents = [];
    }
  }

  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function mode(){ return state.viewMode; }
  function settings(){ return state.settings[mode()]; }
  function dailyMap(){ return state.daily[mode()]; }
  function weeklyMap(){ return state.weekly[mode()]; }
  function kpi(){ return state.kpi[mode()]; }

  function wireUI(){
    $("modeBiz").addEventListener("click", () => setMode("business"));
    $("modePer").addEventListener("click", () => setMode("personal"));

    const menuBtn = $("btnMenu");
    const menuPanel = $("menuPanel");
    menuBtn.addEventListener("click", () => {
      const open = !menuPanel.hidden;
      menuPanel.hidden = open;
      menuBtn.setAttribute("aria-expanded", String(!open));
    });
    document.addEventListener("click", (e) => {
      if (!menuPanel.hidden && !menuPanel.contains(e.target) && e.target !== menuBtn) closeMenu();
    });
    $("btnOpenSettings").addEventListener("click", () => { setView("settings"); closeMenu(); });

    const privacyBtn = $("btnPrivacy");
    privacyBtn.addEventListener("click", () => {
      const now = !document.body.classList.contains("privacy");
      document.body.classList.toggle("privacy", now);
      privacyBtn.setAttribute("aria-pressed", String(now));
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(now));
    });
    try{
      const p = JSON.parse(localStorage.getItem(PRIVACY_KEY) || "false");
      document.body.classList.toggle("privacy", !!p);
      privacyBtn.setAttribute("aria-pressed", String(!!p));
    } catch {}

    $("btnExport").addEventListener("click", exportJSON);
    $("fileImport").addEventListener("change", importJSON);
    $("btnReset").addEventListener("click", resetAll);

    document.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => setView(btn.getAttribute("data-nav")));
    });

    $("btnCloseDaily").addEventListener("click", closeDaily);
    $("modalDaily").addEventListener("click", (e) => { if (e.target === $("modalDaily")) closeDaily(); });
    $("dailyForm").addEventListener("submit", (e) => { e.preventDefault(); saveDaily(); });

    $("btnCloseWeekly").addEventListener("click", closeWeekly);
    $("modalWeekly").addEventListener("click", (e) => { if (e.target === $("modalWeekly")) closeWeekly(); });
    $("weeklyForm").addEventListener("submit", (e) => { e.preventDefault(); saveWeekly(); });

    const es = $("energyStart"); const ee = $("energyEnd");
    es.addEventListener("input", () => $("energyStartVal").textContent = String(es.value));
    ee.addEventListener("input", () => $("energyEndVal").textContent = String(ee.value));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeDaily(); closeWeekly(); closeMenu(); }
    });
  }

  function closeMenu(){
    $("menuPanel").hidden = true;
    $("btnMenu").setAttribute("aria-expanded", "false");
  }

  function setMode(m){
    state.viewMode = m;
    persist();
    renderAll();
  }

  function setView(key){
    $("viewHome").hidden = key !== "home";
    $("viewWeek").hidden = key !== "week";
    $("viewDashboard").hidden = key !== "dash";
    $("viewSettings").hidden = key !== "settings";

    document.querySelectorAll(".navbtn").forEach(btn => {
      const active = btn.getAttribute("data-nav") === key;
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function renderAll(){
    $("modeBiz").setAttribute("aria-selected", String(mode() === "business"));
    $("modePer").setAttribute("aria-selected", String(mode() === "personal"));
    $("modeHint").textContent = mode() === "business" ? "Zakelijk • doelen & KPI" : "Privé • energie & herstel";

    renderReminders();
    renderHome();
    renderWeek();
    renderDashboard();
    renderSettings();
  }

  function renderReminders(){
    const r = $("reminders");
    const today = todayISO();
    const s = settings();
    const isActiveDay = s.activeDays.includes(dayOfWeek(today));
    const d = dailyMap()[today];
    const needsDaily = isActiveDay && (!d || !d.checkinDone);
    const needsWeekly = isReviewDue();

    const chips = [];
    if (needsDaily) chips.push(`<span class="pill warn">⏱️ Daily nog niet gedaan</span>`);
    if (needsWeekly) chips.push(`<span class="pill warn">📅 Weekly review pending</span>`);

    if (chips.length === 0) { r.hidden = true; r.innerHTML = ""; return; }

    r.hidden = false;
    r.innerHTML = `
      <div class="left">
        <div class="rt">Reminders</div>
        <div class="rm">Alleen op jouw actieve dagen.</div>
      </div>
      <div class="chips">${chips.join("")}</div>
    `;
  }

  function isReviewDue(){
    const s = settings();
    const today = todayISO();
    const wk = mondayOfThisWeekISO(today);
    const w = weeklyMap()[wk];
    const dow = dayOfWeek(today);
    const order = [1,2,3,4,5,6,0];
    const reviewDow = s.reviewDay ?? 0;
    const inWindow = order.indexOf(dow) >= order.indexOf(reviewDow);
    return inWindow && (!w || !w.updatedAt);
  }

  function renderHome(){
    const today = todayISO();
    const s = settings();
    const isActiveDay = s.activeDays.includes(dayOfWeek(today));
    const d = dailyMap()[today] || null;

    $("viewHome").innerHTML = `
      <div class="grid2">
        <div class="card">
          <h3>Vandaag</h3>
          <p>${escapeHTML(longDateNL(today))} • ${isActiveDay ? "actieve dag" : "niet-actieve dag"}</p>

          <div class="grid2">
            <button class="btn btn-primary" id="btnPlanHome">Plan (ochtend)</button>
            <button class="btn" id="btnReflectHome">Reflect (avond)</button>
          </div>

          <div style="margin-top:10px;">
            <button class="btn" id="btnOpenWeeklyHome" style="width:100%;">Open Weekly</button>
          </div>

          <div style="margin-top:10px;">
            <div class="pill">${d?.checkinDone ? "✅ Daily gedaan" : "⏱️ Daily open"}</div>
            <div class="pill">🎯 Top 1: ${escapeHTML(d?.top1 || "—")}</div>
          </div>
          </div>
        </div>

        <div class="card">
          <h3>Waar begin ik?</h3>
          <p>1) Plan (ochtend) • 2) Reflect (avond) • 3) 1× per week Weekly.</p>
          <div class="grid3">
            <div class="card" style="box-shadow:none;background:rgba(255,255,255,.7);">
              <h3 style="margin:0 0 6px;">Energie</h3>
              <div class="pill">Start: ${d?.energyStart ?? "—"}</div>
              <div class="pill">Eind: ${d?.energyEnd ?? "—"}</div>
            </div>
            <div class="card" style="box-shadow:none;background:rgba(255,255,255,.7);">
              <h3 style="margin:0 0 6px;">Groei</h3>
              <div class="pill">${d?.growth ? "✅ micro gedaan" : "—"}</div>
              <div class="pill">${escapeHTML(d?.growth || "—")}</div>
            </div>
            <div class="card" style="box-shadow:none;background:rgba(255,255,255,.7);">
              <h3 style="margin:0 0 6px;">Actief</h3>
              <div class="pill">Cycle: ${countActiveDaysWithActivity(currentCycle().startISO, today)}/${countPossibleActiveDays(currentCycle().startISO, today)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("btnPlanHome").addEventListener("click", () => openDaily(today, "plan"));
    $("btnReflectHome").addEventListener("click", () => openDaily(today, "reflect"));
    $("btnOpenWeeklyHome").addEventListener("click", () => openWeekly(mondayOfThisWeekISO(today)));
  }

  function renderLeadStatus(){
    const s = settings();
    const c = currentCycle();
    const target = s.leadTargetPerCycle || 0;
    const count = countLeadsInRange(c.startISO, c.endISO);
    if (target <= 0) return `Leads: ${count}`;
    const expected = expectedLeadsByToday();
    const warn = count < expected;
    return `${warn ? "⛔" : "✅"} Leads: ${count}/${target} (verwacht ~${expected})`;
  }

  function renderWeek(){
    const today = todayISO();
    const wk = mondayOfThisWeekISO(today);
    const w = weeklyMap()[wk] || {};
    $("viewWeek").innerHTML = `
      <div class="grid2">
        <div class="card">
          <h3>Weekly review</h3>
          <p>Week start: <b>${escapeHTML(wk)}</b> • Review-dag: <b>${dayLabel(settings().reviewDay)}</b></p>
          <div class="grid2">
            <button class="btn btn-primary" id="btnOpenWeekly">Open Weekly</button>
            ${mode()==="business" ? `<button class="btn" id="btnLeadPlusWeek">+1 lead</button>` : ``}
          </div>
          <div style="margin-top:10px;">
            <div class="pill">Weekdoelen: ${escapeHTML(w.weekTop3 || "—")}</div>
            ${mode()==="business" ? `<div class="pill">Leads (week): <b>${w.leadsWeek ?? 0}</b></div>` : ``}
          </div>
        </div>

        <div class="card">
          <h3>Checklist status</h3>
          <div class="pill">${w.updatedAt ? "✅ Weekly opgeslagen" : "⏱️ Nog niet opgeslagen"}</div>
          <div class="pill">Inbox verwerkt: ${w.wcInbox ? "ja" : "nee"}</div>
          <div class="pill">Open loops: ${w.wcOpenLoops ? "ja" : "nee"}</div>
          <div class="pill">Next actions: ${w.wcProjects ? "ja" : "nee"}</div>
        </div>
      </div>
    `;
    $("btnOpenWeekly").addEventListener("click", () => openWeekly(wk));
    const leadBtn = $("btnLeadPlusWeek");
    if (leadBtn) leadBtn.addEventListener("click", () => {
      addLeadEvent();
      weeklyMap()[wk] = weeklyMap()[wk] || {};
      weeklyMap()[wk].leadsWeek = (weeklyMap()[wk].leadsWeek || 0) + 1;
      persist();
      renderAll();
    });
  }

  function renderDashboard(){
    const s = settings();
    const c = currentCycle();
    const today = todayISO();
    const target = s.leadTargetPerCycle || 0;
    const leadCount = countLeadsInRange(c.startISO, c.endISO);
    const expected = target > 0 ? expectedLeadsByToday() : 0;

    const activity = countActiveDaysWithActivity(c.startISO, today);
    const possible = countPossibleActiveDays(c.startISO, today);

    const avgEnergy = averageEnergy(c.startISO, today);
    const drains = topTimeDrains(c.startISO, today);

    $("viewDashboard").innerHTML = `
      <div class="grid2">
        <div class="card">
          <h3>Cycle (4 weken)</h3>
          <p>${escapeHTML(longDateNL(c.startISO))} → ${escapeHTML(longDateNL(c.endISO))}</p>
          <div class="pill">Actieve dagen met log: <b>${activity}</b> / ${possible}</div>
          <div class="pill">Gem. energie (ingevuld): <b>${avgEnergy ?? "—"}</b></div>
          ${mode()==="business" ? `<div class="pill">${target>0 ? `Leads: <b>${leadCount}/${target}</b> (verwacht ~${expected})` : `Leads: <b>${leadCount}</b>`}</div>` : `<div class="pill">Focus: energie (start/eind) + tijdvreters. Privé heeft geen KPI.</div>`}
        </div>

        <div class="card">
          <h3>Top tijdvreters</h3>
          ${drains.length ? drains.map(d=>`<div class="pill">• ${escapeHTML(d.label)}: <b>${d.count}</b></div>`).join("") : `<div class="pill">Nog geen data.</div>`}
        </div>
      </div>
    `;
  }

  function renderSettings(){
    const s = settings();
    const review = s.reviewDay ?? 0;
    const activeSet = new Set(s.activeDays || []);

    $("viewSettings").innerHTML = `
      <div class="card">
        <h3>Instellingen (${mode()==="business" ? "Zakelijk" : "Privé"})</h3>
        <p>Alleen actieve dagen tellen mee voor reminders & statistieken.</p>

        <div class="sectiontitle">Actieve dagen</div>
        <div class="grid3" id="daysGrid">
          ${DAYS.map(d => `
            <label class="checkline" style="margin:6px 0;">
              <input type="checkbox" data-day="${d.id}" ${activeSet.has(d.id) ? "checked" : ""} />
              <span>${d.label}</span>
            </label>
          `).join("")}
        </div>

        <div class="sectiontitle">Ritme</div>
        <div class="grid2">
          <label class="field">
            <span>Review-dag</span>
            <select id="reviewDay">
              ${DAYS.map(d => `<option value="${d.id}" ${d.id===review ? "selected" : ""}>${d.label}</option>`).join("")}
            </select>
          </label>

          <label class="field">
            <span>Lead target per cycle (4 weken)</span>
            <input id="leadTarget" type="number" min="0" step="1" value="${s.leadTargetPerCycle ?? 0}" />
          </label>
        </div>

        <div class="grid2">
          <label class="field">
            <span>Cycle anchor (startdatum)</span>
            <input id="cycleAnchor" type="date" value="${escapeHTML(s.cycleAnchorISO)}" />
          </label>
          <label class="field">
            <span>Cycle lengte (dagen)</span>
            <input id="cycleLen" type="number" min="7" step="1" value="${s.cycleLengthDays ?? 28}" />
          </label>
        </div>

        <button class="btn btn-primary" id="btnSaveSettings">Opslaan</button>
      </div>
    `;

    $("btnSaveSettings").addEventListener("click", () => {
      const newActive = [];
      document.querySelectorAll("#daysGrid input[data-day]").forEach(cb => {
        if (cb.checked) newActive.push(parseInt(cb.getAttribute("data-day"),10));
      });
      s.activeDays = newActive;
      s.reviewDay = parseInt($("reviewDay").value,10);
      s.leadTargetPerCycle = parseInt($("leadTarget").value||"0",10)||0;
      s.cycleAnchorISO = $("cycleAnchor").value || s.cycleAnchorISO;
      s.cycleLengthDays = parseInt($("cycleLen").value||"28",10)||28;
      persist();
      setView("home");
      renderAll();
    });
  }

  function openDaily(iso, view="plan"){
    const d = getOrCreateDaily(iso);
    $("dailyDate").value = iso;
    $("top1").value = d.top1 || "";
    $("top3").value = d.top3 || "";
    $("energyStart").value = String(d.energyStart || 3);
    $("energyStartVal").textContent = String(d.energyStart || 3);
    $("growth").value = d.growth || "";

    $("blocker").value = d.blocker || "";
    $("note").value = d.note || "";
    $("top1Done").checked = !!d.top1Done;
    $("energyEnd").value = String(d.energyEnd || 3);
    $("energyEndVal").textContent = String(d.energyEnd || 3);
    $("timeDrain").value = d.timeDrain || "";
    $("improve").value = d.improve || "";

    // Plan vs Reflect UX
    const details = $("moreDetails");
    if (details) {
      if (view === "reflect") details.open = true;
      else details.open = false;
    }
    // Focus a sensible field
    setTimeout(() => {
      try{
        if (view === "reflect") {
          const el = $("top1Done") || $("energyEnd") || $("improve");
          if (el) el.focus();
        } else {
          const el = $("top1") || $("top3");
          if (el) el.focus();
        }
      } catch {}
    }, 0);

    showModal($("modalDaily"));
  }
  function closeDaily(){ hideModal($("modalDaily")); }

  function saveDaily(){
    const iso = $("dailyDate").value;
    const d = getOrCreateDaily(iso);

    d.top1 = $("top1").value.trim();
    d.top3 = $("top3").value.trim();
    d.energyStart = parseInt($("energyStart").value,10)||3;
    d.growth = $("growth").value||"";

    d.blocker = $("blocker").value||"";
    d.note = $("note").value.trim();
    d.top1Done = !!$("top1Done").checked;
    d.energyEnd = parseInt($("energyEnd").value,10)||3;
    d.timeDrain = $("timeDrain").value||"";
    d.improve = $("improve").value.trim();

    d.checkinDone = !!(d.top1 || d.top3 || d.growth || d.note || d.blocker || d.energyStart);
    d.updatedAt = new Date().toISOString();

    persist();
    closeDaily();
    renderAll();
  }

  function getOrCreateDaily(iso){
    const m = dailyMap();
    if (!m[iso]) m[iso] = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return m[iso];
  }

  function openWeekly(weekKey){
    const w = getOrCreateWeekly(weekKey);
    $("weekKey").value = weekKey;
    $("wcInbox").checked = !!w.wcInbox;
    $("wcOpenLoops").checked = !!w.wcOpenLoops;
    $("wcProjects").checked = !!w.wcProjects;
    $("weekTop3").value = w.weekTop3 || "";
    $("leadsWeek").value = w.leadsWeek ?? 0;
    // Hide KPI input in privé
    try{
      const lbl = $("leadsWeek").closest(".field");
      if (lbl) lbl.style.display = (mode()==="business") ? "" : "none";
    } catch {}

    $("energyGives").value = w.energyGives || "";
    $("energyCosts").value = w.energyCosts || "";
    $("bigDrain").value = w.bigDrain || "";
    $("improveType").value = w.improveType || "";
    $("nextStep").value = w.nextStep || "";
    showModal($("modalWeekly"));
  }
  function closeWeekly(){ hideModal($("modalWeekly")); }

  function saveWeekly(){
    const wk = $("weekKey").value;
    const w = getOrCreateWeekly(wk);
    w.wcInbox = !!$("wcInbox").checked;
    w.wcOpenLoops = !!$("wcOpenLoops").checked;
    w.wcProjects = !!$("wcProjects").checked;
    w.weekTop3 = $("weekTop3").value.trim();
    w.leadsWeek = (mode()==="business") ? (parseInt($("leadsWeek").value||"0",10)||0) : 0;
    w.energyGives = $("energyGives").value.trim();
    w.energyCosts = $("energyCosts").value.trim();
    w.bigDrain = $("bigDrain").value||"";
    w.improveType = $("improveType").value||"";
    w.nextStep = $("nextStep").value.trim();
    w.updatedAt = new Date().toISOString();
    persist();
    closeWeekly();
    renderAll();
  }

  function getOrCreateWeekly(wk){
    const m = weeklyMap();
    if (!m[wk]) m[wk] = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return m[wk];
  }

  function addLeadEvent(){ kpi().leadEvents.push(new Date().toISOString()); }
  function countLeadsInRange(startISO, endISO){
    const start = startISO + "T00:00:00";
    const end = endISO + "T23:59:59";
    return kpi().leadEvents.filter(ts => ts >= start && ts <= end).length;
  }
  function expectedLeadsByToday(){
    const s = settings();
    const c = currentCycle();
    const total = s.leadTargetPerCycle || 0;
    if (total <= 0) return 0;
    const elapsed = daysBetween(c.startISO, todayISO()) + 1;
    const frac = Math.min(1, Math.max(0, elapsed / (s.cycleLengthDays||28)));
    return Math.round(total * frac);
  }

  function dayHasActivity(d){ return !!(d && d.checkinDone); }

  function countActiveDaysWithActivity(startISO, endISO){
    const s = settings();
    const map = dailyMap();
    let cnt = 0;
    for (const iso of eachDayISO(startISO, endISO)){
      if (!s.activeDays.includes(dayOfWeek(iso))) continue;
      if (dayHasActivity(map[iso])) cnt += 1;
    }
    return cnt;
  }
  function countPossibleActiveDays(startISO, endISO){
    const s = settings();
    let cnt = 0;
    for (const iso of eachDayISO(startISO, endISO)){
      if (s.activeDays.includes(dayOfWeek(iso))) cnt += 1;
    }
    return cnt;
  }
  function averageEnergy(startISO, endISO){
    const map = dailyMap();
    let total = 0, n = 0;
    for (const iso of eachDayISO(startISO, endISO)){
      const d = map[iso];
      if (!dayHasActivity(d)) continue;
      const val = d.energyEnd || d.energyStart;
      if (val) { total += val; n += 1; }
    }
    if (n === 0) return null;
    return Math.round((total/n)*10)/10;
  }
  function topTimeDrains(startISO, endISO){
    const map = dailyMap();
    const counts = {};
    const labels = { mail:"Mail/DM", meetings:"Meetings", admin:"Admin", zoeken:"Zoeken", contextswitch:"Context-switch", anders:"Anders" };
    for (const iso of eachDayISO(startISO, endISO)){
      const d = map[iso];
      if (!dayHasActivity(d) || !d.timeDrain) continue;
      counts[d.timeDrain] = (counts[d.timeDrain] || 0) + 1;
    }
    return Object.entries(counts).map(([k,v])=>({key:k,count:v,label:labels[k]||k})).sort((a,b)=>b.count-a.count).slice(0,5);
  }

  function currentCycle(){
    const s = settings();
    const anchor = s.cycleAnchorISO;
    const len = s.cycleLengthDays || 28;
    const today = todayISO();
    const diff = daysBetween(anchor, today);
    const cycles = diff >= 0 ? Math.floor(diff / len) : Math.floor((diff - (len-1)) / len);
    const start = addDaysISO(anchor, cycles * len);
    const end = addDaysISO(start, len-1);
    return { startISO: start, endISO: end };
  }

  function exportJSON(){
    const payload = { exportedAt: new Date().toISOString(), version: 1, data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus_reflect_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    closeMenu();
  }

  async function importJSON(e){
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try{
      const text = await file.text();
      const payload = JSON.parse(text);
      const incoming = payload.data ? payload.data : payload;
      const ok = confirm("Importeren overschrijft alles op dit apparaat. Doorgaan?");
      if (!ok) return;
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, incoming);
      ensureShape();
      persist();
      setView("home");
      renderAll();
      alert("Import klaar ✅");
    } catch (err){
      alert("Import mislukt.\n\n" + err.message);
    } finally {
      e.target.value = "";
      closeMenu();
    }
  }

  function resetAll(){
    const ok = confirm("Alles wissen op dit apparaat? (Tip: exporteer eerst.)");
    if (!ok) return;
    const fresh = defaultState();
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, fresh);
    persist();
    setView("home");
    renderAll();
    closeMenu();
  }

  function showModal(el){
    el.hidden = false;
    el.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }
  function hideModal(el){
    if (!el || el.hidden) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }

  function todayISO(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function dayOfWeek(iso){
    return new Date(iso + "T00:00:00").getDay();
  }
  function addDaysISO(iso, days){
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function daysBetween(aISO, bISO){
    const a = new Date(aISO + "T00:00:00");
    const b = new Date(bISO + "T00:00:00");
    return Math.floor((b-a) / (1000*60*60*24));
  }
  function eachDayISO(startISO, endISO){
    const out = [];
    let cur = startISO;
    while (cur <= endISO){
      out.push(cur);
      cur = addDaysISO(cur, 1);
    }
    return out;
  }
  function mondayOfThisWeekISO(iso){
    const dow = dayOfWeek(iso);
    const d = (dow === 0) ? 7 : dow;
    return addDaysISO(iso, -(d-1));
  }
  function longDateNL(iso){
    try{
      return new Date(iso + "T00:00:00").toLocaleDateString("nl-NL", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    } catch { return iso; }
  }
  function dayLabel(dow){
    const f = DAYS.find(x => x.id === dow);
    return f ? f.label : String(dow);
  }
  function escapeHTML(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
})();