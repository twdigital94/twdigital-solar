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
     Basemaps imagery one.

     Their exact query format could not be confirmed when this was written, so
     rather than betting on one guess it tries each candidate in turn on the
     first search, keeps whichever returns addresses, and uses only that one
     from then on. If none work it records why, which is far more useful than
     an empty list. */
  providers.linz = function (cfg) {
    var chosen = null;      // the template that worked
    var probing = null;     // the in-flight probe, so parallel keystrokes share it

    /* Match on what comes before the first comma.

       People type the whole thing: "12 priestley road, napier, hawkes bay".
       LINZ store it as "12 Priestley Road, Bluff Hill, Napier", so matching
       the full string finds nothing, because the suburb someone types is
       rarely the one on the official record. Matching "12 priestley road"
       returns every candidate and the list lets them pick the right one. */
    function forMatching(query) {
      var head = query.split(",")[0].trim();
      return (head.length >= cfg.minCharacters ? head : query.trim())
        .replace(/'/g, "''");
    }

    function urlFor(tpl, query) {
      return tpl
        .replace("{key}", encodeURIComponent(cfg.linzDataKey))
        .replace("{layer}", encodeURIComponent(cfg.linzLayerId))
        .replace("{count}", String(cfg.maxResults))
        .replace(/\{query\}/g, encodeURIComponent(forMatching(query)));
    }

    function parse(data) {
      return (data.features || []).map(function (f) {
        var p = f.properties || {};
        var c = (f.geometry && f.geometry.coordinates) || [];
        return {
          label: p.full_address || p.full_address_ascii || p.address ||
                 p.address_label || "",
          lon: c[0], lat: c[1]
        };
      }).filter(function (s) {
        return s.label && typeof s.lat === "number" && typeof s.lon === "number";
      });
    }

    /* Resolves to { results } on success, or { why } describing the failure.
       Never rejects: a failed candidate is data, not an error. */
    function tryTemplate(tpl, query) {
      return fetch(urlFor(tpl, query)).then(function (r) {
        return r.text().then(function (body) {
          if (!r.ok) return { why: "HTTP " + r.status + ", " + explain(body) };
          try {
            var results = parse(JSON.parse(body));
            return results.length ? { results: results } : { why: "no matches" };
          } catch (e) {
            // A WFS that dislikes the query answers in XML, and that XML says
            // exactly what it disliked. Far more use than "not JSON".
            return { why: explain(body) };
          }
        });
      }).catch(function (e) {
        // fetch only rejects on a network-level failure, which for a browser
        // calling another domain almost always means the service did not
        // allow the request at all.
        return { why: "blocked before it reached LINZ (" + e.message + ")" };
      });
    }

    /* WFS puts its real complaint in the response body rather than the status
       line, so dig the sentence out of the XML. */
    function explain(body) {
      var m = body.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/i)
           || body.match(/<ExceptionText>([\s\S]*?)<\/ExceptionText>/i);
      if (m) return m[1].trim().replace(/\s+/g, " ").slice(0, 160);
      try {
        var j = JSON.parse(body);
        if (j.error || j.detail || j.message) return j.error || j.detail || j.message;
      } catch (e) {}
      return body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)
             || "empty reply";
    }

    function candidates() {
      return (cfg.linzUrlTemplates && cfg.linzUrlTemplates.length)
        ? cfg.linzUrlTemplates
        : [cfg.linzUrlTemplate];
    }

    return function (query) {
      if (!cfg.linzDataKey) {
        report("No data.linz.govt.nz key set, so suggestions are off.");
        return Promise.resolve([]);
      }

      if (chosen) {
        return tryTemplate(chosen, query).then(function (r) {
          return r.results || [];
        });
      }

      if (!probing) {
        var list = candidates();
        var notes = [];
        probing = list.reduce(function (chain, tpl, i) {
          return chain.then(function (found) {
            if (found) return found;
            return tryTemplate(tpl, query).then(function (r) {
              if (r.results) { chosen = tpl; return r.results; }
              notes.push("Format " + (i + 1) + ": " + r.why);
              return null;
            });
          });
        }, Promise.resolve(null)).then(function (found) {
          probing = null;
          if (found) {
            report("Address search working. Using format " +
                   (list.indexOf(chosen) + 1) + " of " + list.length + ".");
            return found;
          }
          report("Address search found nothing. " + notes.join("; ") + ".");
          return [];
        });
      }
      return probing;
    };

    function report(message) {
      if (cfg.onStatus) cfg.onStatus(message);
      console.log("[calculator] " + message);
    }
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
