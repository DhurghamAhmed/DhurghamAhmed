// Draws every image the profile README shows, as animated SVG, into assets/.
//
//   node scripts/build.mjs            redraw from the content below
//   node scripts/build.mjs --refresh  first recount the languages with `gh`
//
// Each image is drawn twice — *-dark.svg and *-light.svg, in GitHub's own
// colours — and the README picks one with <picture>, so it follows the reader's
// GitHub theme. The text is real SVG text in the reader's system fonts: sharp at
// any zoom, nothing to load. Every animation is CSS inside the SVG and stops for
// readers who ask for reduced motion.
//
// To change what the profile says, edit the content section and run this again.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets");
const icons = JSON.parse(readFileSync(join(here, "icons.json"), "utf8"));

/* ── Content ─────────────────────────────────────────────────────── */

const NAME = "Dhurgham Ahmed";
const STATUS = "AVAILABLE FOR NEW PROJECTS";
const ROLES = ["Full-Stack Developer", "Web Designer", "Ethical Hacker", "Linux Power User"];
const TAGLINE = ["I build production web platforms, mobile apps", "and the servers behind them."];
const SITE = "idisr.com";

/** What I do, and how far along I rate myself in each — out of 100. */
const EXPERTISE = [
  ["Software", 90],
  ["Design", 95],
  ["Mobile Apps", 93],
  ["Systems", 85],
  ["Servers", 90],
  ["Databases", 99],
];

/** How many languages the languages card lists, largest first. */
const LANGUAGES_SHOWN = 6;
/** What GitHub calls a language, where the card should call it something else. */
const LANGUAGE_NAME = { PLpgSQL: "SQL" };

// Six to a card: two columns of three.
const STACK = [
  {
    file: "stack-web",
    title: "WEB",
    accent: "blue",
    items: [
      ["nextdotjs", "Next.js"],
      ["react", "React"],
      ["typescript", "TypeScript"],
      ["tailwindcss", "Tailwind CSS"],
      ["nodedotjs", "Node.js"],
      ["wordpress", "WordPress"],
    ],
  },
  {
    file: "stack-apps",
    title: "MOBILE & DESKTOP",
    accent: "purple",
    items: [
      ["flutter", "Flutter"],
      ["dart", "Dart"],
      ["swift", "Swift"],
      ["android", "Android"],
      ["apple", "iOS & macOS"],
      ["appstore", "App Store"],
    ],
  },
  {
    file: "stack-backend",
    title: "BACKEND & SYSTEMS",
    accent: "green",
    items: [
      ["go", "Go"],
      ["python", "Python"],
      ["postgresql", "PostgreSQL"],
      ["linux", "Linux"],
      ["nginx", "nginx"],
      ["gnubash", "Bash"],
    ],
  },
  {
    file: "stack-tools",
    title: "TOOLS & CLOUD",
    accent: "orange",
    items: [
      ["git", "Git"],
      ["github", "GitHub"],
      ["docker", "Docker"],
      ["cloudflare", "Cloudflare"],
      ["netlify", "Netlify"],
      ["figma", "Figma"],
    ],
  },
];

const LINKS = [
  { file: "link-website", icon: "globe", label: "idisr.com" },
  { file: "link-youtube", icon: "youtube", label: "YouTube" },
  { file: "link-instagram", icon: "instagram", label: "Instagram" },
  { file: "link-tiktok", icon: "tiktok", label: "TikTok" },
  { file: "link-snapchat", icon: "snapchat", label: "Snapchat" },
  { file: "link-facebook", icon: "facebook", label: "Facebook" },
];

/* ── Design ──────────────────────────────────────────────────────── */

