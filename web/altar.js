/* The altar: up to three photos (a teacher, an amakua) resting above the yantra
 * during sits and talks. Each is shrunk on this device to a small square JPEG and
 * kept with the other settings. Nothing is uploaded.
 */
(function (root) {
  const MAX = 3;
  const SIDE = 320;

  /* The size to draw a w x h image so its centre square fills side x side. */
  function cover(w, h, side) {
    const scale = side / Math.min(w, h);
    return { w: Math.round(w * scale), h: Math.round(h * scale), x: Math.round((side - w * scale) / 2), y: Math.round((side - h * scale) / 2) };
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

  /* A chosen image file as a small square JPEG data URL. */
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

  function paint() {
    const doc = root.document;
    const list = doc.getElementById("altar-list");
    const altar = doc.getElementById("altar");
    const add = doc.getElementById("altar-add");
    const show = doc.getElementById("altar-show");
    const all = photos();
    if (list) {
      list.replaceChildren();
      all.forEach((src, i) => {
        const figure = doc.createElement("figure");
        const img = doc.createElement("img");
        img.src = src;
        img.alt = "Altar photo " + (i + 1);
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
        figure.append(img, remove);
        list.append(figure);
      });
    }
    if (add) add.hidden = all.length >= MAX;
    if (show) {
      show.hidden = !all.length;
      show.setAttribute("aria-pressed", String(shown()));
      show.textContent = shown() ? "Shown during sits" : "Hidden during sits";
    }
    if (altar) {
      altar.replaceChildren();
      all.forEach((src) => {
        const img = doc.createElement("img");
        img.src = src;
        img.alt = "";
        altar.append(img);
      });
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
    paint();
  }

  const api = { MAX, SIDE, cover, paint, boot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document) {
    root.YantraAltar = api;
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : null);
