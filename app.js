const DATA_URL = "./data/staffing.json";
const STORAGE_KEY = "staffing_whiteboard_layout_v1";

const elTitle = document.getElementById("title");
const elShift = document.getElementById("shift");
const elUpdated = document.getElementById("updated");
const elGrid = document.getElementById("grid");
const elKpis = document.getElementById("kpis");
const elSearch = document.getElementById("search");
const elReset = document.getElementById("resetBtn");

let baseData = null;
let layout = {}; // { associateId: areaId }

function norm(s){ return (s||"").toString().toLowerCase().trim(); }

function loadLayout(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveLayout(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
function effectiveAreaFor(assoc){
  return layout[assoc.id] || assoc.homeArea;
}

function matchesFilters(assoc){
  const q = norm(elSearch.value);
  if (!q) return true;

  const hay = [
    assoc.name,
    assoc.role,
    assoc.status,
    ...(assoc.badges || [])
  ].map(norm).join(" ");

  return hay.includes(q);
}

/** Badge classification based on label text */
function badgeClass(label){
  const b = norm(label);

  // Leadership
  if (b.includes("pg") || b.includes("pa") || b.includes("am") || b.includes("problem solver") || b === "ps") {
    return "leadership";
  }

  // Certs
  if (b.includes("pit") || b.includes("tdr") || b.includes("hazmat") || b.includes("amnesty") || b.includes("safety")) {
    return "cert";
  }

  // Flags
  if (b.includes("no ") || b.includes("restrict") || b.includes("light duty") || b.includes("accom")) {
    return "flag";
  }

  // Skills / functions
  return "skill";
}

function computeCounts(data){
  const counts = {};
  for (const area of data.areas) counts[area.id] = 0;

  for (const a of data.associates){
    if (!matchesFilters(a)) continue;
    const areaId = effectiveAreaFor(a);
    if (counts[areaId] != null) counts[areaId]++;
  }
  return counts;
}

function renderKpis(data){
  const total = data.associates.filter(matchesFilters).length;
  const counts = computeCounts(data);

  const kpiItems = [
    { label: "Total", value: total },
    { label: "Pick PG", value: counts["pick_pg"] || 0 },
    { label: "Stow PG", value: counts["stow_pg"] || 0 },
    { label: "Problem Solver", value: counts["problem_solve"] || 0 },
    { label: "To Pick", value: counts["to_pick"] || 0 },
    { label: "To Stow", value: counts["to_stow"] || 0 },
    { label: "Pick Transport", value: counts["pick_transporter"] || 0 },
    { label: "Stow Transport", value: counts["stow_transporter"] || 0 }
  ];

  elKpis.innerHTML = kpiItems.map(k => `
    <div class="kpi">
      <div class="label">${k.label}</div>
      <div class="value">${k.value}</div>
    </div>
  `).join("");
}

function cardHTML(a){
  const badges = (a.badges || []).map(label => {
    const cls = badgeClass(label);
    return `<span class="badge ${cls}">${label}</span>`;
  }).join("");

  return `
    <div class="card" draggable="true" data-assoc="${a.id}">
      <div class="row">
        <div>
          <div class="name">${a.name}</div>
          <div class="role">${a.role || ""}</div>
        </div>
        <div class="status">${a.status || "Off"}</div>
      </div>
      <div class="badges">${badges}</div>
    </div>
  `;
}

function render(data){
  elTitle.textContent = data.siteTitle || "Staffing Whiteboard";
  elShift.textContent = data.shiftLabel || "";
  elUpdated.textContent = data.lastUpdated ? `Last updated: ${data.lastUpdated}` : "";

  renderKpis(data);

  const counts = computeCounts(data);

  elGrid.innerHTML = data.areas.map(area => `
    <section class="column" data-area="${area.id}">
      <div class="colHeader">
        <div class="colTitle">${area.name}</div>
        <div class="colCount">${counts[area.id] || 0}</div>
      </div>
      <div class="dropzone" data-area="${area.id}"></div>
    </section>
  `).join("");

  for (const assoc of data.associates){
    if (!matchesFilters(assoc)) continue;
    const areaId = effectiveAreaFor(assoc);
    const zone = elGrid.querySelector(`.dropzone[data-area="${areaId}"]`);
    if (zone) zone.insertAdjacentHTML("beforeend", cardHTML(assoc));
  }

  wireDnD();
}

function wireDnD(){
  elGrid.querySelectorAll(".card[draggable='true']").forEach(card => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.assoc);
      e.dataTransfer.effectAllowed = "move";
    });
  });

  elGrid.querySelectorAll(".dropzone").forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
      e.dataTransfer.dropEffect = "move";
    });

    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");

      const assocId = e.dataTransfer.getData("text/plain");
      const areaId = zone.dataset.area;
      if (!assocId || !areaId) return;

      layout[assocId] = areaId;
      saveLayout();
      render(baseData);
    });
  });
}

function resetLayout(){
  layout = {};
  saveLayout();
  render(baseData);
}

async function loadFromUrl(){
  const res = await fetch(DATA_URL, { cache: "no-store" });
  baseData = await res.json();
  layout = loadLayout();
  render(baseData);
}

elSearch.addEventListener("input", () => baseData && render(baseData));
elReset.addEventListener("click", resetLayout);

loadFromUrl().catch(err => {
  elGrid.innerHTML = `<div style="padding:18px;color:#64748b">Failed to load: ${err}</div>`;
});
