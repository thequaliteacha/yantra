/* The altar: up to six photos (a teacher, an amakua, a place of power) resting
 * above the yantra during sits and talks, and in a centered row on home, the
 * sits menu, and the Altar section of Settings. Each is shrunk on this device
 * to a small square JPEG and kept with the other settings. Nothing is uploaded.
 *
 * Wide rows stay on one line. A narrow row wraps into balanced, centered lines
 * (five photos become three, then two) and the circles shrink before anything
 * is clipped.
 */
(function (root) {
  const MAX = 6;
  const SIDE = 320;
  const PREFERRED = 70.4;
  const GAP = 18.4;

  /* The size to draw a w x h image so its centre square fills side x side. */
  function cover(w, h, side) {
    const scale = side / Math.min(w, h);
    return { w: Math.round(w * scale), h: Math.round(h * scale), x: Math.round((side - w * scale) / 2), y: Math.round((side - h * scale) / 2) };
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  /* Split count into rows no wider than per, longer rows first, so five is 3+2. */
  function balance(count, per) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (!n) return [];
    const limit = Math.max(1, Math.floor(Number(per) || 1));
    const nRows = Math.ceil(n / limit);
    const base = Math.floor(n / nRows);
    let extra = n - base * nRows;
    const rows = [];
    for (let i = 0; i < nRows; i++) rows.push(base + (i < extra ? 1 : 0));
    return rows;
  }

  function span(items, size, gap) {
    if (items <= 0) return 0;
    return items * size + (items - 1) * gap;
  }

  /* How to place `count` circles in `width` pixels.
     oneRow keeps a single centered line and scales the circles down.
     Otherwise the circles stay near the preferred size and wrap into balanced rows. */
  function arrange(count, width, options) {
    const opt = options || {};
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const box = Math.max(0, Number(width) || 0);
    const preferred = Number(opt.preferred) > 0 ? Number(opt.preferred) : PREFERRED;
    const minSize = Number(opt.minSize) > 0 ? Number(opt.minSize) : 36;
    const gap = Number(opt.gap) > 0 ? Number(opt.gap) : GAP;
    const minGap = Number(opt.minGap) > 0 ? Number(opt.minGap) : Math.min(8, gap);
    const oneRow = opt.oneRow != null ? !!opt.oneRow : box >= 560;
    if (!n) return { rows: [], size: round1(preferred), gap: round1(gap) };

    function fit(items, sizeCap, g) {
      if (!box) return sizeCap;
      if (items <= 1) return Math.min(sizeCap, box);
      return Math.min(sizeCap, (box - (items - 1) * g) / items);
    }

    if (oneRow) {
      let g = gap;
      let size = box ? fit(n, preferred, g) : preferred;
      if (box && size < minSize) {
        g = minGap;
        size = fit(n, preferred, g);
      }
      if (box && span(n, size, g) > box + 0.5) {
        g = minGap;
        size = (box - (n - 1) * g) / n;
      }
      size = Math.min(preferred, Math.max(1, size));
      return { rows: [n], size: round1(size), gap: round1(g) };
    }

    let per = 1;
    let g = gap;
    for (let k = n; k >= 1; k--) {
      if (span(k, preferred, g) <= box + 0.5) { per = k; break; }
    }
    if (per === 1 && box && span(1, preferred, g) > box) {
      const two = fit(2, preferred, minGap);
      per = n >= 2 && two >= minSize ? 2 : 1;
      g = per === 2 ? minGap : gap;
    }
    const rows = balance(n, per);
    const widest = rows.reduce((m, k) => Math.max(m, k), 1);
    let size = Math.min(preferred, fit(widest, preferred, g));
    if (box && size < minSize) {
      g = minGap;
      size = Math.min(preferred, fit(widest, preferred, g));
    }
    if (box && span(widest, size, g) > box + 0.5) {
      size = (box - (widest - 1) * g) / widest;
    }
    return { rows: rows, size: round1(Math.min(preferred, Math.max(1, size))), gap: round1(g) };
  }

  function settings() {
    return root && root.YantraSettings ? root.YantraSettings : null;
  }
  function photos() {
    const S = settings();
    return S ? S.get("altar.photos") || [] : [];
  }
  function shown() {
    const S = settings();
    return S ? S.get("altar.show") !== false : true;
  }

  function remPx() {
    try {
      const doc = root && root.document;
      const size = doc ? parseFloat(getComputedStyle(doc.documentElement).fontSize) : 16;
      return size > 0 ? size : 16;
    } catch (e) {
      return 16;
    }
  }

  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type || "")) return reject(new Error("not an image"));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = SIDE;
          canvas.height = SIDE;
          const fit = cover(img.naturalWidth, img.naturalHeight, SIDE);
          canvas.getContext("2d").drawImage(img, fit.x, fit.y, fit.w, fit.h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable"));
      };
      img.src = url;
    });
  }

  function fallbackWidth(container) {
    const view = (root && root.innerWidth) || 390;
    if (!container) return Math.max(280, view - 48);
    if (container.id === "altar") return Math.max(280, view - 32);
    if (container.id === "altar-list") return Math.min(416, Math.max(280, view - 48));
    return Math.max(280, view - 48);
  }

  function optionsFor(container, count) {
    const unit = remPx();
    const preferred = 4.4 * unit;
    const gap = 1.15 * unit;
    if (container && container.id === "altar") {
      return {
        oneRow: true,
        preferred: count > 3 ? 3 * unit : preferred,
        gap: count > 3 ? 0.7 * unit : gap,
        minSize: 1.7 * unit,
        minGap: 0.4 * unit,
      };
    }
    const wide = container && (container.id === "home-altar" || container.id === "pick-altar")
      && root && root.innerWidth >= 900;
    return { oneRow: wide, preferred: preferred, gap: gap, minSize: 2.15 * unit, minGap: 0.5 * unit };
  }

  function layoutInto(container, nodes) {
    if (!container) return;
    const list = nodes || [];
    const width = container.clientWidth > 40 ? container.clientWidth : fallbackWidth(container);
    const plan = arrange(list.length, width, optionsFor(container, list.length));
    const key = plan.rows.join(",") + "@" + Math.round(width) + ":" + plan.size + ":" + plan.gap;
    if (container.dataset && container.dataset.altarKey === key && container._altarPlaced === list && container.childElementCount) return;
    if (container.dataset) container.dataset.altarKey = key;
    container._altarPlaced = list;
    container.style.setProperty("--altar-size", plan.size + "px");
    container.style.setProperty("--altar-gap", plan.gap + "px");
    const doc = container.ownerDocument;
    const frag = doc.createDocumentFragment();
    let index = 0;
    const rows = plan.rows.length ? plan.rows : (list.length ? [list.length] : []);
    rows.forEach((n) => {
      const row = doc.createElement("div");
      row.className = "altar-row";
      for (let i = 0; i < n && index < list.length; i++) row.append(list[index++]);
      frag.append(row);
    });
    container.replaceChildren(frag);
  }

  function watch(container) {
    if (!container || container.dataset.altarWatch || typeof ResizeObserver === "undefined") return;
    container.dataset.altarWatch = "1";
    const observer = new ResizeObserver(() => {
      if (container._altarNodes) layoutInto(container, container._altarNodes);
    });
    observer.observe(container);
  }

  function paint() {
    const doc = root.document;
    const list = doc.getElementById("altar-list");
    const altar = doc.getElementById("altar");
    const add = doc.getElementById("altar-add");
    const show = doc.getElementById("altar-show");
    const all = photos();
    const image = (src, alt) => {
      const img = doc.createElement("img");
      img.src = src;
      img.alt = alt;
      return img;
    };
    if (list) {
      const figures = all.map((src, i) => {
        const figure = doc.createElement("figure");
        const remove = doc.createElement("button");
        remove.type = "button";
        remove.className = "quiet";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          const next = photos();
          next.splice(i, 1);
          settings().set("altar.photos", next);
          paint();
        });
        figure.append(image(src, "Altar photo " + (i + 1)), remove);
        return figure;
      });
      list._altarNodes = figures;
      list.hidden = !all.length;
      layoutInto(list, figures);
      watch(list);
    }
    ["home-altar", "pick-altar"].forEach((id) => {
      const row = doc.getElementById(id);
      if (!row) return;
      const imgs = all.map((src) => image(src, ""));
      row._altarNodes = imgs;
      row.hidden = !all.length;
      layoutInto(row, imgs);
      watch(row);
    });
    if (add) add.hidden = all.length >= MAX;
    if (show) {
      show.hidden = !all.length;
      show.setAttribute("aria-pressed", String(shown()));
      show.textContent = shown() ? "Shown during sits" : "Hidden during sits";
    }
    if (altar) {
      const imgs = all.map((src) => image(src, ""));
      altar._altarNodes = imgs;
      layoutInto(altar, imgs);
      watch(altar);
      altar.classList.toggle("on", all.length > 0 && shown());
    }
  }

  function boot() {
    const doc = root.document;
    const add = doc.getElementById("altar-add");
    const file = doc.getElementById("altar-file");
    const show = doc.getElementById("altar-show");
    const note = doc.getElementById("altar-note");
    if (!add || !file || !settings()) return;
    add.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const chosen = file.files && file.files[0];
      file.value = "";
      if (!chosen) return;
      try {
        const src = await shrink(chosen);
        const next = photos().concat([src]).slice(0, MAX);
        settings().set("altar.photos", next);
        if (note) note.textContent = "";
      } catch (e) {
        if (note) note.textContent = "That photo could not be read. Try a JPEG or PNG.";
      }
      paint();
    });
    if (show) {
      show.addEventListener("click", () => {
        settings().set("altar.show", !shown());
        paint();
      });
    }
    root.addEventListener("resize", () => paint());
    paint();
  }

  const api = { MAX, SIDE, cover, arrange, balance, paint, boot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    root.YantraAltar = api;
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : null);
