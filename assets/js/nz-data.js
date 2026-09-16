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
  { id: "northland",     name: "Northland",           yield: 1270 },
  { id: "auckland",      name: "Auckland",            yield: 1290 },
  { id: "waikato",       name: "Waikato / Hamilton",  yield: 1230 },
  { id: "bay-of-plenty", name: "Bay of Plenty",       yield: 1280 },
  { id: "gisborne",      name: "Gisborne",            yield: 1275 },
  { id: "hawkes-bay",    name: "Hawke's Bay",         yield: 1285 },
  { id: "taranaki",      name: "Taranaki",            yield: 1320 },
  { id: "manawatu",      name: "Manawatū / Whanganui",yield: 1240 },
  { id: "wellington",    name: "Wellington",          yield: 1340 },
  { id: "nelson",        name: "Nelson",              yield: 1300 },
  { id: "marlborough",   name: "Marlborough",         yield: 1310 },
  { id: "canterbury",    name: "Canterbury",          yield: 1250 },
  { id: "otago",         name: "Otago",               yield: 1210 },
  { id: "southland",     name: "Southland",           yield: 1120 }
];

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
