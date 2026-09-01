# TWdigital — NZ Solar Savings Calculator

## Who I am

I'm Tim Walker, founder and sole operator of **TWdigital** (twdigital.co.nz), a paid advertising and lead generation business serving NZ SMEs. I specialise in Meta Ads and Google Ads. My positioning is direct expert access, plain English, no agency fluff — real person, not a corporate account manager. I'm based in Thailand, all my clients are in New Zealand.

I'm not a developer. I can read code and follow instructions, but I need you to explain technical decisions in plain terms and default to the simplest approach that works, not the most sophisticated one.

## What I'm building and why

I'm building a niche vertical within TWdigital around **solar installers**. I have one solar client (Solar Colab, Hawke's Bay) with proven results: 87 leads over ~8 months, $86 average cost-per-lead on Meta, 5.7% lead-to-install close rate.

I'm about to cold call ~33 other NZ solar installers with an offer: I run their Meta/Google ads, they get a guaranteed number of qualified leads, retainer around $2,500/month plus roughly $3,000/month ad spend.

**This calculator IS the offer, not a bolt-on.** Instead of driving ad traffic to a generic "get a free quote" lead form, the ad traffic lands on an interactive solar savings calculator. The homeowner enters some details about their power bill and situation, sees an instant, genuinely useful estimate of system size, cost, savings and payback — and submitting to see the full result is how they become a lead, captured into the installer's CRM (GoHighLevel).

The bet: a useful tool converts better and produces higher-intent leads than a bare form, and it's a much stronger sales pitch to installers than "I'll run you some ads."

**Model:** build once, re-skin per client. Each solar installer gets their own branded instance (their logo, colours, contact details, their own install pricing if they give it to me) but the underlying calculation engine and NZ data are shared.

## Competitive context

Two NZ companies already do consumer-facing solar tools, but as **lead-selling businesses that compete with installers for the lead**, not as tools installers own:

- **Solar Scout** (solarscout.co.nz) — sophisticated flow: address → LIDAR roof scan → roof material/age/condition → household size → mortgage bank → equity → power retailer → power bill → hot water type → usage timing → EV → capture name/email → report emailed, then upsell to "compare quotes from vetted installers." This is the standard to be aware of, not to copy — their LIDAR roof modelling in particular is a large, hard engineering job I am NOT trying to replicate.
- **SolarPath** (solarpath.co.nz) — simpler installer-matching service, currently BOP/Waikato, Auckland on waitlist.

My version is different in kind: a tool the **installer owns and embeds on their own site/landing page**, feeding leads straight into their own CRM, not a third party selling them back leads.

## Key NZ facts the calculator must be built on (do not use US/generic defaults)

- Most popular residential system size: **6.6 kW** (~15-16 panels)
- Installed pricing (incl. GST), 2026 NZ rates:
  - 3 kW: $8,000–$10,000
  - 5 kW: $11,000–$13,000
  - 6.6 kW: $14,000–$15,000
  - 8 kW: $15,000–$18,000
  - 10 kW: $15,000–$18,000
  - 13 kW+: $20,000–$30,000
- Typical payback: 6–8 years without a battery. 20+ years of savings after payback.
- Panels warranted for 25 years at 80%+ output; real-world lifespan often 30+ years.
- **Building consent**: since October 2025, most residential installs no longer need consent, if panel area is under 40m², property is in a standard wind zone, install is on an existing building, and panels are flush-mounted or standard tilt frames. Saves $1,000–$2,000 and several weeks. This is a genuine, current NZ regulatory fact — bake it into the copy/logic, e.g. flag "likely doesn't need consent" based on system size.
- **Bank green loans** — important, easy to get wrong: Westpac 0% up to 5 years (cap $50k), ANZ/ASB/BNZ 1% up to 3 years (cap $80k), Kiwibank offers a $2,000 cashback instead of a discount. **Every one of these requires an existing mortgage with that specific bank** (they're a top-up on an existing home loan) plus typically 20%+ equity. Outright homeowners and renters do NOT qualify for any of these — do not imply otherwise. ANZ and Kiwibank additionally require the installer to be a SEANZ member.
- Regional solar yield varies (kWh generated per kWp of panels installed per year) — Wellington currently tops this table, followed by New Plymouth, Blenheim, Auckland. Full table available if needed — ask me rather than guessing regional figures.
- NZ electricity prices have risen ~31% over 5 years; this trend is a legitimate part of the "lock in your rate" pitch.

## What the calculator should capture (v1 — keep it simple)

Rough shape, open to your input on the best sequence/UX:

1. Monthly power bill (the single most important input)
2. Region / city (for solar yield + sunshine assumptions)
3. Roof orientation (north / east-west split / south, simple selector — not LIDAR)
4. Home ownership status (own outright / mortgage / renting) — renting should probably exit the flow gracefully, they're not a real lead
5. If mortgage: which bank (to show accurate green loan eligibility, not a blanket "0% available" claim)
6. Household occupancy pattern (home during day / out during day / mixed) — affects self-consumption assumption
7. Contact capture (name, email, phone) to reveal the full report

## What it should output

- Estimated system size (kW) based on bill + occupancy
- Estimated installed cost (range, using the NZ pricing table above)
- Estimated annual savings
- Estimated payback period
- Estimated monthly loan repayment IF they have a qualifying green loan situation, otherwise show cash/standard finance framing
- Whether they likely need building consent or not, based on rough system size vs the 40m²/wind zone criteria (with a caveat that the installer confirms)

## Explicitly NOT building in v1

- No LIDAR / satellite roof scanning — that's Solar Scout's moat and a huge engineering lift for very little marginal benefit to a lead-magnet tool
- No live power retailer buy-back rate comparison — nice-to-have, not v1
- No real roof-shading analysis
- Keep the whole thing to a single build I can realistically re-skin per client without needing a developer each time

## Tech preferences

- Static site (HTML/CSS/JS), no backend database needed for v1 — form submissions can post to a GoHighLevel webhook/form endpoint per client
- Should be easy to deploy to Netlify and easy to duplicate/re-skin as a template for a new client (client name, logo, colours, contact details, and their own pricing if supplied, should ideally live in one config file rather than scattered through the code)
- Needs to work as an embeddable iframe as well as a standalone page, since some clients may want it inside GoHighLevel or their existing website

## My website (for tone/brand reference)

https://twdigital.co.nz — this is my own business, not the solar client's. Useful for seeing how I write/position things generally, but the calculator's tone should suit a solar installer's homeowner audience, not my own agency positioning.

---

**Working style note:** I like seeing the reasoning/tradeoffs before a big decision gets made, not just the finished thing. Explain what you're about to build and why before doing large chunks of work, in plain English, then go ahead.
