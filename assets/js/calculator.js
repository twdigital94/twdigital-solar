/* ============================================================================
   THE MATHS. Pure calculation, no page/design code.

   The chain, in plain English:
     bill  ->  units used  ->  system size  ->  power generated
           ->  how much they use vs export  ->  savings  ->  payback
   ============================================================================ */

window.SolarCalc = (function () {

  const A = () => window.SOLAR_CONFIG.assumptions;

  /* Work backwards from a power bill to how many units (kWh) they use a year.
     We take the fixed daily line charge off first, because that part of the
     bill has nothing to do with how much power they use, and solar won't
     touch it either. */
  function annualUsageKwh(monthlyBill) {
    const a = A();
    const annualBill = monthlyBill * 12;
    const fixed = a.dailyFixedCharge * 365;
    const variable = Math.max(annualBill - fixed, 0);
    return variable / a.buyRatePerKwh;
  }

  /* How many units a 1kW system makes here, on this roof. */
  function yieldPerKw(regionId, orientation) {
    const region = window.NZ_REGIONS.find(r => r.id === regionId) || window.NZ_REGIONS[0];
    return region.yield * A().orientationFactor[orientation];
  }

  /* How much of a year's power this household uses in daylight: the load
     solar can actually serve without a battery. */
  function daytimeLoadKwh(usageKwh, occupancy) {
    return usageKwh * A().daytimeUsageShare[occupancy];
  }

  /* Pick a system size. We size to the daylight load, NOT to the whole bill.
     Sizing to the whole bill on a big power user produces an oversized array
     that dumps cheap power back to the grid and pays back slower. Then snap
     to the nearest real-world size we have pricing for. */
  function chooseSystem(daytimeKwh, perKw) {
    const a = A();
    const idealKw = daytimeKwh / perKw;
    const table = window.SOLAR_CONFIG.pricingOverride || window.NZ_SYSTEM_PRICING;

    let best = table[0];
    let bestGap = Infinity;
    for (const row of table) {
      const gap = Math.abs(row.kw - idealKw);
      if (gap < bestGap) { bestGap = gap; best = row; }
    }
    return best;
  }

  /* Amortised monthly repayment. At 0% it's just the amount divided by the
     number of months. */
  function monthlyRepayment(principal, annualRate, years) {
    const n = years * 12;
    if (annualRate === 0) return principal / n;
    const r = annualRate / 12;
    return (principal * r) / (1 - Math.pow(1 + r, -n));
  }

  /* Work out what finance, if any, this person can actually get.
     Deliberately strict: no mortgage with that bank, or under 20% equity,
     means no green loan. We say so plainly rather than dangling a rate. */
  function finance(answers, systemCost) {
    const noLoan = { eligible: false };

    if (answers.ownership !== "mortgage") {
      return Object.assign({}, noLoan, {
        reason: answers.ownership === "outright"
          ? "Green loans are top-ups on a mortgage you already have, so owning the place outright rules them out. Cash or an installer finance plan are your options."
          : "Green loans need a mortgage to top up."
      });
    }

    const loan = window.NZ_GREEN_LOANS[answers.bank];
    if (!loan || loan.kind === "none") {
      return Object.assign({}, noLoan, {
        reason: "Your bank doesn't do a solar green loan at the moment. Still worth asking, and most installers have their own finance too."
      });
    }

    if (answers.equity !== "20plus") {
      return Object.assign({}, noLoan, {
        bank: loan.bank,
        reason: answers.equity === "under20"
          ? loan.bank + " green loans want about 20% equity in the place. Under that, you'd be looking at cash or installer finance."
          : loan.bank + " green loans want about 20% equity, so worth checking where you're at before counting on it."
      });
    }

    if (loan.kind === "cashback") {
      return {
        eligible: true, kind: "cashback", bank: loan.bank,
        product: loan.product, cashback: loan.cashback,
        seanz: loan.requiresSeanzInstaller
      };
    }

    const borrowed = Math.min(systemCost, loan.cap);
    return {
      eligible: true, kind: "loan", bank: loan.bank, product: loan.product,
      rate: loan.rate, termYears: loan.termYears, cap: loan.cap,
      borrowed: borrowed,
      monthly: monthlyRepayment(borrowed, loan.rate, loan.termYears),
      seanz: loan.requiresSeanzInstaller
    };
  }

  /* Consent check. All we can honestly test from our questions is panel
     area, so this is always framed as "likely" and the installer confirms. */
  function consent(panelCount) {
    const a = A();
    const area = panelCount * a.panelAreaM2;
    return {
      areaM2: area,
      likelyExempt: area < window.NZ_CONSENT.exemptAreaM2,
      limitM2: window.NZ_CONSENT.exemptAreaM2
    };
  }

  /* Project savings year by year, so we can find the payback point and draw
     the chart. Each year: panels degrade slightly, power prices rise, and we
     subtract the inverter replacement when it falls due. */
  function project(generationYearOne, daytimeKwh, systemCost) {
    const a = A();
    const years = [];
    let cumulative = 0;
    let payback = null;

    for (let y = 1; y <= a.analysisYears; y++) {
      const degraded = generationYearOne * Math.pow(1 - a.panelDegradationPerYear, y - 1);

      // They can only use what they generate, and only up to their daylight
      // demand. Everything above that gets exported at the lower rate.
      const selfUsed = Math.min(degraded, daytimeKwh) * a.solarLoadMatch;
      const exported = Math.max(degraded - selfUsed, 0);

      // Power they buy gets dearer each year, which makes the power they
      // DON'T buy worth more. We hold the export rate flat, because buyback rates
      // have not tracked retail prices, and assuming they would overstates
      // the case.
      const buyRate = a.buyRatePerKwh * Math.pow(1 + a.electricityInflation, y - 1);
      let saving = selfUsed * buyRate + exported * a.sellRatePerKwh;

      let inverter = 0;
      if (y === a.inverterReplacement.year) {
        inverter = a.inverterReplacement.cost;
        saving -= inverter;
      }

      const before = cumulative;
      cumulative += saving;

      // The year the total savings overtake what they paid. We interpolate
      // so we can say "9.5 years" rather than jumping from 9 to 10.
      if (payback === null && cumulative >= systemCost) {
        const through = (systemCost - before) / (cumulative - before);
        payback = (y - 1) + through;
      }

      years.push({
        year: y, generation: degraded, selfUsed, exported,
        saving, inverter, cumulative
      });
    }

    return { years, payback, total: cumulative };
  }

  /* Put it all together. `answers` is what the homeowner told us. */
  function run(answers) {
    const a = A();

    const usageKwh  = annualUsageKwh(answers.monthlyBill);
    const perKw     = yieldPerKw(answers.region, answers.orientation);
    const daytime   = daytimeLoadKwh(usageKwh, answers.occupancy);
    const system    = chooseSystem(daytime, perKw);

    const generation = system.kw * perKw;
    const panelCount = Math.ceil((system.kw * 1000) / a.panelWatts);

    const costMid = (system.low + system.high) / 2;
    const proj    = project(generation, daytime, costMid);

    // The share of everything generated that gets used in the house rather
    // than exported. Worth showing, because it's what makes the numbers work.
    const scr = proj.years[0].selfUsed / proj.years[0].generation;

    const yearOne     = proj.years[0];
    const annualBill  = answers.monthlyBill * 12;
    const billOffset  = Math.min(yearOne.saving / annualBill, 0.95);

    // What the bill drifts to in 10 years if they do nothing.
    const billIn10 = answers.monthlyBill * Math.pow(1 + a.electricityInflation, 10);

    // Range on 25-year savings: low end assumes they self-consume less than
    // we think and prices rise slower; high end the reverse. Gives an honest
    // spread rather than one falsely precise number.
    const savingsLow  = proj.total * 0.80;
    const savingsHigh = proj.total * 1.25;

    return {
      answers,
      usageKwh,
      daytimeKwh: daytime,
      yieldPerKw: perKw,
      system,
      panelCount,
      generation,
      selfConsumptionRate: scr,
      cost: { low: system.low, high: system.high, mid: costMid },
      annualSaving: yearOne.saving,
      monthlyBillBefore: answers.monthlyBill,
      monthlyBillAfter: Math.max(answers.monthlyBill - yearOne.saving / 12, 0),
      monthlyBillIn10IfNothing: billIn10,
      billOffset,
      payback: proj.payback,
      projection: proj.years,
      savings25: { low: savingsLow, high: savingsHigh, mid: proj.total },
      finance: finance(answers, costMid),
      consent: consent(panelCount)
    };
  }

  return { run, annualUsageKwh, daytimeLoadKwh, yieldPerKw, chooseSystem, monthlyRepayment };
})();
