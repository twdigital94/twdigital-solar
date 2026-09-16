/* ============================================================================
   A small aerial map. No libraries.

   Shows LINZ aerial photography with a pin fixed in the middle. The person
   drags the photo until their house sits under the pin, which is easier on a
   phone than dragging a tiny marker around.

   Everything external is optional. If the imagery key is missing, or LINZ is
   having a bad day, the whole thing steps aside and they type their address
   instead. It must never be the reason a lead is lost.
   ============================================================================ */

window.SolarMap = (function () {
  "use strict";

  var TILE = 256;

  /* --- Web Mercator. The standard maths every slippy map uses. ------------- */
  function worldSize(z) { return TILE * Math.pow(2, z); }

  function lonToX(lon, z) { return (lon + 180) / 360 * worldSize(z); }

  function latToY(lat, z) {
    var s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize(z);
  }

  function xToLon(x, z) { return x / worldSize(z) * 360 - 180; }

  function yToLat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / worldSize(z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  /* --- The map ------------------------------------------------------------- */
  function create(container, opts) {
    var cfg = opts || {};
    var centre = { lat: cfg.lat, lon: cfg.lon };
    var zoom = cfg.zoom || 18;
    var minZoom = cfg.minZoom || 14;
    var maxZoom = cfg.maxZoom || 20;
    var onMove = cfg.onMove || function () {};
    var tileUrl = cfg.tileUrl;
    var failed = false;

    container.classList.add("map");
    container.innerHTML = "";

    var surface = document.createElement("div");
    surface.className = "map-surface";
    container.appendChild(surface);

    var pin = document.createElement("div");
    pin.className = "map-pin";
    pin.setAttribute("aria-hidden", "true");
    container.appendChild(pin);

    var controls = document.createElement("div");
    controls.className = "map-controls";
    [["+", 1, "Zoom in"], ["−", -1, "Zoom out"]].forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c[0];
      b.setAttribute("aria-label", c[2]);
      b.addEventListener("click", function () { setZoom(zoom + c[1]); });
      controls.appendChild(b);
    });
    container.appendChild(controls);

    var credit = document.createElement("div");
    credit.className = "map-credit";
    credit.textContent = cfg.attribution || "Imagery © LINZ Basemaps, CC BY 4.0";
    container.appendChild(credit);

    /* Track failed tiles. A couple is normal at the edge of coverage; a
       screenful means the key is wrong or the service is down, and we should
       get out of the way rather than show a grey box. */
    var loaded = 0, errored = 0;
    function noteTile(ok) {
      if (ok) { loaded++; return; }
      errored++;
      if (!failed && errored >= 6 && loaded === 0) {
        failed = true;
        container.classList.add("is-unavailable");
        if (cfg.onUnavailable) cfg.onUnavailable();
      }
    }

    var tiles = {};   // key -> img, so panning back doesn't refetch

    function draw() {
      var w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;

      var cx = lonToX(centre.lon, zoom), cy = latToY(centre.lat, zoom);
      var left = cx - w / 2, top = cy - h / 2;
      var x0 = Math.floor(left / TILE), y0 = Math.floor(top / TILE);
      var x1 = Math.floor((left + w) / TILE), y1 = Math.floor((top + h) / TILE);
      var span = Math.pow(2, zoom);
      var wanted = {};

      for (var tx = x0; tx <= x1; tx++) {
        for (var ty = y0; ty <= y1; ty++) {
          if (ty < 0 || ty >= span) continue;
          var wrapped = ((tx % span) + span) % span;   // let it wrap east-west
          var key = zoom + "/" + wrapped + "/" + ty;
          var slot = key + "@" + tx;
          wanted[slot] = true;

          var img = tiles[slot];
          if (!img) {
            img = document.createElement("img");
            img.className = "map-tile";
            img.alt = "";
            img.decoding = "async";
            img.addEventListener("load", function () { noteTile(true); });
            img.addEventListener("error", function () {
              this.classList.add("is-missing");
              noteTile(false);
            });
            img.src = tileUrl
              .replace("{z}", zoom).replace("{x}", wrapped).replace("{y}", ty);
            surface.appendChild(img);
            tiles[slot] = img;
          }
          img.style.transform =
            "translate(" + (tx * TILE - left) + "px," + (ty * TILE - top) + "px)";
        }
      }

      // Drop tiles that have scrolled well out of view.
      Object.keys(tiles).forEach(function (slot) {
        if (!wanted[slot]) { tiles[slot].remove(); delete tiles[slot]; }
      });
    }

    function setZoom(z) {
      z = Math.max(minZoom, Math.min(maxZoom, z));
      if (z === zoom) return;
      zoom = z;
      Object.keys(tiles).forEach(function (k) { tiles[k].remove(); });
      tiles = {};
      draw();
      onMove(getCentre());
    }

    function setCentre(lat, lon, z) {
      centre = { lat: lat, lon: lon };
      if (z) zoom = Math.max(minZoom, Math.min(maxZoom, z));
      Object.keys(tiles).forEach(function (k) { tiles[k].remove(); });
      tiles = {};
      draw();
      onMove(getCentre());
    }

    function getCentre() {
      return { lat: centre.lat, lon: centre.lon, zoom: zoom };
    }

    /* --- Dragging. Pointer events cover mouse and touch in one path. ------- */
    var dragging = false, lastX = 0, lastY = 0, moved = false;

    container.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".map-controls")) return;
      dragging = true; moved = false;
      lastX = e.clientX; lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
      container.classList.add("is-dragging");
    });

    container.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      lastX = e.clientX; lastY = e.clientY;

      var cx = lonToX(centre.lon, zoom) - dx;
      var cy = latToY(centre.lat, zoom) - dy;
      cy = Math.max(0, Math.min(worldSize(zoom), cy));
      centre = { lat: yToLat(cy, zoom), lon: xToLon(cx, zoom) };
      draw();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      container.classList.remove("is-dragging");
      if (e && e.pointerId != null) {
        try { container.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      if (moved) onMove(getCentre());
    }
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    /* Keyboard panning, so this isn't mouse-only. */
    container.tabIndex = 0;
    container.setAttribute("role", "application");
    container.setAttribute("aria-label",
      "Aerial map. Arrow keys move the map, plus and minus zoom.");
    container.addEventListener("keydown", function (e) {
      var step = 40, dx = 0, dy = 0;
      if (e.key === "ArrowLeft")  dx = step;
      else if (e.key === "ArrowRight") dx = -step;
      else if (e.key === "ArrowUp")    dy = step;
      else if (e.key === "ArrowDown")  dy = -step;
      else if (e.key === "+" || e.key === "=") { setZoom(zoom + 1); e.preventDefault(); return; }
      else if (e.key === "-" || e.key === "_") { setZoom(zoom - 1); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      var cx = lonToX(centre.lon, zoom) - dx;
      var cy = latToY(centre.lat, zoom) - dy;
      centre = { lat: yToLat(cy, zoom), lon: xToLon(cx, zoom) };
      draw();
      onMove(getCentre());
    });

    window.addEventListener("resize", draw);
    draw();

    return { setCentre: setCentre, getCentre: getCentre, setZoom: setZoom,
             redraw: draw, hasFailed: function () { return failed; } };
  }

  return {
    create: create,
    lonToX: lonToX, latToY: latToY, xToLon: xToLon, yToLat: yToLat
  };
})();
