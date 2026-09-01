# NZ Solar Savings Calculator

A lead-capture calculator for New Zealand solar installers. The homeowner
answers seven questions about their power bill and their home, and gets a
genuine estimate — system size, install cost, annual savings, payback, green
loan eligibility and whether they need building consent. Handing over contact
details is how they become a lead in the installer's CRM.

Built to be re-skinned per client: **one config file, no code changes.**

---

## Setting up a new client — the whole process

1. **Copy this folder** and rename it for the client.
2. **Open `assets/js/config.js`** and change the values at the top: their name,
   phone, logo URL, brand colour, and their GoHighLevel webhook. That file is
   commented line by line — it's the only file you need to touch.
3. **Deploy to Netlify.** Drag the folder onto <https://app.netlify.com/drop>.
   That's the entire deploy. You get a URL like `client-solar.netlify.app`.
4. **Embed it in their GoHighLevel page** — see below.

To update every client later (a price change, a new bank rate), edit the shared
file once and redeploy each site. Nothing in GoHighLevel needs touching.

---

## Embedding it in GoHighLevel

In the funnel or website builder, drop a **Custom JS/HTML** element on the page,
then paste in everything from `embed/ghl-snippet.html`. Change the iframe `src`
to your Netlify URL. Done.

The snippet handles the two things that otherwise go wrong with an iframe:

- **Height.** The calculator tells the parent page how tall it is at each step,
  so the iframe resizes instead of showing an inner scrollbar.
- **Conversion tracking.** When someone submits, the calculator tells the parent
  page, so the GoHighLevel page's own Meta Pixel and Google tag fire the Lead
  event as well as the pixel inside the calculator.

**Alternative — no iframe.** Run `node build.js` to produce `dist/index.html`,
a single self-contained file. Paste its entire contents into the GHL custom-code
element instead. Simpler, but you have to re-paste into every client's page
every time you change something. The iframe is the better default.

---

## Where the leads go

Set `leads.webhookUrl` in `config.js` to the installer's GoHighLevel **Inbound
Webhook** URL (Automation → Workflows → new workflow → trigger "Inbound
Webhook" → copy the URL).

Every submission POSTs a JSON payload with the contact details *and* the full
estimate — system size, cost, savings, payback, green loan status, consent
flag. So the installer picks up the phone already knowing the job.

Leave the webhook blank while testing: the calculator still works, and prints
the payload to the browser console instead.

---

## The files

| File | What it is |
|---|---|
| `assets/js/config.js` | **The only file you edit per client.** Branding, contact details, webhook, tracking, and every calculation assumption. |
| `assets/js/nz-data.js` | Shared NZ data: regional solar yield, install pricing, bank green loans, consent rules. Edit when the country changes, not when the client does. |
| `assets/js/calculator.js` | The maths. Pure calculation, no page code. |
| `assets/js/app.js` | The question flow and the results page. |
| `assets/css/styles.css` | All styling. Re-skins from the brand colour in config — you shouldn't need to touch this. |
| `embed/ghl-snippet.html` | Paste into GoHighLevel. |
| `build.js` | Bundles everything into one file (`node build.js`). |

---

## How the estimate is worked out

1. **Bill → power used.** Take the fixed daily line charge off the bill first,
   then divide by the unit rate. The fixed charge has nothing to do with usage,
   and solar won't touch it either.
2. **Size the system to the daylight load, not the whole bill.** This is the
   part that's easy to get wrong. Sizing to cover someone's entire annual usage
   produces an oversized array that exports cheap power and pays back *slower*.
   We size to what the house can actually absorb while the sun is up — which is
   how installers size in practice.
3. **Savings.** Power used as it's generated is worth the full buy rate (~27c).
   Power exported is worth the buyback rate (~17c). The gap between those two is
   why the "is anyone home during the day" question matters so much.
4. **Payback.** Project 25 years with panels degrading 0.5%/year, power prices
   rising 3%/year, and a replacement inverter at year 13. The year cumulative
   savings overtake the install cost is the payback point.

Every one of those assumptions is a labelled value in `config.js`, and the
results page shows all of them to the homeowner under "the numbers behind this".

---

## Things a homeowner will never be told incorrectly

These were deliberate, and are worth not breaking:

- **Green loans require an existing mortgage with that specific bank**, plus
  around 20% equity. Outright owners and renters qualify for **none** of them.
  The tool says so plainly rather than dangling a 0% rate.
- **Kiwibank gives a $2,000 cashback, not a discounted rate.**
- **ANZ and Kiwibank require a SEANZ-accredited installer.**
- **Renters are exited gracefully** and never asked for contact details — they
  can't authorise an install, so they aren't a lead.
- **Consent is always "likely"**, never certain. We can only check panel area;
  wind zone and mounting are for the installer to confirm on site.

---

## Still to do

- **Regional solar yield figures in `nz-data.js` are placeholders.** They're in
  the right ballpark and the right order, but they need replacing with the real
  table. Every savings number depends on them.
- **Confirm the self-consumption assumptions** (`daytimeUsageShare` in
  `config.js`) with an installer.
- Solar Colab's brand colours are provisional — their site was unreachable from
  the build environment.
- No battery option yet. Worth adding once v1 is proven.
