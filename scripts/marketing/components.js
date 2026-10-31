// Small DOM helpers shared by the marketing pages. Content comes from data.js.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isArabic = (s) => /[؀-ۿ]/.test(s);
const bdi = (s) => `<bdi${isArabic(s) ? ' class="ar" dir="rtl"' : ""}>${esc(s)}</bdi>`;
const param = (name, fallback) => new URLSearchParams(location.search).get(name) || fallback;

/** Editor text with underlined findings. */
function editorHTML(lang) {
  return Z[lang].text.map((seg) => (typeof seg === "string" ? esc(seg) : `<span class="${seg.k}">${esc(seg.t)}</span>`)).join("");
}

/** Finding card; `full` adds examples and lesson links. */
function cardHTML(lang, id, { full = true, dark = false, examples: maxEx = 9, lessons: maxLe = 9 } = {}) {
  const f = Z[lang].findings[id];
  const label = { error: "Error", warning: "Warning", orthography: "Spelling" }[f.severity];
  const fixes = f.fixes.map((x) => `<span class="fix">${bdi(x.t)}<small>/${esc(x.ipa)}/</small></span>`).join("");
  const examples = full
    ? `<div class="examples">${f.examples.slice(0, maxEx)
        .map(([w, r]) => `<div><span class="x">✗</span>${bdi(w)}<span class="ok">✓</span>${bdi(r)}</div>`)
        .join("")}</div>`
    : "";
  const lessons = full ? `<div class="lessons">${f.lessons.slice(0, maxLe).map((l) => `<span class="lesson">📖 ${esc(l)}</span>`).join("")}</div>` : "";
  const why = f.why.replace(/[؀-ۿ][؀-ۿ\s]*[؀-ۿ]|[؀-ۿ]/g, (m) => `<bdi class="ar" dir="rtl">${m}</bdi>`);
  return `<div class="card${dark ? " dark" : ""}">
    <div class="head"><span class="badge ${f.severity}">${label}</span><span class="rule">${esc(f.rule)}</span></div>
    <div class="msg">${f.msg.replace(/[؀-ۿ-]+/g, (m) => (isArabic(m) ? `<bdi class="ar">${m}</bdi>` : m))}</div>
    <div class="why">${why}</div>
    <div class="fixes">${fixes}</div>${examples}${lessons}
  </div>`;
}

function brandHTML({ logo = 96, name = 64, kurdish = true } = {}) {
  return `<div class="brand" style="--logo:${logo}px;--name:${name}px">
    <img src="../../assets/icons/png/logo-512.png" alt="">
    <div class="name">Zimanyar${kurdish ? "<small>زمانیار</small>" : ""}</div>
  </div>`;
}

function chipsHTML(lang, n = 4) {
  const c = Z.copy[lang];
  return `<div class="chips"${lang === "ckb" ? ' dir="rtl"' : ""}>${c.chips
    .slice(0, n)
    .map((t, i) => `<span class="chip"${lang === "ckb" ? ' lang="ckb"' : ""}><i style="background:${Z.chipColours[i]}"></i>${esc(t)}</span>`)
    .join("")}</div>`;
}

function browserHTML(lang, { width = 720, dark = false } = {}) {
  const rtl = lang === "ckb";
  return `<div class="window${dark ? " dark" : ""}" style="width:${width}px">
    <div class="titlebar"><div class="lights"><span></span><span></span><span></span></div>
      <div class="url">${esc(Z[lang].url)}</div><img class="ext" src="../../assets/icons/extension/icon-48.png" alt=""></div>
    <div class="editor"${rtl ? ' dir="rtl" lang="ckb"' : ""}>${editorHTML(lang)}</div>
  </div>`;
}