// GitHub's own colours (Primer), dark and light, and its contribution greens.
const THEMES = {
  dark: {
    canvas: "#0d1117",
    card: "#161b22",
    border: "#30363d",
    track: "#21262d",
    fg: "#e6edf3",
    muted: "#8d96a0",
    green: "#3fb950",
    blue: "#58a6ff",
    purple: "#a371f7",
    orange: "#f0883e",
    button: "#21262d",
    cells: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
  light: {
    canvas: "#ffffff",
    card: "#f6f8fa",
    border: "#d0d7de",
    track: "#e1e6eb",
    fg: "#1f2328",
    muted: "#59636e",
    green: "#1a7f37",
    blue: "#0969da",
    purple: "#8250df",
    orange: "#bc4c00",
    button: "#f6f8fa",
    cells: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
};

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
const MONO = `ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;

/** The README's column is 846px; two cards and the space between them fit in it. */
const HERO_W = 846;
const HERO_H = 300;
const CARD_W = 408;

const esc = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (value) => Number(value.toFixed(2));

const svg = (width, height, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label).replace(/"/g, "&quot;")}">\n${body}\n</svg>\n`;

/** Stops everything that moves, and leaves it where it reads best. */
const STILL = (rules = "") => `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } ${rules} }`;

/** A surface with a hairline just inside its edge. */
const panel = (fill, border, width, height, radius) =>
  `<rect width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>` +
  `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius - 0.5}" fill="none" stroke="${border}"/>`;

/**
 * A short stroke of light that travels round a card's edge.
 *
 * It is the card's own border drawn again as one dash: the dash is `length`
 * long, the gap is the rest of the way round, and the offset is animated
 * through exactly one lap, so the loop has no seam.
 */
function beam(width, height, radius, stroke, { length = 120, seconds = 7, delay = 0, id = "beam" } = {}) {
  const r = radius - 0.5;
  const lap = n(2 * (width - 1 + height - 1) - 8 * r + 2 * Math.PI * r);
  return {
    css: `.${id} { stroke-dasharray: ${length} ${n(lap - length)}; animation: ${id} ${seconds}s linear ${delay}s infinite; }
  @keyframes ${id} { to { stroke-dashoffset: -${lap}; } }`,
    mark: `<rect class="${id}" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${r}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/>`,
  };
}

/** A brand mark from Simple Icons (drawn on a 24px grid), at `size`. */
function icon(name, x, y, size, color, opacity = 1) {
  const at = `transform="translate(${n(x)} ${n(y)}) scale(${(size / 24).toFixed(4)})"`;
  if (name === "globe") {
    return `<g ${at} fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></g>`;
  }
  if (!icons[name]) throw new Error(`No icon named ${name} in scripts/icons.json`);
  return `<path ${at} fill="${color}" fill-opacity="${opacity}" d="${icons[name]}"/>`;
}

/** The same "random" numbers on every run, so a rebuild changes nothing it did not mean to. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── The banner ──────────────────────────────────────────────────── */

/**
 * The roles, typed and deleted one after another.
 *
 * Every role sits at the same place, and one cover the colour of the banner
 * slides off it a character at a time, with the caret on its leading edge.
 * `textLength` pins each role to a whole number of character cells, so the
 * steps land between letters whatever monospace font the reader has. The
 * cover is clipped to the line it hides, so it never slides over the wall.
 */
function typing(t, x, baseline, size) {
  const cell = n(size * 0.6);
  const type = 0.075; // seconds a character
  const erase = 0.035;
  const hold = 1.7;
  const rest = 0.4;

  let clock = 0;
  const spans = ROLES.map((role) => {
    const span = { role, start: clock, typed: clock + role.length * type };
    span.erase = span.typed + hold;
    span.end = span.erase + role.length * erase;
    clock = span.end + rest;
    return span;
  });
  const total = clock;
  const at = (seconds) => `${n((seconds / total) * 100)}%`;

  const slide = spans
    .map(
      (s) =>
        `${at(s.start)} { transform: translateX(0); animation-timing-function: steps(${s.role.length}); }
    ${at(s.typed)} { transform: translateX(${n(s.role.length * cell)}px); animation-timing-function: linear; }
    ${at(s.erase)} { transform: translateX(${n(s.role.length * cell)}px); animation-timing-function: steps(${s.role.length}); }
    ${at(s.end)} { transform: translateX(0); animation-timing-function: linear; }`,
    )
    .join("\n    ");
  const shows = spans
    .map((s, i) => `@keyframes role${i} { 0% { opacity: 0; } ${at(s.start)} { opacity: 1; } ${at(s.end)} { opacity: 0; } 100% { opacity: 0; } }`)
    .join("\n  ");
  const longest = Math.max(...ROLES.map((role) => role.length));

  return {
    // At rest — where nothing animates — the first role stands typed out.
    css: `.role { opacity: 0; animation: ${n(total)}s step-end infinite; }
  ${spans.map((_, i) => `.role${i} { animation-name: role${i}; }`).join("\n  ")}
  .role0 { opacity: 1; }
  ${shows}
  .cover { transform: translateX(${n(ROLES[0].length * cell)}px); animation: slide ${n(total)}s infinite; }
  @keyframes slide {
    ${slide}
    100% { transform: translateX(0); }
  }
  .caret { animation: blink 0.9s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }`,
    still: `.caret { opacity: 0; }`,
    mark: `${spans
      .map(
        (s, i) =>
          `<text class="role role${i}" x="${x}" y="${baseline}" font-family="${MONO}" font-size="${size}" fill="${t.fg}" textLength="${n(s.role.length * cell)}" lengthAdjust="spacing">${esc(s.role)}</text>`,
      )
      .join("\n")}
<clipPath id="line"><rect x="${x}" y="${n(baseline - size)}" width="${n(longest * cell + 24)}" height="${n(size * 1.45)}"/></clipPath>
<g clip-path="url(#line)"><g class="cover"><rect x="${x}" y="${n(baseline - size)}" width="${n(longest * cell + 24)}" height="${n(size * 1.45)}" fill="${t.canvas}"/><rect class="caret" x="${x + 1}" y="${n(baseline - size * 0.82)}" width="${n(cell * 0.72)}" height="${size}" rx="1.5" fill="${t.green}"/></g></g>`,
  };
}

/**
 * A wall of contribution squares behind the photo, a few of them breathing.
 * Faded out towards the text, so it reads as light from behind the picture.
 */
function contributions(t, focus) {
  const random = seeded(20261002);
  const step = 15;
  const size = 11;
  const cells = [];
  for (let x = 432; x < HERO_W; x += step) {
    for (let y = 6; y < HERO_H - 6; y += step) {
      const roll = random();
      const level = roll < 0.5 ? 0 : roll < 0.7 ? 1 : roll < 0.84 ? 2 : roll < 0.94 ? 3 : 4;
      // One in five of the lit ones breathes, on one of six out-of-step clocks.
      const breathes = level > 0 && random() < 0.22 ? ` class="lit lit${Math.floor(random() * 6)}"` : "";
      cells.push(`<rect${breathes} x="${x}" y="${y}" width="${size}" height="${size}" rx="2.5" fill="${t.cells[level]}"/>`);
    }
  }
  return {
    css: `.lit { animation: breathe 4s ease-in-out infinite; }
  ${[0, 1, 2, 3, 4, 5].map((i) => `.lit${i} { animation-delay: -${n(i * 0.67)}s; animation-duration: ${n(3.2 + i * 0.5)}s; }`).join("\n  ")}
  @keyframes breathe { 50% { opacity: 0.2; } }`,
    defs: `<radialGradient id="wall" cx="${focus.x}" cy="${focus.y}" r="300" gradientUnits="userSpaceOnUse"><stop offset="0.2" stop-color="#fff" stop-opacity="0.8"/><stop offset="0.62" stop-color="#fff" stop-opacity="0.26"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="wall-fade"><rect width="${HERO_W}" height="${HERO_H}" fill="url(#wall)"/></mask>`,
    mark: `<g mask="url(#wall-fade)">${cells.join("")}</g>`,
  };
}

function hero(t, theme) {
  const avatar = readFileSync(join(here, "avatar.jpg")).toString("base64");
  const photo = { x: 694, y: 126, r: 82 };
  const radius = 14;
  const wall = contributions(t, photo);
  const roles = typing(t, 71, 211, 19);
  const light = beam(HERO_W, HERO_H, radius, "url(#brand)", { length: 260, seconds: 9, id: "edge" });

  return svg(
    HERO_W,
    HERO_H,
    `${NAME} — ${ROLES.join(", ")}. ${TAGLINE.join(" ")} ${SITE}`,
    `<defs>
  <clipPath id="frame"><rect width="${HERO_W}" height="${HERO_H}" rx="${radius}"/></clipPath>
  <clipPath id="photo"><circle cx="${photo.x}" cy="${photo.y}" r="${photo.r}"/></clipPath>
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.green}"/><stop offset="0.5" stop-color="${t.blue}"/><stop offset="1" stop-color="${t.purple}"/></linearGradient>
  <radialGradient id="glow" cx="${photo.x}" cy="${photo.y}" r="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.green}" stop-opacity="${theme === "dark" ? 0.3 : 0.22}"/><stop offset="0.55" stop-color="${t.purple}" stop-opacity="${theme === "dark" ? 0.12 : 0.08}"/><stop offset="1" stop-color="${t.purple}" stop-opacity="0"/></radialGradient>
  ${wall.defs}
</defs>
<style>
  ${wall.css}
  ${roles.css}
  ${light.css}
  .pulse { transform-origin: 65px 55px; animation: pulse 2s ease-out infinite; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(3.2); opacity: 0; } }
  .ring { transform-origin: ${photo.x}px ${photo.y}px; animation: turn 8s linear infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }
  .glow { transform-origin: ${photo.x}px ${photo.y}px; animation: swell 5s ease-in-out infinite; }
  @keyframes swell { 50% { transform: scale(1.18); opacity: 0.7; } }
  .rise { animation: rise 0.8s ease-out backwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  ${STILL(`${roles.still} .pulse { opacity: 0; }`)}
</style>
${panel(t.canvas, t.border, HERO_W, HERO_H, radius)}
<g clip-path="url(#frame)">
  ${wall.mark}
  <circle class="glow" cx="${photo.x}" cy="${photo.y}" r="200" fill="url(#glow)"/>
</g>
${light.mark}

<g class="rise">
  <rect x="48.5" y="40.5" width="236" height="29" rx="14.5" fill="${t.card}" stroke="${t.border}"/>
  <circle class="pulse" cx="65" cy="55" r="3.5" fill="${t.green}"/>
  <circle cx="65" cy="55" r="3.5" fill="${t.green}"/>
  <text x="78" y="59" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${t.fg}" fill-opacity="0.86">${esc(STATUS)}</text>
</g>

<text class="rise" style="animation-delay:0.15s" x="48" y="114" font-family="${MONO}" font-size="15" fill="${t.muted}"><tspan fill="${t.green}">➜</tspan> <tspan fill="${t.blue}">~</tspan> whoami</text>
<!-- The name stands still: no entrance, no shimmer. -->
<text x="46" y="170" font-family="${SANS}" font-size="52" font-weight="700" letter-spacing="-1.4" fill="${t.fg}">${esc(NAME)}</text>
<text x="48" y="211" font-family="${MONO}" font-size="19" fill="${t.green}">&gt;</text>
${roles.mark}
<g class="rise" style="animation-delay:0.5s">
${TAGLINE.map((line, i) => `  <text x="48" y="${246 + i * 21}" font-family="${SANS}" font-size="14.5" fill="${t.muted}">${esc(line)}</text>`).join("\n")}
</g>

<circle cx="${photo.x}" cy="${photo.y}" r="${photo.r + 13}" fill="${t.canvas}"/>
<circle class="ring" cx="${photo.x}" cy="${photo.y}" r="${photo.r + 8}" fill="none" stroke="url(#brand)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${n(Math.PI * (photo.r + 8) * 0.62)} ${n(Math.PI * (photo.r + 8) * 0.38)}"/>
<image href="data:image/jpeg;base64,${avatar}" x="${photo.x - photo.r}" y="${photo.y - photo.r}" width="${photo.r * 2}" height="${photo.r * 2}" clip-path="url(#photo)" preserveAspectRatio="xMidYMid slice"/>

<rect x="${photo.x - 62}" y="${photo.y + photo.r + 26}" width="124" height="30" rx="15" fill="${t.canvas}" fill-opacity="0.9" stroke="${t.border}"/>
${icon("globe", photo.x - 48, photo.y + photo.r + 34, 14, t.muted)}
<text x="${photo.x + 10}" y="${photo.y + photo.r + 45.5}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${t.blue}">${esc(SITE)}</text>`,
  );
}

/* ── The strip of everything, moving ─────────────────────────────── */

function marquee(t) {
  const height = 54;
  const items = STACK.flatMap((group) => group.items);
  // A slot per item, wide enough for its name in a wide font; the names start
  // at fixed places, so the reader's font only changes the gaps a little.
  let x = 0;
  const placed = items.map(([slug, name]) => {
    const at = x;
    x += 22 + 10 + Math.ceil(name.length * 8.4) + 34;
    return { slug, name, at };
  });
  const lap = x;
  const run = (offset) =>
    placed
      .map(
        ({ slug, name, at }) =>
          icon(slug, offset + at, 17, 20, t.fg, 0.82) +
          `<text x="${offset + at + 32}" y="32" font-family="${SANS}" font-size="14" font-weight="600" fill="${t.muted}">${esc(name)}</text>`,
      )
      .join("");
  return svg(
    HERO_W,
    height,
    `What I work with: ${items.map(([, name]) => name).join(", ")}`,
    `<defs>
  <linearGradient id="ends" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.1" stop-color="#fff"/><stop offset="0.9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="fade"><rect width="${HERO_W}" height="${height}" fill="url(#ends)"/></mask>
</defs>
<style>
  .run { animation: run ${Math.round(lap / 42)}s linear infinite; }
  @keyframes run { to { transform: translateX(-${lap}px); } }
  ${STILL()}
</style>
<g mask="url(#fade)"><g class="run">${run(0)}${run(lap)}</g></g>`,
  );
}

/* ── Cards ───────────────────────────────────────────────────────── */

const cardTitle = (t, title, accent) =>
  `<circle cx="28" cy="35" r="3.5" fill="${t[accent]}"/>` +
  `<text x="40" y="39" font-family="${MONO}" font-size="10.5" letter-spacing="1.4" fill="${t.fg}" fill-opacity="0.9">${esc(title)}</text>`;

const STACK_H = 190;

function stack(t, group, index) {
  if (group.items.length > 6) throw new Error(`${group.title}: a stack card holds six items`);
  const columns = [24, 212];
  const light = beam(CARD_W, STACK_H, 10, t[group.accent], { delay: -index * 1.7 });
  return svg(
    CARD_W,
    STACK_H,
    `${group.title}: ${group.items.map(([, name]) => name).join(", ")}`,
    `<style>
  ${light.css}
  .item { animation: item 0.6s ease-out backwards; }
  @keyframes item { from { opacity: 0; transform: translateY(8px); } }
  ${STILL()}
</style>
${panel(t.card, t.border, CARD_W, STACK_H, 10)}
${light.mark}
${cardTitle(t, group.title, group.accent)}
${group.items
  .map(([slug, name], i) => {
    const x = columns[i % 2];
    const y = 78 + Math.floor(i / 2) * 36;
    return (
      `<g class="item" style="animation-delay:${n(0.15 + i * 0.09)}s">` +
      icon(slug, x, y - 9, 18, t.fg, 0.9) +
      `<text x="${x + 30}" y="${y + 4.5}" font-family="${SANS}" font-size="13.5" fill="${t.fg}">${esc(name)}</text></g>`
    );
  })
  .join("\n")}`,
  );
}

const METER_H = 222;

/**
 * A card of meters: a name, a bar and its figure on each row.
 *
 * One colour per card, because each card is one series. The figure is printed
 * beside every bar in the text colour, so nothing is read off the bar alone.
 * The bars grow from zero, rest, and grow again — the README is long, and a bar
 * that only grew once would have finished before the reader scrolled to it.
 */
function meters(t, { title, note, accent, rows, index }) {
  const track = { x: 122, width: 214, height: 6 };
  const light = beam(CARD_W, METER_H, 10, t[accent], { delay: -index * 1.7 });
  return svg(
    CARD_W,
    METER_H,
    `${title}${note ? ` (${note})` : ""}: ${rows.map((row) => `${row.name} ${row.figure}`).join(", ")}`,
    `<style>
  ${light.css}
  .bar { transform-box: fill-box; transform-origin: left center; animation: grow 9s cubic-bezier(0.2, 0.7, 0.2, 1) infinite; }
  @keyframes grow { 0% { transform: scaleX(0); } 16%, 100% { transform: scaleX(1); } }
  ${STILL()}
</style>
${panel(t.card, t.border, CARD_W, METER_H, 10)}
${light.mark}
${cardTitle(t, title, accent)}
${note ? `<text x="${CARD_W - 24}" y="39" text-anchor="end" font-family="${SANS}" font-size="11.5" fill="${t.muted}">${esc(note)}</text>` : ""}
${rows
  .map((row, i) => {
    const y = 74 + i * 25;
    const width = Math.max(3, n(track.width * row.share));
    return (
      `<text x="24" y="${y + 4.5}" font-family="${SANS}" font-size="12.5" fill="${t.fg}">${esc(row.name)}</text>` +
      `<rect x="${track.x}" y="${y - 3}" width="${track.width}" height="${track.height}" rx="3" fill="${t.track}"/>` +
      `<rect class="bar" style="animation-delay:${n(i * 0.12)}s" x="${track.x}" y="${y - 3}" width="${width}" height="${track.height}" rx="3" fill="${t[accent]}"/>` +
      `<text x="${CARD_W - 24}" y="${y + 4.5}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(row.figure)}</text>`
    );
  })
  .join("\n")}`,
  );
}

const expertise = (t) =>
  meters(t, {
    title: "EXPERTISE",
    accent: "green",
    index: 0,
    rows: EXPERTISE.map(([name, score]) => ({ name, share: score / 100, figure: `${score}%` })),
  });

/** "49%", but "2.5%" where a whole number would hide the difference between small ones. */
const percent = (share) => (share >= 0.1 ? `${Math.round(share * 100)}%` : `${(share * 100).toFixed(1)}%`);

/** The languages I write most, by bytes of code across every repository. Bars are drawn against the largest. */
function languages(t, data) {
  const total = Object.values(data.bytes).reduce((sum, bytes) => sum + bytes, 0);
  const ranked = Object.entries(data.bytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LANGUAGES_SHOWN);
  const most = ranked[0][1];
  return meters(t, {
    title: "LANGUAGES",
    note: "share of my code",
    accent: "blue",
    index: 1,
    rows: ranked.map(([name, bytes]) => ({ name: LANGUAGE_NAME[name] ?? name, share: bytes / most, figure: percent(bytes / total) })),
  });
}

/* ── A link ──────────────────────────────────────────────────────── */

function link(t, item) {
  const height = 40;
  // The label's width in the reader's font is not known here, so the button is
  // sized for a wide one and the label centred in what is left of the icon.
  const text = Math.ceil(item.label.length * 8.1);
  const width = 46 + text + 20;
  return svg(
    width,
    height,
    item.label,
    `${panel(t.button, t.border, width, height, 8)}
