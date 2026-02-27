(()=>{const STORAGE_KEY='compass_review_v1';const PRIVACY_KEY='compass_review_privacy_v1';
const DEFAULT_CONTEXTS=[{id:'c_own',name:'Eigen project'},{id:'c_job',name:'Parttime baan'}];
const DAYS=[{id:1,label:'Ma'},{id:2,label:'Di'},{id:3,label:'Wo'},{id:4,label:'Do'},{id:5,label:'Vr'},{id:6,label:'Za'},{id:0,label:'Zo'}];
const $=id=>document.getElementById(id);const state=loadState();const contextTabsEl=$('contextTabs');const remindersEl=$('reminders');
const viewToday=$('viewToday'),viewWeek=$('viewWeek'),viewDash=$('viewDashboard'),viewSettings=$('viewSettings');
const modalDaily=$('modalDaily'),modalWeekly=$('modalWeekly');const menuBtn=$('btnMenu'),menuPanel=$('menuPanel');
ensureShape();wireUI();renderAll();
function defaultState(){const contexts=DEFAULT_CONTEXTS.map(x=>({...x}));const activeContextId=contexts[0].id;const activeDays=[3,4,5];const reviewDay=0;const anchor=mondayOfThisWeekISO(todayISO());
return{version:1,contexts,activeContextId,settingsByContext:{[contexts[0].id]:{activeDays,reviewDay,leadTargetPerCycle:8,cycleLengthDays:28,cycleAnchorISO:anchor,workNotes:'Wo middag, Do/Vr hele dagen (+ avonden)'},[contexts[1].id]:{activeDays:[1,2,3,4,5],reviewDay,leadTargetPerCycle:0,cycleLengthDays:28,cycleAnchorISO:anchor,workNotes:'Vaste baan (parttime)'}},dailyByContext:{},weeklyByContext:{},kpiByContext:{}};}
function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return defaultState();const p=JSON.parse(raw);if(!p.contexts||!p.settingsByContext)return defaultState();return p;}catch{return defaultState();}}
function ensureShape(){
    if (!state.viewMode) state.viewMode = "business";
    if (!["business","personal","all"].includes(state.viewMode)) state.viewMode = "business";if(!Array.isArray(state.contexts)||state.contexts.length===0)Object.assign(state,defaultState());
state.settingsByContext=state.settingsByContext||{};state.dailyByContext=state.dailyByContext||{};state.weeklyByContext=state.weeklyByContext||{};state.kpiByContext=state.kpiByContext||{};
if(!state.activeContextId||!state.contexts.some(c=>c.id===state.activeContextId))state.activeContextId=state.contexts[0].id;
for(const c of state.contexts){state.dailyByContext[c.id]=state.dailyByContext[c.id]||{};state.weeklyByContext[c.id]=state.weeklyByContext[c.id]||{};state.kpiByContext[c.id]=state.kpiByContext[c.id]||{leadEvents:[]};if(!Array.isArray(state.kpiByContext[c.id].leadEvents))state.kpiByContext[c.id].leadEvents=[];}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function activeContext(){return state.contexts.find(c=>c.id===state.activeContextId)||state.contexts[0];}
function settings(){return state.settingsByContext[activeContext().id];}
function dailyMap(){return state.dailyByContext[activeContext().id];}
function weeklyMap(){return state.weeklyByContext[activeContext().id];}
function kpi(){return state.kpiByContext[activeContext().id];}

  function currentMode(){ return state.viewMode || "business"; }
  function modeOk(entryMode){
    const m = currentMode();
    if (m === "all") return true;
    return (entryMode || "business") === m;
  }
function wireUI(){document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>setView(b.getAttribute('data-nav'))));
$('btnNewContext').addEventListener('click',()=>{const name=prompt('Naam van nieuwe context?');if(!name)return;const t=name.trim();if(!t)return;const id='c_'+shortId();state.contexts.push({id,name:t});state.activeContextId=id;state.settingsByContext[id]={activeDays:[3,4,5],reviewDay:0,leadTargetPerCycle:0,cycleLengthDays:28,cycleAnchorISO:settings().cycleAnchorISO,workNotes:''};state.dailyByContext[id]={};state.weeklyByContext[id]={};state.kpiByContext[id]={leadEvents:[]};persist();renderAll();});
const privacyBtn=$('btnPrivacy');privacyBtn.addEventListener('click',()=>{const now=!document.body.classList.contains('privacy');document.body.classList.toggle('privacy',now);privacyBtn.setAttribute('aria-pressed',String(now));localStorage.setItem(PRIVACY_KEY,JSON.stringify(now));});
try{const p=JSON.parse(localStorage.getItem(PRIVACY_KEY)||'false');document.body.classList.toggle('privacy',!!p);privacyBtn.setAttribute('aria-pressed',String(!!p));}catch{}
menuBtn.addEventListener('click',()=>{const open=!menuPanel.hidden;menuPanel.hidden=open;menuBtn.setAttribute('aria-expanded',String(!open));});
document.addEventListener('click',e=>{if(!menuPanel.hidden&&!menuPanel.contains(e.target)&&e.target!==menuBtn)closeMenu();});
$('btnExport').addEventListener('click',exportJSON);$('fileImport').addEventListener('change',importJSON);$('btnReset').addEventListener('click',resetAll);
$('btnQuickCheckin').addEventListener('click',()=>openDaily(todayISO()));$('btnCloseDaily').addEventListener('click',closeDaily);modalDaily.addEventListener('click',e=>{if(e.target===modalDaily)closeDaily();});
$('btnCloseWeekly').addEventListener('click',closeWeekly);modalWeekly.addEventListener('click',e=>{if(e.target===modalWeekly)closeWeekly();});
document.querySelectorAll('.steptab').forEach(b=>b.addEventListener('click',()=>setDailyStep(parseInt(b.getAttribute('data-step'),10))));
$('btnPrevStep').addEventListener('click',()=>stepDelta(-1));$('btnNextStep').addEventListener('click',()=>stepDelta(1));
const es=$('energyStart'),ee=$('energyEnd');es.addEventListener('input',()=>$('energyStartVal').textContent=String(es.value));ee.addEventListener('input',()=>$('energyEndVal').textContent=String(ee.value));
const conf=$('confidence');conf.addEventListener('input',()=>$('confVal').textContent=String(conf.value));
$('dailyForm').addEventListener('submit',e=>{e.preventDefault();saveDailyFromModal();});
$('weeklyForm').addEventListener('submit',e=>{e.preventDefault();saveWeeklyFromModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDaily();closeWeekly();closeMenu();}});}
function renderAll(){renderContextTabs();renderReminders();renderToday();renderWeek();renderDashboard();renderSettings();}
function renderContextTabs(){contextTabsEl.innerHTML='';const active=activeContext().id;
for(const c of state.contexts){const badge=countActiveDaysWithActivity(c.id,currentCycleRange(c.id).startISO,todayISO());const btn=document.createElement('button');btn.className='tab';btn.type='button';btn.role='tab';btn.setAttribute('aria-selected',String(c.id===active));btn.textContent=c.name;
const b=document.createElement('span');b.className='badge';b.textContent=String(badge);btn.appendChild(b);
btn.addEventListener('click',()=>{state.activeContextId=c.id;persist();renderAll();});contextTabsEl.appendChild(btn);}}
function renderReminders(){const cid=activeContext().id;const today=todayISO();const d=dailyMap()[today];const wkKey=mondayOfThisWeekISO(today);const w=weeklyMap()[wkKey];
const isActive=settings().activeDays.includes(dayOfWeek(today));const needsCheckin=isActive&&(!d||!d.checkinDone);const needsCheckout=isActive&&(!d||!d.checkoutDone);
const needsWeekly=isReviewDue(cid);const chips=[];if(needsCheckin)chips.push('<span class="pill warn">⏱️ Check-in nog niet gedaan</span>');
if(needsCheckout)chips.push('<span class="pill warn">🧾 Check-out nog niet gedaan</span>');
if(needsWeekly)chips.push('<span class="pill warn">📅 Weekly review pending</span>');
if(chips.length===0){remindersEl.hidden=true;remindersEl.innerHTML='';return;}
remindersEl.hidden=false;remindersEl.innerHTML=`<div class="left"><div class="rt" style="font-weight:800;">In-app reminders</div><div class="rm" style="font-size:12px;color:var(--muted)">Alleen op jouw actieve dagen.</div></div><div class="chips">${chips.join('')}</div>`;}
function renderToday(){const today=todayISO();const isActive=settings().activeDays.includes(dayOfWeek(today));const d=dailyMap()[today]||null;
viewToday.innerHTML=`<div class="grid2"><div class="card"><h3>Vandaag</h3><p>${longDateNL(today)} • ${isActive?'actieve dag':'niet-actieve dag'}</p><div class="grid2"><div><div class="pill ok">Context: ${escapeHTML(activeContext().name)}</div></div><div style="text-align:right;"><button class="btn btn-primary" id="btnOpenDaily">Open Daily</button></div></div><div style="margin-top:10px;"><div class="pill">${d?.top1?'🎯 Top 1 ingesteld':'🎯 Nog geen Top 1'}</div><div class="pill">${d?.checkinDone?'✅ Check-in gedaan':'⏱️ Check-in open'}</div><div class="pill">${d?.checkoutDone?'✅ Check-out gedaan':'🧾 Check-out open'}</div></div></div><div class="card"><h3>Snel overzicht</h3><p>Alleen dagen waarop je iets invult tellen mee.</p><div class="grid2"><div class="card" style="box-shadow:none;background:rgba(255,255,255,.7)"><h3 style="margin:0 0 6px;">Energie</h3><div class="pill">Start: ${d?.energyStart??'-'}</div><div class="pill">Eind: ${d?.energyEnd??'-'}</div></div><div class="card" style="box-shadow:none;background:rgba(255,255,255,.7)"><h3 style="margin:0 0 6px;">Focus</h3><div class="pill">${d?.top1Done?'Top 1 gedaan':(d?.top1?'Top 1 niet afgevinkt':'—')}</div><div class="pill">Impact: ${escapeHTML(d?.energyImpact??'—')}</div></div></div></div></div>`;
$('btnOpenDaily').addEventListener('click',()=>openDaily(today));}
function renderWeek(){const today=todayISO();const wkKey=mondayOfThisWeekISO(today);const w=weeklyMap()[wkKey]||{};viewWeek.innerHTML=`<div class="grid2"><div class="card"><h3>Deze week</h3><p>Week start: <b>${wkKey}</b> • Review-dag: <b>${dayLabel(settings().reviewDay)}</b></p><div class="grid2"><button class="btn btn-primary" id="btnOpenWeekly">Open weekly review</button><button class="btn" id="btnAddLead">+1 leadgesprek</button></div><div style="margin-top:10px;"><div class="pill">Leadgesprekken (week): <b>${w.leadsWeek??0}</b></div><div class="pill">Confidence: <b>${w.confidence??3}</b></div></div></div><div class="card"><h3>Weekdoelen</h3><p>Top 3 (1 per regel)</p><div class="card" style="box-shadow:none;background:rgba(255,255,255,.7)"><div style="white-space:pre-wrap;color:var(--muted);font-size:13px;line-height:1.35;">${escapeHTML(w.weekTop3||'—')}</div></div></div></div>`;
$('btnOpenWeekly').addEventListener('click',()=>openWeekly(wkKey));
$('btnAddLead').addEventListener('click',()=>{addLeadEvent();weeklyMap()[wkKey]=weeklyMap()[wkKey]||{};weeklyMap()[wkKey].leadsWeek=(weeklyMap()[wkKey].leadsWeek||0)+1;persist();renderAll();});}
function renderDashboard(){const cid=activeContext().id;const s=settings();const cycle=currentCycleRange(cid);const target=s.leadTargetPerCycle||0;const leadCount=countLeadsInRange(cycle.startISO,cycle.endISO);
const activity=countActiveDaysWithActivity(cid,cycle.startISO,todayISO());const possible=countPossibleActiveDays(cid,cycle.startISO,todayISO());const avg=averageEnergy(cid,cycle.startISO,todayISO());const drains=topTimeDrains(cid,cycle.startISO,todayISO());
const expected=target>0?expectedLeadsByToday(cid):0;viewDash.innerHTML=`<div class="grid2"><div class="card"><h3>Cycle (28 dagen)</h3><p>Van <b>${longDateNL(cycle.startISO)}</b> t/m <b>${longDateNL(cycle.endISO)}</b></p><div class="grid2"><div><div class="pill">Actieve dagen met log: <b>${activity}</b> / ${possible}</div><div class="pill">Gem. energie: <b>${avg??'—'}</b></div></div><div style="text-align:right;"><button class="btn btn-primary" id="btnLeadPlus">+1 lead</button></div></div><div style="margin-top:10px;"><div class="pill ${target>0&&leadCount<expected?'warn':'ok'}">Leadgesprekken: <b>${target>0?leadCount+'/'+target:leadCount+' (geen target)'}</b> ${target>0?`(verwacht ~${expected} nu)`:''}</div></div></div><div class="card"><h3>Efficiëntie hints</h3><div id="hints"></div></div></div><div class="card" style="margin-top:12px;"><h3>Top tijdvreters</h3><div class="grid3" id="drains"></div></div>`;
$('btnLeadPlus').addEventListener('click',()=>{addLeadEvent();persist();renderAll();});
const drainsEl=$('drains');drainsEl.innerHTML='';if(drains.length===0){drainsEl.innerHTML='<div class="pill">Nog geen data.</div>';}else{for(const d of drains){const el=document.createElement('div');el.className='card';el.style.boxShadow='none';el.style.background='rgba(255,255,255,.7)';el.innerHTML=`<h3 style="margin:0 0 6px;">${escapeHTML(d.label)}</h3><div class="pill">Aantal: <b>${d.count}</b></div>`;drainsEl.appendChild(el);}}
const hintsEl=$('hints');const hints=buildHints(cid,cycle.startISO,todayISO(),target);hintsEl.innerHTML=(hints.length?hints.map(h=>`<div class="pill" style="margin-top:8px;">${escapeHTML(h)}</div>`).join(''):'<div class="pill">Nog geen hints.</div>');}
function renderSettings(){const s=settings();const active=new Set(s.activeDays||[]);viewSettings.innerHTML=`<div class="grid2"><div class="card"><h3>Actieve dagen</h3><div class="grid3" id="days"></div></div><div class="card"><h3>Ritme & KPI</h3><label class="field"><span>Review-dag</span><select id="reviewDay">${DAYS.map(d=>`<option value="${d.id}" ${d.id===(s.reviewDay??0)?'selected':''}>${d.label}</option>`).join('')}</select></label><label class="field"><span>Lead target per 4 weken</span><input id="leadTarget" type="number" min="0" step="1" value="${s.leadTargetPerCycle??0}" /></label><label class="field"><span>Cycle anchor</span><input id="cycleAnchor" type="date" value="${s.cycleAnchorISO}" /></label><label class="field"><span>Notitie (werkritme)</span><textarea id="workNotes" rows="3" maxlength="1200">${escapeHTML(s.workNotes||'')}</textarea></label><button class="btn btn-primary" id="btnSaveSettings">Opslaan</button></div></div><div class="card" style="margin-top:12px;"><h3>Notificaties</h3><p>Nu: in-app reminders (zichtbaar als je de app opent). Voor echte push-notificaties op iOS is Web Push nodig (iOS 16.4+ Home Screen web apps) en meestal een server.</p></div>`;
const daysEl=$('days');daysEl.innerHTML='';for(const d of DAYS){const lab=document.createElement('label');lab.className='checkline';lab.style.margin='6px 0';lab.innerHTML=`<input type="checkbox" data-day="${d.id}" ${active.has(d.id)?'checked':''} /><span>${d.label}</span>`;daysEl.appendChild(lab);}
$('btnSaveSettings').addEventListener('click',()=>{const newActive=[];daysEl.querySelectorAll('input[type=checkbox][data-day]').forEach(cb=>{if(cb.checked)newActive.push(parseInt(cb.getAttribute('data-day'),10));});
s.activeDays=newActive;s.reviewDay=parseInt($('reviewDay').value,10);s.leadTargetPerCycle=parseInt($('leadTarget').value||'0',10)||0;s.cycleAnchorISO=$('cycleAnchor').value||s.cycleAnchorISO;s.workNotes=$('workNotes').value||'';persist();renderAll();alert('Opgeslagen ✅');});}
function setView(key){viewToday.hidden=key!=='today';viewWeek.hidden=key!=='week';viewDash.hidden=key!=='dash';viewSettings.hidden=key!=='settings';document.querySelectorAll('.navbtn').forEach(btn=>{const a=btn.getAttribute('data-nav')===key;if(a)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});}
let currentDailyStep=1;
function openDaily(iso){const d=getOrCreateDaily(iso);$('dailyDate').value=iso;$('top1').value=d.top1||'';$('top3').value=d.top3||'';$('growth').value=d.growth||'';
$('energyStart').value=String(d.energyStart||3);$('energyStartVal').textContent=String(d.energyStart||3);$('timePlan').value=d.timePlan||'';$('energyImpact').value=d.energyImpact||'geeft';$('blocker').value=d.blocker||'';$('note').value=d.note||'';
$('top1Done').checked=!!d.top1Done;$('reflection').value=d.reflection||'';$('energyEnd').value=String(d.energyEnd||3);$('energyEndVal').textContent=String(d.energyEnd||3);$('timeDrain').value=d.timeDrain||'';$('improve').value=d.improve||'';setDailyStep(1);showModal(modalDaily);}
function closeDaily(){hideModal(modalDaily);}
function setDailyStep(step){currentDailyStep=Math.max(1,Math.min(3,step));document.querySelectorAll('.steptab').forEach(b=>b.setAttribute('aria-selected',String(parseInt(b.getAttribute('data-step'),10)===currentDailyStep)));
document.querySelectorAll('#dailyForm .step').forEach(sec=>{const s=parseInt(sec.getAttribute('data-step'),10);sec.hidden=s!==currentDailyStep;});}
function stepDelta(d){setDailyStep(currentDailyStep+d);}
function saveDailyFromModal(){const iso=$('dailyDate').value;const d=getOrCreateDaily(iso);d.top1=$('top1').value.trim();d.top3=$('top3').value.trim();d.growth=$('growth').value||'';
d.energyStart=parseInt($('energyStart').value,10)||3;d.timePlan=$('timePlan').value||'';d.energyImpact=$('energyImpact').value||'geeft';d.blocker=$('blocker').value||'';d.note=$('note').value.trim();
d.top1Done=!!$('top1Done').checked;d.reflection=$('reflection').value.trim();d.energyEnd=parseInt($('energyEnd').value,10)||3;d.timeDrain=$('timeDrain').value||'';d.improve=$('improve').value.trim();
d.checkinDone=!!(d.top1||d.top3||d.growth||d.note||d.blocker||d.timePlan||d.energyImpact);d.checkoutDone=!!(d.top1Done||d.reflection||d.energyEnd||d.timeDrain||d.improve);d.updatedAt=new Date().toISOString();
persist();closeDaily();renderAll();}
function getOrCreateDaily(iso){const m=dailyMap();if(!m[iso])m[iso]={createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};return m[iso];}
function openWeekly(wk){const w=getOrCreateWeekly(wk);$('weekKey').value=wk;$('wcInbox').checked=!!w.wcInbox;$('wcOpenLoops').checked=!!w.wcOpenLoops;$('wcProjects').checked=!!w.wcProjects;$('wcCalendar').checked=!!w.wcCalendar;
$('weekTop3').value=w.weekTop3||'';$('leadsWeek').value=w.leadsWeek??0;$('confidence').value=String(w.confidence??3);$('confVal').textContent=String(w.confidence??3);
$('energyGives').value=w.energyGives||'';$('energyCosts').value=w.energyCosts||'';$('bigDrain').value=w.bigDrain||'';$('improveType').value=w.improveType||'';$('nextStep').value=w.nextStep||'';showModal(modalWeekly);}
function closeWeekly(){hideModal(modalWeekly);}
function saveWeeklyFromModal(){const wk=$('weekKey').value;const w=getOrCreateWeekly(wk);w.wcInbox=!!$('wcInbox').checked;w.wcOpenLoops=!!$('wcOpenLoops').checked;w.wcProjects=!!$('wcProjects').checked;w.wcCalendar=!!$('wcCalendar').checked;
w.weekTop3=$('weekTop3').value.trim();w.leadsWeek=parseInt($('leadsWeek').value||'0',10)||0;w.confidence=parseInt($('confidence').value,10)||3;
w.energyGives=$('energyGives').value.trim();w.energyCosts=$('energyCosts').value.trim();w.bigDrain=$('bigDrain').value||'';w.improveType=$('improveType').value||'';w.nextStep=$('nextStep').value.trim();w.updatedAt=new Date().toISOString();
persist();closeWeekly();renderAll();}
function getOrCreateWeekly(wk){const m=weeklyMap();if(!m[wk])m[wk]={createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};return m[wk];}
function addLeadEvent(){kpi().leadEvents.push({ ts: new Date().toISOString(), mode: (currentMode()==="all" ? "business" : currentMode()) });}
function countLeadsInRange(startISO,endISO){const start=startISO+'T00:00:00',end=endISO+'T23:59:59';return kpi().leadEvents.filter(ts=>ts>=start&&ts<=end).length;}
function expectedLeadsByToday(contextId){const s=state.settingsByContext[contextId];const cycle=currentCycleRange(contextId);const total=s.leadTargetPerCycle||0;if(total<=0)return 0;const elapsed=daysBetween(cycle.startISO,todayISO())+1;const frac=Math.min(1,Math.max(0,elapsed/(s.cycleLengthDays||28)));return Math.round(total*frac);}
function dayHasActivity(d){return !!(d&&(d.checkinDone||d.checkoutDone));}
function countActiveDaysWithActivity(contextId,startISO,endISO){const s=state.settingsByContext[contextId];const map=state.dailyByContext[contextId]||{};let cnt=0;for(const iso of eachDayISO(startISO,endISO)){if(!s.activeDays.includes(dayOfWeek(iso)))continue;if(dayHasActivity(map[iso]))cnt++;}return cnt;}
function countPossibleActiveDays(contextId,startISO,endISO){const s=state.settingsByContext[contextId];let cnt=0;for(const iso of eachDayISO(startISO,endISO)){if(s.activeDays.includes(dayOfWeek(iso)))cnt++;}return cnt;}
function averageEnergy(contextId,startISO,endISO){const map=state.dailyByContext[contextId]||{};let total=0,n=0;for(const iso of eachDayISO(startISO,endISO)){const d=map[iso];if(!dayHasActivity(d))continue;const val=(d.energyEnd||d.energyStart);if(val){total+=val;n++;}}if(n===0)return null;return Math.round(total/n*10)/10;}
function topTimeDrains(contextId,startISO,endISO){const map=state.dailyByContext[contextId]||{};const counts={};for(const iso of eachDayISO(startISO,endISO)){const d=map[iso];if(!dayHasActivity(d)||!d.timeDrain)continue;counts[d.timeDrain]=(counts[d.timeDrain]||0)+1;}
const labels={mail:'Mail/DM',meetings:'Overleg/meetings',admin:'Admin/boekhouding',zoeken:'Zoeken/uitzoeken',contextswitch:'Context-switching',anders:'Anders'};
return Object.entries(counts).map(([k,v])=>({key:k,count:v,label:labels[k]||k})).sort((a,b)=>b.count-a.count).slice(0,5);}
function buildHints(contextId,startISO,endISO,leadTarget){const hints=[];const drains=topTimeDrains(contextId,startISO,endISO);if(drains.length)hints.push(`Grootste tijdvreter: ${drains[0].label}. Overweeg: standaardiseren of tijdblokken.`);
const avg=averageEnergy(contextId,startISO,endISO);if(avg!==null&&avg<=2.5)hints.push('Gemiddelde energie is laag. Splits taken en plan energiekostende taken slimmer.');
if(leadTarget&&leadTarget>0){const expected=expectedLeadsByToday(contextId);const cycle=currentCycleRange(contextId);const actual=countLeadsInRange(cycle.startISO,cycle.endISO);if(actual<expected)hints.push('Leads lopen achter. Plan 2–3 outreach blocks op jouw vaste werkdagen (Do/Vr).');}
return hints.slice(0,5);}
function isReviewDue(contextId){const s=state.settingsByContext[contextId];const today=todayISO();const wk=mondayOfThisWeekISO(today);const w=(state.weeklyByContext[contextId]||{})[wk];const dow=dayOfWeek(today);const order=[1,2,3,4,5,6,0];return order.indexOf(dow)>=order.indexOf(s.reviewDay??0) && (!w||!w.updatedAt);}
function currentCycleRange(contextId){const s=state.settingsByContext[contextId];const anchor=s.cycleAnchorISO;const len=s.cycleLengthDays||28;const today=todayISO();const diff=daysBetween(anchor,today);const cycles=diff>=0?Math.floor(diff/len):Math.floor((diff-(len-1))/len);const start=addDaysISO(anchor,cycles*len);const end=addDaysISO(start,len-1);return{startISO:start,endISO:end};}
function exportJSON(){const payload={exportedAt:new Date().toISOString(),version:1,data:state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`compass_review_export_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);closeMenu();}
async function importJSON(e){const file=e.target.files&&e.target.files[0];if(!file)return;try{const text=await file.text();const payload=JSON.parse(text);const incoming=payload.data?payload.data:payload;const ok=confirm('Importeren overschrijft alles. Doorgaan?');if(!ok)return;Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,incoming);ensureShape();persist();renderAll();alert('Import klaar ✅');}catch(err){alert('Import mislukt.\n\n'+err.message);}finally{e.target.value='';closeMenu();}}
function resetAll(){const ok=confirm('Alles wissen?');if(!ok)return;const fresh=defaultState();Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,fresh);persist();renderAll();closeMenu();}
function closeMenu(){menuPanel.hidden=true;menuBtn.setAttribute('aria-expanded','false');}
function showModal(el){el.hidden=false;el.removeAttribute('hidden');document.body.style.overflow='hidden';}
function hideModal(el){if(!el||el.hidden)return;el.hidden=true;el.setAttribute('hidden','');document.body.style.overflow='';}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function dayOfWeek(iso){return new Date(iso+'T00:00:00').getDay();}
function addDaysISO(iso,days){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function daysBetween(a,b){return Math.floor((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/(1000*60*60*24));}
function eachDayISO(start,end){const out=[];let cur=start;while(cur<=end){out.push(cur);cur=addDaysISO(cur,1);}return out;}
function mondayOfThisWeekISO(iso){const dow=dayOfWeek(iso);const d=(dow===0)?7:dow;return addDaysISO(iso,-(d-1));}
function longDateNL(iso){try{return new Date(iso+'T00:00:00').toLocaleDateString('nl-NL',{weekday:'long',year:'numeric',month:'long',day:'numeric'});}catch{return iso;}}
function dayLabel(dow){const f=DAYS.find(d=>d.id===dow);return f?f.label:String(dow);}
function shortId(){return (Math.random().toString(16).slice(2,10)+Date.now().toString(16).slice(-4));}
function escapeHTML(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
})();