/* ============================================================================
   NZ DATA. Shared across every client. You shouldn't need to touch this
   unless NZ rules or prices change. If a bank changes its green loan, this
   is the one place to fix it and every client gets the update.
   ============================================================================ */

/* --- SOLAR YIELD BY REGION ---------------------------------------------------
   kWh generated per year, per kW of panels installed, on a good north roof.

   >>> PLACEHOLDER DATA. TIM, REPLACE THIS WITH YOUR REAL TABLE. <<<
   These are estimates in the right ballpark and in the order you gave me
   (Wellington top, then New Plymouth, Blenheim, Auckland), but the exact
   figures are guesses and every savings number on the page depends on them.
   Send me your table and this becomes a 2-minute fix.
--------------------------------------------------------------------------- */
window.NZ_REGIONS = [
  { id: "northland",     name: "Northland",           yield: 1270,
    points: [[-35.72, 174.32], [-35.11, 173.26]] },
  { id: "auckland",      name: "Auckland",            yield: 1290,
    points: [[-36.85, 174.76], [-37.21, 174.90]] },
  { id: "waikato",       name: "Waikato / Hamilton",  yield: 1230,
    points: [[-37.79, 175.28], [-38.69, 176.07], [-37.65, 175.16]] },
  { id: "bay-of-plenty", name: "Bay of Plenty",       yield: 1280,
    points: [[-37.69, 176.17], [-38.14, 176.25]] },
  { id: "gisborne",      name: "Gisborne",            yield: 1275,
    points: [[-38.66, 178.02]] },
  { id: "hawkes-bay",    name: "Hawke's Bay",         yield: 1285,
    points: [[-39.49, 176.91], [-39.64, 176.85]] },
  { id: "taranaki",      name: "Taranaki",            yield: 1320,
    points: [[-39.06, 174.08], [-39.50, 174.28]] },
  { id: "manawatu",      name: "Manawat\u016b / Whanganui", yield: 1240,
    points: [[-40.35, 175.61], [-39.93, 175.05], [-40.75, 175.15]] },
  { id: "wellington",    name: "Wellington",          yield: 1340,
    points: [[-41.29, 174.78], [-41.13, 175.07], [-40.95, 175.66]] },
  { id: "nelson",        name: "Nelson",              yield: 1300,
    points: [[-41.27, 173.28], [-41.50, 172.83]] },
  { id: "marlborough",   name: "Marlborough",         yield: 1310,
    points: [[-41.51, 173.95]] },
  { id: "canterbury",    name: "Canterbury",          yield: 1250,
    points: [[-43.53, 172.63], [-44.40, 171.25], [-42.40, 173.68], [-43.90, 170.47]] },
  { id: "otago",         name: "Otago",               yield: 1210,
    points: [[-45.87, 170.50], [-45.03, 168.66], [-44.70, 169.14], [-45.10, 170.97]] },
  { id: "southland",     name: "Southland",           yield: 1120,
    points: [[-46.41, 168.35], [-46.10, 168.94], [-45.42, 167.72]] }
];

/* Work out which region a dropped map pin sits in, by finding the nearest
   listed town. Several regions need more than one point: nearest-to-Dunedin
   would put Queenstown in Southland, which is both wrong and a worse
   sunshine figure. Still crude near a boundary, but it only picks a sunshine
   number, and neighbouring regions have similar ones. Saving the question is
   worth more than the last few percent of precision.
   Only used when the map step is on and the installer covers more than one
   region. */
window.nzRegionFromCoords = function (lat, lon) {
  var best = null, bestDist = Infinity;
  window.NZ_REGIONS.forEach(function (r) {
    r.points.forEach(function (pt) {
      // Flat approximation, corrected for longitude converging toward the
      // pole. Plenty accurate over a country this size and far cheaper than
      // a proper great-circle distance.
      var dLat = pt[0] - lat;
      var dLon = (pt[1] - lon) * Math.cos(lat * Math.PI / 180);
      var d = dLat * dLat + dLon * dLon;
      if (d < bestDist) { bestDist = d; best = r; }
    });
  });
  return best;
};

/* --- INSTALLED PRICING (incl. GST), 2026 NZ rates -------------------------
   Straight from your brief. If an installer gives you their own pricing,
   copy this shape into pricingOverride in config.js.
   Note: your 8kW and 10kW figures are identical ($15k–$18k). Left as given,
   but worth a sanity check with an installer, since I'd expect 10kW to be dearer.
--------------------------------------------------------------------------- */
window.NZ_SYSTEM_PRICING = [
  { kw: 3.0,  low:  8000, high: 10000 },
  { kw: 5.0,  low: 11000, high: 13000 },
  { kw: 6.6,  low: 14000, high: 15000 },
  { kw: 8.0,  low: 15000, high: 18000 },
  { kw: 10.0, low: 15000, high: 18000 },
  { kw: 13.0, low: 20000, high: 30000 }
];

/* --- BANK GREEN LOANS -----------------------------------------------------
   IMPORTANT: every one of these is a TOP-UP ON AN EXISTING MORTGAGE with
   that specific bank. Outright owners and renters do NOT qualify for any of
   them. The tool must never imply otherwise, because that's the fastest way to make
   an installer look dishonest.
--------------------------------------------------------------------------- */
window.NZ_GREEN_LOANS = {
  anz: {
    bank: "ANZ", product: "ANZ Good Energy Home Loan",
    kind: "loan", rate: 0.01, termYears: 3, cap: 80000,
    minEquity: 0.20, requiresSeanzInstaller: true
  },
  asb: {
    bank: "ASB", product: "ASB Better Homes Top Up",
    kind: "loan", rate: 0.01, termYears: 3, cap: 80000,
    minEquity: 0.20, requiresSeanzInstaller: false
  },
  bnz: {
    bank: "BNZ", product: "BNZ Green Home Loan top-up",
    kind: "loan", rate: 0.01, termYears: 3, cap: 80000,
    minEquity: 0.20, requiresSeanzInstaller: false
  },
  westpac: {
    bank: "Westpac", product: "Westpac Greater Choices Home Loan",
    kind: "loan", rate: 0.00, termYears: 5, cap: 50000,
    minEquity: 0.20, requiresSeanzInstaller: false
  },
  kiwibank: {
    bank: "Kiwibank", product: "Kiwibank Sustainable Energy Loan",
    kind: "cashback", cashback: 2000,
    minEquity: 0.20, requiresSeanzInstaller: true
  },
  other: { bank: "Another bank", kind: "none" }
};

/* --- BUILDING CONSENT -----------------------------------------------------
   Since October 2025 most residential installs no longer need consent if:
     - total panel area is under 40m²
     - the property is in a standard wind zone
     - it's on an existing building
     - panels are flush-mounted or on standard tilt frames
   We can only check the panel area from what we ask, so everything the tool
   says here is phrased as "likely", with the installer confirming.
--------------------------------------------------------------------------- */
window.NZ_CONSENT = {
  exemptAreaM2: 40,
  savingLow: 1000,
  savingHigh: 2000
};