${icon(item.icon, 18, 11, 18, t.fg, 0.92)}
<text x="${46 + text / 2}" y="24.5" text-anchor="middle" font-family="${SANS}" font-size="13.5" font-weight="600" fill="${t.fg}">${esc(item.label)}</text>`,
  );
}

/* ── Build ───────────────────────────────────────────────────────── */

/** Recounts the languages across every repository of the signed-in account, forks aside. */
function refreshLanguages() {
  const login = execFileSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf8" }).trim();
  const listed = execFileSync("gh", ["repo", "list", login, "--limit", "500", "--json", "isFork,languages"], { encoding: "utf8" });
  const repos = JSON.parse(listed).filter((repo) => !repo.isFork);
  const bytes = {};
  for (const repo of repos) {
    for (const language of repo.languages) bytes[language.node.name] = (bytes[language.node.name] ?? 0) + language.size;
  }
  writeFileSync(join(here, "languages.json"), `${JSON.stringify({ repos: repos.length, bytes }, null, 1)}\n`);
}

if (process.argv.includes("--refresh")) refreshLanguages();
const languageData = JSON.parse(readFileSync(join(here, "languages.json"), "utf8"));

// Start clean, so an image the README no longer shows does not stay behind.
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) if (file.endsWith(".svg")) unlinkSync(join(out, file));

let count = 0;
const write = (name, theme, content) => {
  writeFileSync(join(out, `${name}-${theme}.svg`), content);
  count += 1;
};

for (const [theme, t] of Object.entries(THEMES)) {
  write("hero", theme, hero(t, theme));
  write("marquee", theme, marquee(t));
  write("skills-expertise", theme, expertise(t));
  write("skills-languages", theme, languages(t, languageData));
  STACK.forEach((group, i) => write(group.file, theme, stack(t, group, i + 2)));
  for (const item of LINKS) write(item.file, theme, link(t, item));
}
console.log(`Wrote ${count} images to assets/`);
