// ===== Config =====
const CATEGORIES = [
  { id:"culture", title:"Culture", target:2 },
  { id:"courtesy", title:"Courtesy", target:2 },
  { id:"daily_ops", title:"Daily Ops", target:2 },
  { id:"product_knowledge", title:"Product Knowledge", target:4 },
  { id:"ha", title:"哈", target:4 },
  { id:"haha", title:"哈哈", target:6 },
  { id:"hahaha", title:"哈哈哈", target:6 },
  { id:"hahahaha", title:"哈哈哈哈", target:8 },
  { id:"hahahahaha", title:"哈哈哈哈哈", target:10 },
  { id:"hahahahahaha", title:"哈哈哈哈哈哈", target:12 }
];

const QUESTIONS_PER_CATEGORY = 7;

// ===== Storage helpers =====
const LS_KEY = "pg_booklet_v1";

function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return {
    store: "",
    name: "",
    progress: {} // { [catId]: {count, lastWeekKey, answers:[0/1]} }
  };
  try { return JSON.parse(raw); } catch { return {store:"", name:"", progress:{}}; }
}
function saveState(state){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function ensureCatState(state, catId){
  if(!state.progress[catId]){
    state.progress[catId] = {
      count: 0,
      lastWeekKey: null,
      answers: Array(QUESTIONS_PER_CATEGORY).fill(null) // null/ "understood"/"notyet"
    };
  } else {
    // ensure answers length
    if(!Array.isArray(state.progress[catId].answers)) state.progress[catId].answers = [];
    if(state.progress[catId].answers.length !== QUESTIONS_PER_CATEGORY){
      const old = state.progress[catId].answers.slice(0, QUESTIONS_PER_CATEGORY);
      while(old.length < QUESTIONS_PER_CATEGORY) old.push(null);
      state.progress[catId].answers = old;
    }
  }
}

// ===== Date / week helpers (Mon–Sun) =====
function formatMMDDYYYY(d){
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Returns a stable "week key" like "2026-W06" based on ISO week (Mon–Sun)
function getISOWeekKey(date = new Date()){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // set to nearest Thursday
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2,"0")}`;
}

// ===== Unlock logic =====
function isCleared(state, cat){
  ensureCatState(state, cat.id);
  return state.progress[cat.id].count >= cat.target;
}

function getUnlockedCount(state){
  // first is always available
  let unlocked = 1;
  for(let i=0; i<CATEGORIES.length-1; i++){
    if(isCleared(state, CATEGORIES[i])) unlocked = i+2;
    else break;
  }
  return Math.min(unlocked, CATEGORIES.length);
}

function getVisibleCategories(state){
  const unlockedCount = getUnlockedCount(state); // number of unlocked categories
  const unlocked = CATEGORIES.slice(0, unlockedCount);
  const next = CATEGORIES[unlockedCount]; // may be undefined if all unlocked
  return { unlocked, next };
}

// ===== Router / Views =====
const viewEl = document.getElementById("view");
document.getElementById("today").textContent = `Date: ${formatMMDDYYYY(new Date())}`;

function nav(hash){ location.hash = hash; }

window.addEventListener("hashchange", render);
window.addEventListener("load", () => {
  if(!location.hash) location.hash = "#/home";
  render();
});

function render(){
  const hash = location.hash || "#/home";
  const parts = hash.replace(/^#\//,"").split("/");
  const route = parts[0];

  if(route === "home") renderHome();
  else if(route === "cat") renderCategory(parts[1]);
  else renderHome();
}

function renderHome(){
  const state = loadState();

  const { unlocked, next } = getVisibleCategories(state);

  viewEl.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <label>Store</label>
          <input id="storeInput" placeholder="Enter store name" value="${escapeHtml(state.store)}" />
        </div>
      </div>
      <div style="height:10px"></div>
      <div class="row">
        <div>
          <label>Name</label>
          <input id="nameInput" placeholder="Enter your name" value="${escapeHtml(state.name)}" />
        </div>
      </div>
     
    </div>

    <div class="card">
      <div class="grid2">
        <div style="font-weight:700">Categories</div>
        <div style="font-weight:700">Progress</div>
      </div>
      <div class="list" id="catList"></div>
    </div>
  `;

  document.getElementById("storeInput").addEventListener("input", (e) => {
    state.store = e.target.value;
    saveState(state);
  });
  document.getElementById("nameInput").addEventListener("input", (e) => {
    state.name = e.target.value;
    saveState(state);
  });

  const catList = document.getElementById("catList");

  function addItem(cat, locked){
    ensureCatState(state, cat.id);
    const x = state.progress[cat.id].count;
    const y = cat.target;
    const href = locked ? "" : `#/cat/${cat.id}`;
    const row = document.createElement("div");
    row.className = `item ${locked ? "locked":""}`;
    row.innerHTML = `
      <div>
        ${locked ? `<div style="font-weight:600">${escapeHtml(cat.title)} 🔒</div>` :
          `<a href="${href}">${escapeHtml(cat.title)}</a>`}
        <div class="small">${locked ? "Locked" : "Unlocked"}</div>
      </div>
      <div class="badge">${x}/${y}</div>
    `;
    catList.appendChild(row);
  }

  // show all unlocked
  unlocked.forEach(cat => addItem(cat, false));
  // show only the immediate next locked (if exists)
  if(next) addItem(next, true);
}

