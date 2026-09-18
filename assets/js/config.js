/* ============================================================================
   CONFIG. THIS IS THE ONLY FILE YOU EDIT FOR A NEW CLIENT.
   Copy the whole project folder, change the values below, deploy. Done.
   Everything else (the NZ data, the maths, the design) is shared.
   ============================================================================ */

/* Builds a LINZ Data Service WFS query for one address field. Declared out
   here because the config below uses it four times over. */
function wfs(field) {
  return "https://data.linz.govt.nz/services;key={key}/wfs" +
         "?service=WFS&version=2.0.0&request=GetFeature" +
         "&typeNames=layer-{layer}&outputFormat=application/json" +
         "&count={count}&srsName=EPSG:4326" +
         "&cql_filter=" + field + "+ILIKE+%27{query}%25%27";
}

window.SOLAR_CONFIG = {

  /* --- The installer's details. Shown in the header and on the results page. --- */
  client: {
    name:     "Solar Colab",
    tagline:  "Servicing Napier, Hastings & Havelock North",
    phone:    "0800 726 522",
    email:    "",                       // Tim: fill in their enquiries address
    website:  "https://solarcolab.co.nz",

    // Their Webflow-hosted wordmark. Loads straight from their CDN, so it
    // stays in sync if they ever update it.
    logoUrl:     "https://cdn.prod.website-files.com/641b84915881276efe9a7512/6758fd65a6b5095e3fc7bf93_Solar%20Colab%20RGB%20Hero%20logo.Black.png",
    logoUrlDark: "",                    // A white/reversed logo for dark mode, if they have one.

    // Shown on the results page as the reason to trust the quote.
    proofPoint: "200+ solar arrays installed across Hawke's Bay, fitted by Isaac's Plumbing & Electrical, the region's electrical specialists for over 30 years.",

    // Is this installer SEANZ-accredited? ANZ and Kiwibank both require it
    // for their green loans, so this flips the finance card from a caveat
    // ("they require an accredited installer") into a selling point
    // ("we're accredited, so you're covered").
    // Solar Colab display the SEANZ member mark on their site.
    seanzAccredited: true
  },

  /* --- Their brand colour. -----------------------------------------------
     Solar Colab run golden yellow on warm charcoal and cream. Yellow is a
     FILL colour, not a text colour. Yellow text on a pale background is
     unreadable, so the page darkens it automatically wherever it needs to
     be read as text. You only set the fill.
     >>> Eyeballed off a screenshot of their site. If they have a brand
         guide with exact hex codes, drop them in here. <<<                */
  brand: {
    accent:     "#F4A81C",  // the fill: buttons, progress bar, chart, highlights
    accentDark: "#FDB833",  // slightly brighter, for dark mode
    onAccent:   "#2B2B2B"   // text sitting ON the yellow. Their site uses near-black.
  },

  /* --- Their fonts. ---------------------------------------------------------
     Any font on Google Fonts (fonts.google.com) works. Just type the family
     name exactly as it appears there. The page builds the load URL itself.

     Three roles:
       display: the big headings and the question text
       body:    everything else, including subheadings at the bold weight
       mono:    every number. Leave this alone unless you've a good reason;
                 a monospaced face is what makes the figures read like a
                 meter reading rather than marketing.

     If a client uses a licensed font that ISN'T on Google Fonts, put the
     stylesheet URL their foundry gives you in customCssUrl and name the
     family above. See README for how to handle a font supplied as files.  */
  fonts: {
    display: { family: "Baloo 2",       weights: [500, 600, 700] },
    body:    { family: "Inter",         weights: [400, 600, 700] },
    mono:    { family: "IBM Plex Mono", weights: [400, 500] },
    customCssUrl: ""
  },

  /* --- The map step. --------------------------------------------------------
     Shows the homeowner an aerial photo of their place and asks them to drag
     it so the pin sits on their roof.

     It does NOT make the estimate more accurate. Their power bill drives
     system size far more than the roof does. What it does do is make the tool
     feel like it's about their actual house, and it hands the installer an
     address and a set of coordinates with every lead, which is worth real
     money to them for quoting and routing.

     To turn it on you need a free LINZ Basemaps key from
     https://basemaps.linz.govt.nz (sign in, create a key, paste it below).
     Without a key the step quietly becomes a plain address box, so nothing
     breaks if you leave this off.                                          */
  address: {
    enabled: true,

    // Free from basemaps.linz.govt.nz. Leave blank to skip the imagery and
    // just collect a typed address.
    linzBasemapsKey: "",

    // The imagery tiles. {z}/{x}/{y} get filled in as the map moves, and
    // {key} is your key above. Only change this if LINZ change their URL
    // format or you want a different imagery set.
    tileUrlTemplate:
      "https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api={key}",
    attribution: "Imagery \u00a9 LINZ Basemaps, CC BY 4.0",

    // Where the map opens before they've found themselves. Set this to the
    // middle of the installer's patch. This is Napier.
    defaultCentre: { lat: -39.4928, lon: 176.9120, zoom: 13 },

    // The zoom we jump to once they've said "that's my place".
    roofZoom: 19,

    // Offer the "use my location" button. Phones handle this well and it
    // saves a lot of typing, but it does trigger a browser permission prompt.
    offerGeolocation: true,

    /* Address suggestions as they type. Picking one moves the map to it.
       Set provider to "off" to just let people type.

       "linz"   Free, New Zealand only. Needs a key from data.linz.govt.nz,
                which is a DIFFERENT key from the Basemaps imagery one above.
       "google" A few dollars per thousand lookups, but it handles half-typed
                and misspelled addresses far better, which on paid traffic
                usually pays for itself.

       If the provider is missing or down, suggestions quietly stop and the
       box goes back to being a plain text field.                          */
    search: {
      provider: "linz",          // "linz", "google" or "off"

      // From data.linz.govt.nz. This is a DIFFERENT key from the Basemaps
      // imagery one above, from a different LINZ service. Easy to mix up.
      linzDataKey: "",
      linzLayerId: "123113",     // NZ Addresses, the 2.4M point layer

      /* Their exact query format could not be confirmed when this was built,
         so the calculator tries these in order on the first search and keeps
         whichever works. If LINZ tell you the right one, delete the rest. */
      linzUrlTemplates: [
        // The field holding the whole address is the remaining unknown, so
        // these vary it. The first that returns addresses is kept and the
        // others are never tried again.
        wfs("full_address"),
        wfs("full_address_ascii"),
        wfs("address"),
        wfs("full_road_name")
      ],

      googleApiKey: "",

      minCharacters: 4,
      maxResults: 6,
      debounceMs: 250,

      /* Shows a short line under the address box saying whether suggestions
         are working and, if not, why. Useful while setting a client up.
         Turn this off before the page goes in front of real traffic. */
      debug: true
    },

    // Make them position the pin before continuing. Leave false. An address
    // is nice to have, and never worth losing a lead over.
    required: false
  },

  /* --- Region --- */
  region: {
    default: "hawkes-bay",
    // Set to true if this installer only services one region and you want to
    // skip the region question entirely (one less step = better conversion).
    // Solar Colab only service Hawke's Bay, so we skip the region question
    // entirely. One less step is one less place to lose a lead.
    lockToDefault: true
  },

  /* --- Where the lead goes. --- */
  leads: {
    // Paste the installer's GoHighLevel *Inbound Webhook* URL here.
    // GHL: Automation > Workflows > new workflow > trigger "Inbound Webhook" > copy URL.
    // Leave blank while testing. The form will still work and log to the browser console.
    webhookUrl: "",
    requirePhone: true
  },

  /* --- Ad tracking. Leave blank if not using. --- */
  tracking: {
    metaPixelId:      "",   // e.g. "1234567890"
    ga4MeasurementId: ""    // e.g. "G-XXXXXXXXXX"
  },

  /* --- Their own install pricing, if they've given it to you. ---
     Leave as null to use the shared NZ pricing table in nz-data.js.
     To override, copy the shape from NZ_SYSTEM_PRICING in nz-data.js. */
  pricingOverride: null,

  /* ==========================================================================
     ASSUMPTIONS. The numbers behind every figure the homeowner sees.
     These are the ones worth arguing about. Change a number here and every
     result on the page changes with it.
     ========================================================================== */
  assumptions: {

    // What a homeowner PAYS per unit of power, and what they GET paid for
    // power they export back to the grid. Buy rate is the NZ average; sell
    // rate is a typical solar-plan buyback.
    buyRatePerKwh:  0.2711,
    sellRatePerKwh: 0.17,

    // Daily fixed line charge. We subtract this before working out how many
    // units they actually use, otherwise we'd overestimate their usage.
    dailyFixedCharge: 1.80,

    // How fast power prices rise. NZ prices rose ~31% over the last 5 years,
    // which is about 5.5%/year. We deliberately use 3% so the savings figure
    // is conservative and defensible if a homeowner challenges it.
    electricityInflation: 0.03,

    // Panel hardware. 440W panels are the current standard; ~1.95m² each.
    panelWatts:   440,
    panelAreaM2:  1.95,

    // SELF-CONSUMPTION. The most important assumption in the whole tool.
    // Power used in the house as it's generated is worth the full 27c buy
    // rate. Power exported is worth 17c. So payback moves on this more than
    // on anything else.
    //
    // We DON'T size the system to cover their whole bill. A big power user
    // sized that way ends up with an oversized array exporting cheap power,
    // which makes payback worse, not better. Instead we size to what the
    // house can actually absorb during daylight, which is how installers
    // size in practice, and it lands us in the same place Solar Scout got
    // to on the same inputs.
    //
    // daytimeUsageShare: how much of a year's power gets used in daylight.
    // >>> Tim: these are my estimates. Confirm with Solar Colab. <<<
    daytimeUsageShare: {
      home:  0.45,   // someone home during the day
      mixed: 0.35,   // sometimes home
      out:   0.25    // out all day
    },

    // Solar output and household demand never line up perfectly. The sun
    // peaks at midday, the kettle doesn't. This discounts for that mismatch.
    solarLoadMatch: 0.85,

    // How much a roof loses compared to a perfect north-facing roof.
    orientationFactor: {
      north:    1.00,
      eastWest: 0.87,
      south:    0.65,
      // When they don't know, assume something between north and east-west
      // rather than the best case. Better to under-promise.
      unsure:   0.93
    },

    // Panels lose about 0.5% output per year.
    panelDegradationPerYear: 0.005,

    // Inverters don't last 25 years. Counting this makes the numbers honest
    // and is a good answer when a homeowner asks "what's the catch".
    inverterReplacement: { year: 13, cost: 2500 },

    // How far out we project savings.
    analysisYears: 25
  }
};
