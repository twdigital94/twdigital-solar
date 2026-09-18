/* ============================================================================
   Address suggestions.

   Turns the plain address box into a search: type a few characters, pick your
   place from a list, and the map jumps to it.

   Two providers, because they trade off differently:

     "linz"   Free, and New Zealand only, which is exactly our audience.
              Uses the LINZ Data Service, a separate key from the Basemaps one.
     "google" Costs a few dollars per thousand lookups, but it is the search
              people are used to and it copes with half-typed, misspelled and
              informal addresses far better.

   Either way, if the provider is missing, misconfigured or simply down, the
   suggestions stop appearing and the box goes back to being a plain text
   field. Someone can always type their address and carry on.
   ============================================================================ */

window.SolarAddress = (function () {
  "use strict";

  /* --- Providers -----------------------------------------------------------
     Each takes a search string and returns a promise of
     [{ label, lat, lon }]. Anything that throws is treated as "no suggestions".
  ------------------------------------------------------------------------- */
  var providers = {};

  /* LINZ Data Service. Queries the national street address layer.
     Needs a key from data.linz.govt.nz, which is NOT the same key as the
     Basemaps imagery one. */
  providers.linz = function (cfg) {
    return function (query) {
      var safe = query.replace(/'/g, "''");
      var url = cfg.linzUrlTemplate
        .replace("{key}", encodeURIComponent(cfg.linzDataKey))
        .replace("{layer}", encodeURIComponent(cfg.linzLayerId))
        .replace("{count}", String(cfg.maxResults))
        .replace("{query}", encodeURIComponent(safe));

      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("LINZ address search: HTTP " + r.status);
        return r.json();
      }).then(function (data) {
        return (data.features || []).map(function (f) {
          var p = f.properties || {};
          var c = (f.geometry && f.geometry.coordinates) || [];
          return {
            label: p.full_address || p.full_address_ascii || p.address || "",
            lon: c[0], lat: c[1]
          };
        }).filter(function (s) {
          return s.label && typeof s.lat === "number" && typeof s.lon === "number";
        });
      });
    };
  };

  /* Google Places. Loads their script once, then asks for predictions and
     resolves the chosen one to coordinates. */
  providers.google = function (cfg) {
    var ready = null;

    function load() {
      if (ready) return ready;
      ready = new Promise(function (resolve, reject) {
        if (window.google && window.google.maps && window.google.maps.places) {
          return resolve();
        }
        var s = document.createElement("script");
        s.src = "https://maps.googleapis.com/maps/api/js?libraries=places&key=" +
                encodeURIComponent(cfg.googleApiKey);
        s.async = true;
        s.onload = resolve;
        s.onerror = function () { reject(new Error("Google Places failed to load")); };
        document.head.appendChild(s);
      });
      return ready;
    }

    return function (query) {
      return load().then(function () {
        var svc = new window.google.maps.places.AutocompleteService();
        return new Promise(function (resolve) {
          svc.getPlacePredictions(
            { input: query, componentRestrictions: { country: "nz" } },
            function (predictions, status) {
              if (status !== "OK" || !predictions) return resolve([]);
              resolve(predictions.slice(0, cfg.maxResults).map(function (p) {
                return { label: p.description, placeId: p.place_id };
              }));
            }
          );
        });
      });
    };
  };

  /* Google gives coordinates only once a suggestion is picked, so it needs a
     second step the LINZ provider does not. */
  function resolveGoogle(choice) {
    return new Promise(function (resolve, reject) {
      var geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: choice.placeId }, function (results, status) {
        if (status !== "OK" || !results || !results[0]) {
          return reject(new Error("Could not place that address"));
        }
        var loc = results[0].geometry.location;
        resolve({ label: choice.label, lat: loc.lat(), lon: loc.lng() });
      });
    });
  }

  /* --- The widget ----------------------------------------------------------
     Wires a suggestion list under an existing text input. Built as a proper
     ARIA combobox so it works with a keyboard and a screen reader, not only
     a mouse.
  ------------------------------------------------------------------------- */
  function attach(input, opts) {
    var cfg = opts.config;
    var onPick = opts.onPick;
    var search = providers[cfg.provider] && providers[cfg.provider](cfg);
    if (!search) return null;

    var list = document.createElement("ul");
    list.className = "suggest";
    list.id = input.id + "-suggestions";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    input.parentNode.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-autocomplete", "list");
    input.autocomplete = "off";

    var items = [];        // current suggestions
    var active = -1;       // highlighted index
    var timer = null;
    var seq = 0;           // drops results from stale requests
    var suppress = false;  // stops the box re-searching right after a pick

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      items = [];
      active = -1;
      if (opts.onResize) opts.onResize();
    }

    function highlight(i) {
      var nodes = list.querySelectorAll(".suggest-item");
      for (var n = 0; n < nodes.length; n++) {
        var on = n === i;
        nodes[n].setAttribute("aria-selected", String(on));
        nodes[n].classList.toggle("is-active", on);
      }
      active = i;
      if (i >= 0 && nodes[i]) {
        input.setAttribute("aria-activedescendant", nodes[i].id);
        nodes[i].scrollIntoView({ block: "nearest" });
      }
    }

    function show(results) {
      items = results;
      list.innerHTML = "";
      if (!results.length) return close();

      results.forEach(function (s, i) {
        var li = document.createElement("li");
        li.className = "suggest-item";
        li.id = list.id + "-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.textContent = s.label;
        // mousedown, not click: the input blurs before a click lands.
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pick(i); });
        li.addEventListener("mouseenter", function () { highlight(i); });
        list.appendChild(li);
      });

      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
      if (opts.onResize) opts.onResize();
    }

    function pick(i) {
      var choice = items[i];
      if (!choice) return;
      suppress = true;
      input.value = choice.label;
      close();

      var done = choice.placeId
        ? resolveGoogle(choice)
        : Promise.resolve(choice);

      done.then(function (place) { onPick(place); })
          .catch(function (err) {
            // Still keep the typed address; only the pin move is lost.
            console.warn("[calculator] " + err.message);
            onPick({ label: choice.label });
          });
    }

    function run() {
      var q = input.value.trim();
      if (q.length < cfg.minCharacters) return close();

      var mine = ++seq;
      search(q).then(function (results) {
        if (mine !== seq) return;          // a newer keystroke already won
        show(results.slice(0, cfg.maxResults));
      }).catch(function (err) {
        if (mine !== seq) return;
        // Suggestions are a nicety. Losing them must not break anything.
        console.warn("[calculator] Address suggestions unavailable:", err.message);
        close();
      });
    }

    input.addEventListener("input", function () {
      if (suppress) { suppress = false; return; }
      clearTimeout(timer);
      timer = setTimeout(run, cfg.debounceMs);
    });

    input.addEventListener("keydown", function (e) {
      if (list.hidden) {
        if (e.key === "ArrowDown") { clearTimeout(timer); run(); }
        return;
      }
      if (e.key === "ArrowDown")      { e.preventDefault(); highlight((active + 1) % items.length); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); highlight((active - 1 + items.length) % items.length); }
      else if (e.key === "Enter")     { if (active >= 0) { e.preventDefault(); pick(active); } }
      else if (e.key === "Escape")    { close(); }
      else if (e.key === "Tab")       { close(); }
    });

    input.addEventListener("blur", function () { setTimeout(close, 120); });

    return { close: close };
  }

  return { attach: attach, providers: Object.keys(providers) };
})();
