/* ============================================================================
   CONFIG — THIS IS THE ONLY FILE YOU EDIT FOR A NEW CLIENT.
   Copy the whole project folder, change the values below, deploy. Done.
   Everything else (the NZ data, the maths, the design) is shared.
   ============================================================================ */

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
    proofPoint: "200+ solar arrays installed across Hawke's Bay, fitted by Isaac's Electrical \u2014 the region's electrical specialists since 1993."
  },

  /* --- Their brand colour. Two values, used everywhere. --- */
  brand: {
    // >>> PROVISIONAL. Tim: send me Solar Colab's real hex codes (or just a
    // screenshot of their site) and this becomes a 30-second fix. Their site
    // and CDN are blocked from where I'm running, so I couldn't read them. <<<
    accent:     "#17734A",  // on light backgrounds
    accentDark: "#3FB37A"   // on dark backgrounds - needs to stay readable
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
    // Leave blank while testing — the form will still work and log to the browser console.
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
     ASSUMPTIONS — the numbers behind every figure the homeowner sees.
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

    // SELF-CONSUMPTION — the most important assumption in the whole tool.
    // Power used in the house as it's generated is worth the full 27c buy
    // rate. Power exported is worth 17c. So payback moves on this more than
    // on anything else.
    //
    // We DON'T size the system to cover their whole bill. A big power user
    // sized that way ends up with an oversized array exporting cheap power,
    // which makes payback worse, not better. Instead we size to what the
    // house can actually absorb during daylight — which is how installers
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

    // Solar output and household demand never line up perfectly — the sun
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
