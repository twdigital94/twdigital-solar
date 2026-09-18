/* ============================================================================
   THE PAGE. Runs the question flow, then draws the results.
   Reads everything it needs from config.js. No client details live in here.
   ============================================================================ */

(function () {
  "use strict";

  const CFG = window.SOLAR_CONFIG;
  const answers = {};
  let stepIndex = 0;
  let submitted = false;

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* --- Formatting ---------------------------------------------------------- */
  const money = n => "$" + Math.round(n).toLocaleString("en-NZ");
  const moneyRange = (a, b) => money(a) + "–" + money(b);
  const pct = n => Math.round(n * 100) + "%";
  const years = n => (n >= 25 || n == null) ? "25+ years" :
                     (n < 10 ? n.toFixed(1) : Math.round(n)) + " years";

  /* --- Brand ---------------------------------------------------------------
     A client's brand colour is a FILL. Some fills, yellow especially, are
     unreadable as text on a pale background. So we darken (or lighten) the
     brand colour until it passes contrast against the page, and use that
     wherever the colour has to be read rather than looked at.
     This is what lets the whole thing re-skin from one hex value.
  ------------------------------------------------------------------------- */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const f = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
  }
  function luminance(rgb) {
    const a = rgb.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  const toHex = rgb => "#" + rgb.map(v =>
    Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

  /* Step the colour toward black or white until it reads against `bg`. */
  function readableOn(brandHex, bgHex, target) {
    const bg = hexToRgb(bgHex);
    let rgb = hexToRgb(brandHex);
    if (contrast(rgb, bg) >= target) return toHex(rgb);
    const towardBlack = luminance(bg) > 0.5;
    for (let i = 0; i < 24; i++) {
      rgb = rgb.map(v => towardBlack ? v * 0.9 : v + (255 - v) * 0.12);
      if (contrast(rgb, bg) >= target) break;
    }
    return toHex(rgb);
  }

  /* rgba() from a hex, for the tinted washes behind selected options. */
  const wash = (hex, alpha) => {
    const [r, g, b] = hexToRgb(hex);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  };

  function applyBrand() {
    const b = CFG.brand;
    const onBrand = b.onAccent || "#FFFFFF";

    // Paper colours come from the stylesheet; keep these two in step with it.
    const lightPaper = "#F5F3EF", darkPaper = "#1F1E1C";

    const vars = light =>
      "--brand:" + (light ? b.accent : b.accentDark) + ";" +
      "--brand-text:" + readableOn(light ? b.accent : b.accentDark,
                                   light ? lightPaper : darkPaper, 4.5) + ";" +
      "--on-brand:" + onBrand + ";" +
      "--brand-wash:" + wash(light ? b.accent : b.accentDark, light ? 0.16 : 0.20) + ";";

    const s = document.createElement("style");
    s.textContent =
      ":root{" + vars(true) + "}" +
      "@media (prefers-color-scheme: dark){:root:not([data-theme='light']){" + vars(false) + "}}" +
      ":root[data-theme='dark']{" + vars(false) + "}";
    document.head.appendChild(s);
  }

  function renderMasthead() {
    const brand = $("brand");
    brand.innerHTML = "";
    if (CFG.client.logoUrl) {
      const img = el("img");
      img.src = CFG.client.logoUrl;
      img.alt = CFG.client.name;
      // If the logo 404s, fall back to the name rather than showing a broken image.
      img.onerror = () => { img.remove(); brand.prepend(nameBlock()); };
      brand.appendChild(img);
    } else {
      brand.appendChild(nameBlock());
    }
    const phone = $("masthead-phone");
    if (CFG.client.phone) {
      phone.textContent = CFG.client.phone;
      phone.href = "tel:" + CFG.client.phone.replace(/\s/g, "");
    } else {
      phone.hidden = true;
    }
  }
  function nameBlock() {
    const w = el("div");
    w.appendChild(el("div", "brand-name", CFG.client.name));
    if (CFG.client.tagline) w.appendChild(el("div", "brand-tag", CFG.client.tagline));
    return w;
  }

  /* ==========================================================================
     THE QUESTIONS
     Each step knows how to draw itself and what to write into the rail.
     ========================================================================== */

  const STEPS = [
    {
      id: "monthlyBill",
      question: "First up, what's a normal power bill for you?",
      why: "A rough monthly figure is plenty, no need to go digging for the actual bill. Everything else we work out comes off this one number.",
      railLabel: "Power bill",
      railValue: v => money(v) + "/month",
      render: renderBill
    },
    {
      id: "place",
      question: "Right, where's home?",
      why: "Drag the photo so the pin sits on your roof. This is just so we know which sunshine figures to use, and so someone can find you if you want a proper look.",
      railLabel: "Address",
      // Show the address if they typed one, otherwise the region we worked
      // out from the pin, so they can see the tool understood where they are.
      railValue: v => {
        if (v.label) return v.label;
        if (v.positioned) {
          const r = window.nzRegionFromCoords(v.lat, v.lon);
          return r ? r.name : "Pin dropped";
        }
        return "Not set";
      },
      skip: () => !CFG.address.enabled,
      render: renderPlace
    },
    {
      id: "region",
      question: "Where are you in the country?",
      why: "Some parts of New Zealand get a good deal more sun than others, and that changes what the same panels would make on your roof.",
      railLabel: "Region",
      railValue: v => (window.NZ_REGIONS.find(r => r.id === v) || {}).name || v,
      // The map pin already tells us the region, so do not ask twice.
      skip: () => CFG.region.lockToDefault ||
                  (CFG.address.enabled && answers.place && answers.place.positioned),
      render: s => renderOptions(s, window.NZ_REGIONS.map(r => ({ value: r.id, label: r.name })))
    },
    {
      id: "orientation",
      question: "Which way does your roof face?",
      why: "North is the sweet spot here. East and west still do nicely. South is the tricky one. Not sure? Pick the last option, plenty of people don't know.",
      railLabel: "Roof",
      railValue: v => ({ north: "North facing", eastWest: "East–west", south: "South facing", unsure: "Not sure yet" })[v],
      render: s => renderOptions(s, [
        { value: "north",    label: "Mostly north",   note: "Best case, this one" },
        { value: "eastWest", label: "East and west",  note: "Very common, and it works well" },
        { value: "south",    label: "Mostly south",   note: "Harder, but not a dead end" },
        { value: "unsure",   label: "No idea, sorry",  note: "All good, we'll assume a typical roof" }
      ], "two-up")
    },
    {
      id: "ownership",
      question: "Do you own the place?",
      why: "This one decides what finance you can get, and whether the decision is even yours to make.",
      railLabel: "Ownership",
      railValue: v => ({ mortgage: "Own, with mortgage", outright: "Own outright", renting: "Renting" })[v],
      render: s => renderOptions(s, [
        { value: "mortgage", label: "Yes, with a mortgage", note: "This could open up a low-rate green loan" },
        { value: "outright", label: "Yes, owned outright",  note: "Mortgage-free" },
        { value: "renting",  label: "No, I rent",           note: "" }
      ])
    },
    {
      id: "bank",
      question: "Who's your mortgage with?",
      why: "Every solar green loan going is a top-up on a mortgage you already have with that same bank. So this answer decides whether one is on the table at all.",
      railLabel: "Bank",
      railValue: v => (window.NZ_GREEN_LOANS[v] || {}).bank || v,
      // Counted in the total until we know they don't need it, so the
      // question count never grows on someone mid-flow.
      skip: () => answers.ownership != null && answers.ownership !== "mortgage",
      render: s => renderOptions(s, [
        { value: "anz",      label: "ANZ" },
        { value: "asb",      label: "ASB" },
        { value: "bnz",      label: "BNZ" },
        { value: "westpac",  label: "Westpac" },
        { value: "kiwibank", label: "Kiwibank" },
        { value: "other",    label: "Another bank" }
      ], "two-up")
    },
    {
      id: "equity",
      question: "Roughly how much of the house is yours?",
      why: "Green loans usually want to see about 20% equity. Better you hear that from us now than from a bank in three weeks.",
      railLabel: "Equity",
      railValue: v => ({ "20plus": "20% or more", under20: "Under 20%", unsure: "Not sure" })[v],
      skip: () => answers.ownership != null && answers.ownership !== "mortgage",
      render: s => renderOptions(s, [
        { value: "20plus",  label: "20% or more",  note: "The usual threshold" },
        { value: "under20", label: "Less than 20%" },
        { value: "unsure",  label: "Honestly, no idea" }
      ])
    },
    {
      id: "occupancy",
      question: "Anyone usually home during the day?",
      why: "Power you use while the panels are making it is worth about 27c a unit. Power you sell back is worth about 17c. So this shifts the numbers more than you'd think.",
      railLabel: "Daytime",
      railValue: v => ({ home: "Home during day", mixed: "Sometimes home", out: "Out during day" })[v],
      render: s => renderOptions(s, [
        { value: "home",  label: "Usually someone home", note: "Working from home, shift work, retired, young family" },
        { value: "mixed", label: "Some days, not others", note: "A bit of a mix through the week" },
        { value: "out",   label: "Usually out",          note: "Out at work through the week" }
      ])
    },
    {
      id: "contact",
      question: "Almost there. Where do we send this?",
      why: "Your numbers are on the next screen either way. This is just so " + CFG.client.name + " can walk you through them and check them against your actual roof.",
      render: renderContact
    }
  ];

  const liveSteps = () => STEPS.filter(s => !(s.skip && s.skip()));

  /* --- Rail: the answers so far, as meter readings ------------------------- */
  function renderRail() {
    const rail = $("rail");
    rail.innerHTML = "";
    const recorded = STEPS.filter(s =>
      s.railLabel && answers[s.id] != null && !(s.skip && s.skip())
    );

    if (!recorded.length) {
      const li = el("li", "rail-empty",
        "Seven quick questions. No address, no roof scan, nobody ringing you mid-dinner. Just a real estimate at the end of it.");
      rail.appendChild(li);
      return;
    }
    recorded.forEach(s => {
      const li = el("li", "rail-item");
      li.appendChild(el("span", "rail-label", s.railLabel));
      li.appendChild(el("span", "rail-value", s.railValue(answers[s.id])));
      rail.appendChild(li);
    });
  }

  /* --- Draw the current step ----------------------------------------------- */
  function render() {
    const steps = liveSteps();
    const step = steps[stepIndex];
    const panel = $("panel");
    panel.innerHTML = "";

    $("progress-fill").style.width = ((stepIndex / steps.length) * 100) + "%";

    const wrap = el("div", "question");
    wrap.appendChild(el("p", "eyebrow", "Question " + (stepIndex + 1) + " of " + steps.length));
    const h = el("h2", null, step.question);
    wrap.appendChild(h);
    if (step.why) wrap.appendChild(el("p", "question-why", step.why));
    panel.appendChild(wrap);

    step.render(step, wrap);
    renderRail();
    h.setAttribute("tabindex", "-1");
    if (stepIndex > 0) h.focus({ preventScroll: true });
    reportHeight();
  }

  function advance() {
    // Renting is a graceful dead end: they can't authorise an install.
    if (answers.ownership === "renting") return renderRenterExit();
    const steps = liveSteps();
    if (stepIndex < steps.length - 1) { stepIndex++; render(); }
  }
  function back() { if (stepIndex > 0) { stepIndex--; render(); } }

  /* --- Option list ---------------------------------------------------------- */
  function renderOptions(step, options, layout) {
    const list = el("div", "options" + (layout ? " " + layout : ""));
    options.forEach((opt, i) => {
      const b = el("button", "option");
      b.type = "button";
      b.setAttribute("aria-pressed", String(answers[step.id] === opt.value));
      b.appendChild(el("span", "option-key", String(i + 1)));
      const body = el("div", "option-body");
      body.appendChild(el("span", "option-label", opt.label));
      if (opt.note) body.appendChild(el("span", "option-note", opt.note));
      b.appendChild(body);
      b.addEventListener("click", () => {
        answers[step.id] = opt.value;
        // Changing ownership invalidates the finance answers behind it.
        if (step.id === "ownership" && opt.value !== "mortgage") {
          delete answers.bank; delete answers.equity;
        }
        list.querySelectorAll(".option").forEach(o => o.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        renderRail();
        setTimeout(advance, 140);
      });
      list.appendChild(b);
    });
    step.__panel = list;
    $("panel").querySelector(".question").appendChild(list);
    if (stepIndex > 0) addBack();
  }


  /* --- The map step ---------------------------------------------------------
     Everything here degrades. No imagery key, a blocked request or a dead
     service all end in the same place: a plain address box that still gives
     the installer something useful.
  ------------------------------------------------------------------------- */
  function renderPlace(step) {
    const q = $("panel").querySelector(".question");
    const cfg = CFG.address;
    const hasImagery = !!cfg.linzBasemapsKey;

    if (!answers.place) {
      answers.place = {
        label: "", lat: cfg.defaultCentre.lat, lon: cfg.defaultCentre.lon,
        positioned: false
      };
    }

    const wrap = el("div", "place");

    /* The typed address. Always present, imagery or not: it is the bit the
       installer actually reads. */
    const field = el("div", "field");
    const lab = el("label", null, "Your street address");
    lab.htmlFor = "f-address";
    const input = el("input");
    input.id = "f-address";
    input.type = "text";
    input.autocomplete = "street-address";
    input.placeholder = "12 Example Road, Napier";
    input.value = answers.place.label || "";
    input.addEventListener("input", () => {
      answers.place.label = input.value.trim();
      renderRail();
    });
    field.appendChild(lab);
    field.appendChild(input);
    wrap.appendChild(field);

    const searchCfg = cfg.search || { provider: "off" };

    let map = null;
    if (hasImagery) {
      const mapBox = el("div");
      wrap.appendChild(mapBox);

      const fallback = el("p", "place-note");
      fallback.hidden = true;

      // Declared up here because the map's failure callback hides them.
      let hint = null, locate = null;
      fallback.textContent =
        "The aerial photos are not loading just now. No bother, the address above is all we need.";

      map = window.SolarMap.create(mapBox, {
        lat: answers.place.lat,
        lon: answers.place.lon,
        zoom: answers.place.positioned ? cfg.roofZoom : cfg.defaultCentre.zoom,
        tileUrl: cfg.tileUrlTemplate.replace("{key}", cfg.linzBasemapsKey),
        attribution: cfg.attribution,
        onMove: c => {
          answers.place.lat = c.lat;
          answers.place.lon = c.lon;
          answers.place.positioned = true;
          updateRegionFromPin();
          renderRail();
        },
        onUnavailable: () => {
          mapBox.hidden = true;
          fallback.hidden = false;
          if (hint) hint.hidden = true;
          if (locate) locate.hidden = true;
          reportHeight();
        }
      });

      wrap.appendChild(fallback);

      // Instructions for a map that isn't there just confuse people, so this
      // goes when the map does.
      hint = el("p", "place-note",
        "Drag the photo to line the pin up with your roof. Close enough is close enough.");
      wrap.appendChild(hint);

      if (cfg.offerGeolocation && navigator.geolocation) {
        locate = el("button", "btn-link", "Use my current location");
        locate.type = "button";
        locate.addEventListener("click", () => {
          locate.textContent = "Finding you\u2026";
          navigator.geolocation.getCurrentPosition(
            pos => {
              map.setCentre(pos.coords.latitude, pos.coords.longitude, cfg.roofZoom);
              locate.textContent = "Use my current location";
            },
            () => {
              locate.textContent = "Couldn't find you, just type it above instead";
              locate.disabled = true;
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
        wrap.appendChild(locate);
      }
    }

    q.appendChild(wrap);

    const actions = el("div", "actions");
    const next = el("button", "btn btn-primary", "That's the spot");
    next.type = "button";
    next.addEventListener("click", advance);
    actions.appendChild(next);

    if (!cfg.required) {
      const skip = el("button", "btn-link", "Skip this");
      skip.type = "button";
      skip.addEventListener("click", () => { answers.place = null; advance(); });
      actions.appendChild(skip);
    }
    const backBtn = el("button", "btn-link", "Back");
    backBtn.type = "button";
    backBtn.addEventListener("click", back);
    actions.appendChild(backBtn);
    q.appendChild(actions);

    /* Suggestions, once the map exists so a pick can move it. */
    if (searchCfg.provider && searchCfg.provider !== "off" && window.SolarAddress) {
      window.SolarAddress.attach(input, {
        config: searchCfg,
        onResize: reportHeight,
        onPick: place => {
          answers.place.label = place.label;
          input.value = place.label;

          // A provider that gives coordinates moves the pin. One that does not
          // still fills the address in, which is the part the installer reads.
          if (typeof place.lat === "number" && typeof place.lon === "number") {
            answers.place.lat = place.lat;
            answers.place.lon = place.lon;
            answers.place.positioned = true;
            if (map) map.setCentre(place.lat, place.lon, cfg.roofZoom);
            updateRegionFromPin();
          }
          renderRail();
          reportHeight();
        }
      });
    }

    // Tiles need the container's real size, which it only has once laid out.
    if (map) requestAnimationFrame(() => { map.redraw(); reportHeight(); });
  }

  /* If the installer covers more than one region, the pin answers the region
     question for us and we drop it from the flow. */
  function updateRegionFromPin() {
    if (CFG.region.lockToDefault) return;
    if (!answers.place || !answers.place.positioned) return;
    const r = window.nzRegionFromCoords(answers.place.lat, answers.place.lon);
    if (r) answers.region = r.id;
  }

  /* --- Bill slider ---------------------------------------------------------- */
  function renderBill(step) {
    const q = $("panel").querySelector(".question");
    if (answers.monthlyBill == null) answers.monthlyBill = 280;

    const wrap = el("div", "bill");
    const readout = el("div", "bill-readout mono");
    const setReadout = v => {
      readout.innerHTML = "";
      readout.appendChild(document.createTextNode("$" + v));
      readout.appendChild(el("span", null, "/month"));
    };
    setReadout(answers.monthlyBill);

    const slider = el("input", "bill-slider");
    slider.type = "range";
    slider.min = 80; slider.max = 1000; slider.step = 10;
    slider.value = answers.monthlyBill;
    slider.setAttribute("aria-label", "Average monthly power bill in dollars");
    slider.addEventListener("input", () => {
      answers.monthlyBill = Number(slider.value);
      setReadout(answers.monthlyBill);
      renderRail();
    });

    const scale = el("div", "bill-scale");
    scale.appendChild(el("span", null, "$80"));
    scale.appendChild(el("span", null, "$1,000+"));

    wrap.appendChild(readout);
    wrap.appendChild(slider);
    wrap.appendChild(scale);
    q.appendChild(wrap);

    const actions = el("div", "actions");
    const next = el("button", "btn btn-primary", "Continue");
    next.type = "button";
    next.addEventListener("click", advance);
    actions.appendChild(next);
    q.appendChild(actions);
  }

  function addBack() {
    const q = $("panel").querySelector(".question");
    const actions = el("div", "actions");
    const b = el("button", "btn-link", "Back");
    b.type = "button";
    b.addEventListener("click", back);
    actions.appendChild(b);
    q.appendChild(actions);
  }

  /* --- Renter exit: honest, quick, and not a lead -------------------------- */
  function renderRenterExit() {
    const panel = $("panel");
    panel.innerHTML = "";
    const wrap = el("div", "question");
    wrap.appendChild(el("p", "eyebrow", "One thing first"));
    wrap.appendChild(el("h2", null, "Ah, this one's your landlord's call."));
    const body = el("div", "exit");
    body.appendChild(el("p", null,
      "Panels get bolted to the roof and paid off over years, so it sits with whoever owns the place. There's no version of this where we can quote you directly, and we'd rather tell you that now than take your details and waste your time."));
    body.appendChild(el("p", null,
      "Worth raising with them though, it's a decent pitch: solar lifts a property's value and its Homestar rating, and you'd be the one seeing the smaller bills. Feel free to send them this way."));
    wrap.appendChild(body);

    const actions = el("div", "actions");
    const b = el("button", "btn btn-quiet", "Hang on, I do own this place");
    b.type = "button";
    b.addEventListener("click", () => { delete answers.ownership; render(); });
    actions.appendChild(b);
    wrap.appendChild(actions);
    panel.appendChild(wrap);
    $("progress-fill").style.width = "100%";
    renderRail();
    reportHeight();
  }

  /* --- Contact capture ------------------------------------------------------ */
  function renderContact(step) {
    const q = $("panel").querySelector(".question");
    const form = el("form", "form");
    form.noValidate = true;

    const fields = [
      { name: "firstName", label: "First name",   type: "text",  autocomplete: "given-name",  required: true },
      { name: "lastName",  label: "Last name",    type: "text",  autocomplete: "family-name", required: false },
      { name: "email",     label: "Email",        type: "email", autocomplete: "email",       required: true },
      { name: "phone",     label: "Phone",        type: "tel",   autocomplete: "tel",         required: CFG.leads.requirePhone }
    ];

    fields.forEach(f => {
      const wrap = el("div", "field");
      const id = "f-" + f.name;
      const label = el("label", null, f.label + (f.required ? "" : " (optional)"));
      label.htmlFor = id;
      const input = el("input");
      input.id = id; input.name = f.name; input.type = f.type;
      input.autocomplete = f.autocomplete;
      wrap.appendChild(label);
      wrap.appendChild(input);
      form.appendChild(wrap);
    });

    const err = el("p", "field-error");
    err.hidden = true;
    form.appendChild(err);

    const actions = el("div", "actions");
    const submit = el("button", "btn btn-primary", "Show me the numbers");
    submit.type = "submit";
    actions.appendChild(submit);
    const b = el("button", "btn-link", "Back");
    b.type = "button";
    b.addEventListener("click", back);
    actions.appendChild(b);
    form.appendChild(actions);

    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = {};
      fields.forEach(f => { data[f.name] = form.elements[f.name].value.trim(); });

      const missing = fields.find(f => f.required && !data[f.name]);
      if (missing) return showError(err, "Just need your " + missing.label.toLowerCase() + " so we can get this to you.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
        return showError(err, "That email looks a bit off. Mind giving it another look?");

      err.hidden = true;
      answers.contact = data;
      submit.disabled = true;
      submit.textContent = "Crunching the numbers…";
      finish();
    });

    q.appendChild(form);
    const note = el("p", "form-note",
      "We'll send a copy through to you. " + CFG.client.name + " will be in touch to go over it. No obligation, and we don't pass your details to anyone else.");
    q.appendChild(note);
  }

  function showError(node, message) {
    node.textContent = message;
    node.hidden = false;
    reportHeight();
  }

  /* ==========================================================================
     SUBMIT. Push the lead, fire the tracking, then show the results.
     The results show whether or not the webhook succeeds. Never punish the
     homeowner for our plumbing failing.
     ========================================================================== */
  function finish() {
    const result = window.SolarCalc.run(answers);
    sendLead(result);
    track(result);
    submitted = true;
    renderResults(result);
  }

  function sendLead(result) {
    const payload = {
      first_name: answers.contact.firstName,
      last_name:  answers.contact.lastName,
      email:      answers.contact.email,
      phone:      answers.contact.phone,
      source:     "Solar savings calculator",
      // Where they live. The installer wants this for quoting and routing,
      // and it's the single most useful thing the map step buys them.
      address:      answers.place ? answers.place.label : "",
      latitude:     answers.place && answers.place.positioned ? answers.place.lat.toFixed(6) : "",
      longitude:    answers.place && answers.place.positioned ? answers.place.lon.toFixed(6) : "",
      pin_dropped:  !!(answers.place && answers.place.positioned),
      // Everything the installer needs to pick up the phone already informed.
      monthly_power_bill:   answers.monthlyBill,
      region:               answers.region || CFG.region.default,
      roof_orientation:     answers.orientation,
      ownership:            answers.ownership,
      mortgage_bank:        answers.bank || "",
      equity:               answers.equity || "",
      daytime_occupancy:    answers.occupancy,
      estimated_system_kw:  result.system.kw,
      estimated_panels:     result.panelCount,
      estimated_cost_low:   result.cost.low,
      estimated_cost_high:  result.cost.high,
      estimated_annual_saving: Math.round(result.annualSaving),
      estimated_payback_years: result.payback ? Number(result.payback.toFixed(1)) : null,
      green_loan_eligible:  result.finance.eligible,
      green_loan_product:   result.finance.product || "",
      consent_likely_exempt: result.consent.likelyExempt,
      submitted_at: new Date().toISOString()
    };

    if (!CFG.leads.webhookUrl) {
      console.log("[calculator] No webhookUrl set in config.js. Lead payload:", payload);
      return;
    }
    fetch(CFG.leads.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(err => console.error("[calculator] Lead POST failed:", err));
  }

  function track(result) {
    const value = Math.round(result.cost.mid);
    if (window.fbq) window.fbq("track", "Lead", { value: value, currency: "NZD" });
    if (window.gtag) window.gtag("event", "generate_lead", { value: value, currency: "NZD" });
    // Let a parent page (e.g. a GoHighLevel funnel) fire its own tracking too.
    post({ type: "solar-calculator:lead", value: value });
  }

  /* ==========================================================================
     RESULTS
     ========================================================================== */
  function renderResults(r) {
    $("stage").hidden = true;
    $("progress-fill").style.width = "100%";
    const out = $("results");
    out.hidden = false;
    out.className = "results";
    out.innerHTML = "";

    const name = answers.contact.firstName;
    const worthIt = r.payback && r.payback <= 12;

    /* Verdict */
    const verdict = el("h1", "verdict");
    if (worthIt) {
      verdict.innerHTML = name + ", solar could take <em>" + pct(r.billOffset) +
        "</em> off your power bill.";
    } else {
      verdict.innerHTML = name + ", solar would work here. It's just a <em>long</em> wait to pay off.";
    }
    out.appendChild(verdict);

    const sub = el("p", "verdict-sub");
    sub.textContent = worthIt
      ? "That's about " + money(r.annualSaving) + " a year, from " + r.panelCount +
        " panels up there. Worked out on your bill and your local sunshine, not some national average."
      : "Your bill is modest enough that the system takes a fair while to pay for itself. Here are the honest numbers rather than a sales pitch.";
    out.appendChild(sub);

    /* Headline figures */
    const figures = el("div", "figures");
    [
      { label: "Your system",   value: r.system.kw + " kW",
        note: r.panelCount + " panels, about " + Math.round(r.consent.areaM2) + "m² of your roof" },
      { label: "Installed cost", value: moneyRange(r.cost.low, r.cost.high),
        note: "Incl. GST, and confirmed on site" },
      { label: "Saved per year", value: money(r.annualSaving), cls: "is-gain",
        note: "Year one, and it climbs as power prices do" },
      { label: "Pays for itself", value: years(r.payback), cls: worthIt ? "is-gain" : "is-flag",
        note: "Then " + years(25 - (r.payback || 25)).replace("25+ years", "20+ years") + " of savings" }
    ].forEach(f => {
      const c = el("div", "figure");
      c.appendChild(el("span", "figure-label", f.label));
      c.appendChild(el("span", "figure-value mono " + (f.cls || ""), f.value));
      c.appendChild(el("span", "figure-note", f.note));
      figures.appendChild(c);
    });
    out.appendChild(figures);

    out.appendChild(billSection(r));
    out.appendChild(chartSection(r));
    out.appendChild(detailSection(r));
    out.appendChild(assumptionsSection(r));
    out.appendChild(ctaSection(r));

    const d = el("p", "disclaimer");
    d.textContent = "These are estimates rather than a quote. They come from your power bill, " +
      "local sunshine figures and 2026 New Zealand install pricing, but every roof is its own thing. " +
      CFG.client.name + " will check it all on site before you commit to anything.";
    out.appendChild(d);

    window.scrollTo({ top: 0, behavior: "smooth" });
    reportHeight();
    setTimeout(reportHeight, 700);
  }

  /* Bill comparison bars */
  function billSection(r) {
    const s = el("section", "section");
    s.appendChild(el("h3", null, "What happens to your bill"));
    s.appendChild(el("p", "section-lede",
      "Sitting tight isn't the same as staying put. Power prices here have climbed about 31% in five years. Solar locks most of your cost in at today's rate."));

    const max = Math.max(r.monthlyBillIn10IfNothing, r.monthlyBillBefore, r.monthlyBillAfter);
    const bars = el("div", "bars");
    [
      { label: "Now",                       v: r.monthlyBillBefore,        cls: "is-now" },
      { label: "With solar",                v: r.monthlyBillAfter,         cls: "is-solar" },
      { label: "In 10 years, if you don't", v: r.monthlyBillIn10IfNothing, cls: "is-drift" }
    ].forEach(b => {
      const row = el("div", "bar-row");
      row.appendChild(el("div", "bar-label", b.label));
      const track = el("div", "bar-track");
      const fill = el("div", "bar-fill " + b.cls);
      fill.style.width = "0%";
      requestAnimationFrame(() => { fill.style.width = ((b.v / max) * 100) + "%"; });
      track.appendChild(fill);
      track.appendChild(el("span", "bar-value mono", money(b.v) + "/mo"));
      row.appendChild(track);
      bars.appendChild(row);
    });
    s.appendChild(bars);
    return s;
  }

  /* 25-year cumulative savings chart, drawn as inline SVG */
  function chartSection(r) {
    const s = el("section", "section");
    s.appendChild(el("h3", null, "The next 25 years"));
    s.appendChild(el("p", "section-lede",
      "Your total savings against what you paid. Where the line crosses zero, the system has paid for itself. That dip at year " +
      CFG.assumptions.inverterReplacement.year + " is a replacement inverter, which we count in rather than quietly leave out."));

    const W = 720, H = 280, PAD_L = 62, PAD_R = 16, PAD_T = 18, PAD_B = 34;
    const cost = r.cost.mid;
    const net = r.projection.map(p => p.cumulative - cost);
    const lo = Math.min(-cost, ...net), hi = Math.max(...net, 0);
    const x = i => PAD_L + (i / (net.length - 1)) * (W - PAD_L - PAD_R);
    const y = v => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

    let path = "M " + PAD_L + " " + y(-cost);
    net.forEach((v, i) => { path += " L " + x(i).toFixed(1) + " " + y(v).toFixed(1); });

    const area = path + " L " + x(net.length - 1).toFixed(1) + " " + y(0).toFixed(1) +
                 " L " + PAD_L + " " + y(0).toFixed(1) + " Z";

    const ticks = [lo, (lo + hi) / 2, 0, hi].filter((v, i, a) => a.indexOf(v) === i);
    const svg = [
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cumulative savings over 25 years, breaking even at ' + years(r.payback) + '">',
      '<defs><linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0%" stop-color="var(--brand)" stop-opacity=".22"/>',
      '<stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>',
      '</linearGradient></defs>'
    ];
    ticks.forEach(v => {
      svg.push('<line x1="' + PAD_L + '" x2="' + (W - PAD_R) + '" y1="' + y(v).toFixed(1) +
               '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"' +
               (v === 0 ? '' : ' stroke-dasharray="2 4"') + '/>');
      svg.push('<text x="' + (PAD_L - 10) + '" y="' + (y(v) + 4).toFixed(1) +
               '" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--ink-3)">' +
               (v === 0 ? "$0" : (v < 0 ? "-" : "") + "$" + Math.round(Math.abs(v) / 1000) + "k") + '</text>');
    });
    svg.push('<path d="' + area + '" fill="url(#fillG)"/>');
    svg.push('<path d="' + path + '" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round"/>');

    if (r.payback && r.payback < 25) {
      const px = x(r.payback - 1);
      svg.push('<line x1="' + px.toFixed(1) + '" x2="' + px.toFixed(1) + '" y1="' + PAD_T +
               '" y2="' + (H - PAD_B) + '" stroke="var(--flag)" stroke-width="1" stroke-dasharray="3 3"/>');
      svg.push('<circle cx="' + px.toFixed(1) + '" cy="' + y(0).toFixed(1) +
               '" r="4.5" fill="var(--flag)"/>');
      svg.push('<text x="' + (px + 9).toFixed(1) + '" y="' + (PAD_T + 14) +
               '" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--flag)">Paid off · ' +
               years(r.payback) + '</text>');
    }
    [1, 5, 10, 15, 20, 25].forEach(yr => {
      svg.push('<text x="' + x(yr - 1).toFixed(1) + '" y="' + (H - 12) +
               '" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--ink-3)">' +
               (yr === 1 ? "Yr 1" : yr) + '</text>');
    });
    svg.push('</svg>');

    const wrap = el("div", "chart-wrap");
    wrap.innerHTML = svg.join("");
    s.appendChild(wrap);

    const legend = el("div", "chart-legend");
    legend.innerHTML =
      '<span><i class="swatch" style="background:var(--brand)"></i>Money ahead, after paying for the system</span>' +
      '<span><i class="swatch" style="background:var(--flag)"></i>Break-even point</span>';
    s.appendChild(legend);

    const total = el("p", "section-lede");
    total.style.marginTop = "1.1rem";
    total.textContent = "Over 25 years that's somewhere around " +
      moneyRange(r.savings25.low, r.savings25.high) +
      " back in your pocket, and that's after the system and a new inverter are paid for.";
    s.appendChild(total);
    return s;
  }

  /* Finance + consent */
  function detailSection(r) {
    const s = el("section", "section");
    s.appendChild(el("h3", null, "Paying for it, and the paperwork"));
    const cards = el("div", "cards");

    /* --- Finance --- */
    const fin = el("div", "card");
    const f = r.finance;
    if (f.eligible && f.kind === "loan") {
      fin.className = "card is-good";
      fin.appendChild(pill("Looks like you qualify", "is-good"));
      fin.appendChild(el("h4", null, f.product));
      fin.appendChild(el("div", "card-figure mono", money(f.monthly) + "/month"));
      fin.appendChild(el("p", null,
        (f.rate === 0 ? "At 0% interest" : "At " + (f.rate * 100) + "% interest") +
        " over " + f.termYears + " years on " + money(f.borrowed) + ". " +
        "Your monthly saving of " + money(r.annualSaving / 12) +
        (r.annualSaving / 12 >= f.monthly
          ? " more than covers that repayment from day one."
          : " covers a good chunk of it, so you'd be out of pocket about " +
            money(f.monthly - r.annualSaving / 12) + " a month until it's paid off.") +
        seanzLine(f)));
    } else if (f.eligible && f.kind === "cashback") {
      fin.className = "card is-good";
      fin.appendChild(pill("Looks like you qualify", "is-good"));
      fin.appendChild(el("h4", null, f.product));
      fin.appendChild(el("div", "card-figure mono", money(f.cashback)));
      fin.appendChild(el("p", null,
        f.bank + " do a " + money(f.cashback) + " cashback on solar rather than a cheaper rate, so you'd be on standard rates for the rest." +
        seanzLine(f)));
    } else {
      fin.appendChild(pill("No green loan", "is-warn"));
      fin.appendChild(el("h4", null, "How you'd pay for it"));
      fin.appendChild(el("p", null, f.reason));
    }
    cards.appendChild(fin);

    /* --- Consent --- */
    const con = el("div", "card");
    const c = r.consent;
    if (c.likelyExempt) {
      con.className = "card is-good";
      con.appendChild(pill("Likely no consent", "is-good"));
      con.appendChild(el("h4", null, "You probably won't need building consent"));
      con.appendChild(el("div", "card-figure mono", Math.round(c.areaM2) + "m²"));
      con.appendChild(el("p", null,
        "Since October 2025 most home solar installs don't need consent, as long as the panels cover under " +
        c.limitM2 + "m², the property sits in a standard wind zone, and the panels go on flush or on standard frames. " +
        "Yours comes to " + Math.round(c.areaM2) + "m². That saves you roughly " +
        moneyRange(window.NZ_CONSENT.savingLow, window.NZ_CONSENT.savingHigh) +
        " and several weeks. " + CFG.client.name + " will confirm your wind zone."));
    } else {
      con.appendChild(pill("Consent likely", "is-warn"));
      con.appendChild(el("h4", null, "This one probably does need consent"));
      con.appendChild(el("div", "card-figure mono", Math.round(c.areaM2) + "m²"));
      con.appendChild(el("p", null,
        "The October 2025 exemption covers installs under " + c.limitM2 +
        "m² of panels, and at " + Math.round(c.areaM2) + "m² yours goes over. So put aside another " +
        moneyRange(window.NZ_CONSENT.savingLow, window.NZ_CONSENT.savingHigh) +
        " and a few extra weeks. A slightly smaller system might duck under the line, which is worth asking about."));
    }
    cards.appendChild(con);

    s.appendChild(cards);
    return s;
  }

  /* ANZ and Kiwibank only lend against a SEANZ-accredited installer. If this
     client is accredited that's worth saying out loud; if they aren't, the
     homeowner needs the warning. */
  function seanzLine(f) {
    if (!f.seanz) return "";
    return CFG.client.seanzAccredited
      ? " " + f.bank + " only lend on installs by a SEANZ-accredited installer, and " +
        CFG.client.name + " are accredited, so that box is already ticked."
      : " " + f.bank + " require a SEANZ-accredited installer, so check that first.";
  }

  function pill(text, cls) {
    return el("span", "pill " + (cls || ""), text);
  }

  /* Show the working. Costs nothing and answers the sceptics. */
  function assumptionsSection(r) {
    const d = el("details", "assumptions");
    const sum = el("summary", null, "Want to see our working? Every number we used");
    d.appendChild(sum);
    const a = CFG.assumptions;
    const rows = [
      ["Your power use, worked back from your bill", Math.round(r.usageKwh).toLocaleString("en-NZ") + " kWh/yr"],
      ["Used during daylight, when panels are working", Math.round(r.daytimeKwh).toLocaleString("en-NZ") + " kWh/yr"],
      ["What this system generates in year one", Math.round(r.generation).toLocaleString("en-NZ") + " kWh/yr"],
      ["Of that, used in your home rather than exported", pct(r.selfConsumptionRate)],
      ["Power you buy", (a.buyRatePerKwh * 100).toFixed(1) + "c/kWh"],
      ["Power you sell back", (a.sellRatePerKwh * 100).toFixed(0) + "c/kWh"],
      ["Daily fixed line charge", "$" + a.dailyFixedCharge.toFixed(2) + "/day"],
      ["Power price rises, per year", pct(a.electricityInflation)],
      ["Sunshine here", Math.round(r.yieldPerKw) + " kWh per kW installed"],
      ["Panel output lost per year", (a.panelDegradationPerYear * 100).toFixed(1) + "%"],
      ["Replacement inverter, year " + a.inverterReplacement.year, money(a.inverterReplacement.cost)]
    ];
    const table = el("table");
    rows.forEach(([k, v]) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, k));
      tr.appendChild(el("td", null, v));
      table.appendChild(tr);
    });
    d.appendChild(table);
    d.addEventListener("toggle", reportHeight);
    return d;
  }

  function ctaSection(r) {
    const s = el("section", "cta");
    s.appendChild(el("h3", null, "Want someone to check these on your actual roof?"));
    const p = el("p", null,
      CFG.client.proofPoint ? CFG.client.proofPoint :
      CFG.client.name + " will confirm the estimate on site, at no cost.");
    s.appendChild(p);
    s.appendChild(el("p", null,
      "We've sent a copy to " + answers.contact.email + ", so it's yours to keep. Someone will be in touch to talk it through."));

    const actions = el("div", "cta-actions");
    if (CFG.client.phone) {
      const call = el("a", "btn btn-primary", "Call " + CFG.client.phone);
      call.href = "tel:" + CFG.client.phone.replace(/\s/g, "");
      actions.appendChild(call);
    }
    if (CFG.client.website) {
      const site = el("a", "btn btn-quiet", "Visit " + CFG.client.name);
      site.href = CFG.client.website;
      site.target = "_blank";
      site.rel = "noopener";
      actions.appendChild(site);
    }
    s.appendChild(actions);
    return s;
  }

  /* ==========================================================================
     IFRAME SUPPORT
     The page tells its parent how tall it is, so a GoHighLevel funnel can
     resize the iframe instead of showing an inner scrollbar.
     ========================================================================== */
  function post(msg) {
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage(msg, "*"); } catch (e) {}
    }
  }
  let lastHeight = 0;
  function reportHeight() {
    requestAnimationFrame(() => {
      const h = Math.ceil(document.body.scrollHeight);
      if (Math.abs(h - lastHeight) < 2) return;
      lastHeight = h;
      post({ type: "solar-calculator:height", height: h });
    });
  }

  /* --- Ad tracking pixels, loaded from config ------------------------------ */
  function loadTracking() {
    const t = CFG.tracking;
    if (t.metaPixelId) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq("init", t.metaPixelId);
      window.fbq("track", "PageView");
    }
    if (t.ga4MeasurementId) {
      const g = document.createElement("script");
      g.async = true;
      g.src = "https://www.googletagmanager.com/gtag/js?id=" + t.ga4MeasurementId;
      document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", t.ga4MeasurementId);
    }
  }

  /* --- Go -------------------------------------------------------------------- */
  applyBrand();
  renderMasthead();
  loadTracking();
  if (CFG.region.lockToDefault) answers.region = CFG.region.default;
  render();
  window.addEventListener("resize", reportHeight);
})();