function renderCategory(catId){
  const state = loadState();

  // Only allow entering if cat is unlocked
  const unlockedCount = getUnlockedCount(state);
  const idx = CATEGORIES.findIndex(c => c.id === catId);
  if(idx === -1){ nav("#/home"); return; }
  if(idx >= unlockedCount){ nav("#/home"); return; }

  const cat = CATEGORIES[idx];
  ensureCatState(state, cat.id);

  const catState = state.progress[cat.id];
  const weekKey = getISOWeekKey(new Date());
  const alreadyCompletedThisWeek = (catState.lastWeekKey === weekKey);

  const x = catState.count;
  const y = cat.target;

  viewEl.innerHTML = `
    <a class="link" href="#/home">← Back</a>
    <div style="height:12px"></div>

    <div class="card">
      <div style="font-weight:800; font-size:18px">${escapeHtml(cat.title)}</div>
      <div class="small" style="margin-top:6px">Progress: <b>${x}/${y}</b> · Week: ${weekKey}${alreadyCompletedThisWeek ? " · Completed this week" : ""}</div>
    </div>

    <div class="card" id="qWrap"></div>

    <button class="btn" id="completeBtn" disabled>Complete this week</button>
    <div style="height:10px"></div>
    <div class="small" id="hint"></div>
  `;

  const qWrap = document.getElementById("qWrap");

  // render 7 questions
  for(let i=0; i<QUESTIONS_PER_CATEGORY; i++){
    const qEl = document.createElement("div");
    qEl.className = "q";
    const a = catState.answers[i];

    qEl.innerHTML = `
      <div class="q-title">Q${i+1}</div>
      <div class="choices">
        <div class="choice ${a==="understood"?"active":""}" data-i="${i}" data-v="understood">Got it</div>
        <div class="choice ${a==="notyet"?"active":""}" data-i="${i}" data-v="notyet">Not fully clear</div>
      </div>
    `;
    qWrap.appendChild(qEl);
  }

  qWrap.addEventListener("click", (e) => {
    const t = e.target;
    if(!t.classList.contains("choice")) return;
    const i = Number(t.getAttribute("data-i"));
    const v = t.getAttribute("data-v");

    catState.answers[i] = v;
    state.progress[cat.id] = catState;
    saveState(state);

    // re-render only active states (simple: full rerender category)
    renderCategory(catId);
  });

  const completeBtn = document.getElementById("completeBtn");
  const hint = document.getElementById("hint");

  // Enable rule: all 7 must be "understood"
  const allUnderstood = catState.answers.every(v => v === "understood");
  completeBtn.disabled = !allUnderstood;

  if(!allUnderstood){
    hint.textContent = "Complete is locked until all answers are “懂了”.";
  } else if(alreadyCompletedThisWeek){
    hint.textContent = "You already completed this category this week. Completing again won’t increase progress.";
  } else {
    hint.textContent = "Ready to complete for this week.";
  }

  completeBtn.addEventListener("click", () => {
    // Hard lock already handled via disabled, but keep safe:
    if(!catState.answers.every(v => v === "understood")) return;

    if(catState.lastWeekKey !== weekKey){
      catState.count += 1;
      catState.lastWeekKey = weekKey;
      state.progress[cat.id] = catState;
      saveState(state);
    }
    // After completion, if this cleared target, home will show next locked/unlocked accordingly
    nav("#/home");
  });
}

// ===== tiny helper to avoid HTML injection =====
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
