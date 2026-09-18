# NZ Solar Savings Calculator

A lead-capture calculator for New Zealand solar installers. The homeowner
answers seven questions about their power bill and their home, and gets a
genuine estimate: system size, install cost, annual savings, payback, green
loan eligibility and whether they need building consent. Handing over contact
details is how they become a lead in the installer's CRM.

Built to be re-skinned per client: **one config file, no code changes.**

---

## Setting up a new client, start to finish

1. **Copy this folder** and rename it for the client.
2. **Open `assets/js/config.js`** and change the values at the top: their name,
   phone, logo URL, brand colour, fonts, and their GoHighLevel webhook. That
   file is commented line by line, and it's the only file you need to touch.
3. **Deploy to Netlify.** Drag the folder onto <https://app.netlify.com/drop>.
   That's the entire deploy. You get a URL like `client-solar.netlify.app`.
4. **Embed it in their GoHighLevel page**, see below.

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

**Alternative, no iframe.** Run `node build.js` to produce `dist/index.html`,
a single self-contained file. Paste its entire contents into the GHL custom-code
element instead. Simpler, but you have to re-paste into every client's page
every time you change something. The iframe is the better default.

---

## Using a client's fonts

Fonts are set in `config.js` alongside the colours:

```js
fonts: {
  display: { family: "Baloo 2",       weights: [500, 600, 700] },
  body:    { family: "Inter",         weights: [400, 600, 700] },
  mono:    { family: "IBM Plex Mono", weights: [400, 500] },
  customCssUrl: ""
}
```

**If the font is on Google Fonts** (fonts.google.com), just type the family
name exactly as it appears there. The page builds the load request itself, so
there's nothing to download and nothing else to change. Most brand fonts you'll
meet in
NZ small business are on there.

The three roles:

- **display**: the big headings and the question text.
- **body**: everything else. Subheadings use this family at weight 600, so a
  chunky display face like Baloo 2 never has to work at small sizes where it
  gets shouty.
- **mono**: every figure. Worth leaving alone: a monospaced face is what makes
  the numbers read like a meter rather than marketing, and it keeps columns of
  digits lined up.

**If the font isn't on Google Fonts**, you have two options:

1. *The foundry gives you a hosted stylesheet URL* (Adobe Fonts, Typekit,
   Fontshare, a client's own CDN). Put it in `customCssUrl` and name the family
   in the role above. Done.
2. *You've been sent the font as files* (`.woff2`, `.otf`, `.ttf`). Drop them in
   `assets/fonts/`, then add an `@font-face` block at the top of `styles.css`
   pointing at them. Send the files over and this is a two-minute job, but
   check the licence first. A desktop licence covers a designer's laptop, not
   putting the font on a public web page; that needs a webfont licence, and
   using one without it is the client's legal problem, not yours.

**A warning worth heeding:** every extra font and weight is another file the
page waits on. Three families at two or three weights each is already a lot.
If a client's brand guide lists six weights, pick the two or three that earn
their place.

---

## The map step

Shows the homeowner an aerial photo of their place and asks them to drag it so
the pin sits on their roof. Off by default until you give it a key.

**To turn it on** you need a LINZ Basemaps key from
<https://basemaps.linz.govt.nz>. Also set `address.defaultCentre` to the middle
of that installer's patch, so the map opens somewhere useful.

**Which LINZ key you need.** LINZ issue two kinds. The *individual* key you get
straight from the site is, in their words, "for individual users", and they ask
that shared or public tools use a free *Developer* key instead, which you
request through the Contact us link on the same page. A calculator on a client's
landing page taking paid traffic is a public tool, so it needs a Developer key
before it goes live. An individual key is fine for clicking through it yourself.

**Never commit a key to this repo, it is public.** Leave
`address.linzBasemapsKey` blank in `config.js`. For a throwaway test build,
pass the key in at build time instead:

```
LINZ_KEY=imagery-key LINZ_DATA_KEY=address-key OUT=preview.html node build.js
```

That writes a single file with the key baked in, which you can open directly in
a browser. Don't commit it. For a real Netlify deploy, either paste the key into
`config.js` on the deployed copy only, or set it as a Netlify build environment
variable.

**Be clear about what it does and doesn't do.** It does not make the estimate
more accurate. The power bill drives system size far more than the roof does.
What it buys you is:

- **Engagement.** Seeing your own house from above is the moment the tool stops
  feeling like a form.
- **An address and coordinates on every lead.** The installer gets these in the
  webhook payload for quoting and routing, which is worth real money to them.
- **One fewer question**, for installers covering more than one region. The pin
  tells us the region, so that question drops out of the flow automatically.
  Installers locked to a single region never saw it anyway.

**It can't break the flow.** No key means a plain address box and no map. A key
that's wrong, or LINZ being down, means the map quietly hides itself and shows
a short note instead. There's a "Skip this" link either way. An address is
nice to have and is never worth losing a lead over, which is why
`address.required` defaults to false and should stay there.

**No mapping library.** The map is about 200 lines in `assets/js/map.js` with
no dependencies, so there's no CDN to go down and nothing to keep updated.

### Address suggestions

Typing in the address box offers suggestions, and picking one moves the map to
that address. Configured under `address.search` in `config.js`.

Two providers, because they trade off differently:

- **`linz`** is free and New Zealand only, which suits the audience exactly. It
  needs a key from <https://data.linz.govt.nz>. That is a **different key** from
  the Basemaps imagery one, from a different LINZ service. Easy to conflate.
  Their exact query format could not be confirmed when this was built, so
  `linzUrlTemplates` holds several candidates. The calculator tries each on the
  first search and keeps whichever returns addresses. Once you know which one
  works, delete the others.
- **`google`** costs a few dollars per thousand lookups but copes far better
  with half-typed, misspelled and informal addresses. On paid traffic that
  usually pays for itself, since every abandoned address box is a lost lead.
  Needs a Google Cloud key with the Places API enabled.

Set `provider` to `"off"` to just let people type.

If the provider is missing, misconfigured or down, suggestions quietly stop
appearing and the box goes back to being a plain text field. Someone can always
type their address and carry on, and the installer still gets it.

The suggestion list is a proper combobox: arrow keys move through it, Enter
picks, Escape closes.

### What this deliberately does not do

Solar Scout follow their map with a LiDAR roof scan: three roof faces, pitch,
points per square metre. The raw data behind that is free and public, but
turning a point cloud into roof planes needs server-side processing, which
would break the "drag a folder onto Netlify" model that makes this re-skinnable
at all. It also wouldn't improve the estimate much, for the reason above.

Solar Scout need it because the report *is* their product, which they sell on
to installers. Here the product is a lead for an installer who is going to get
up on the roof anyway.

---

## Where the leads go

Set `leads.webhookUrl` in `config.js` to the installer's GoHighLevel **Inbound
Webhook** URL (Automation → Workflows → new workflow → trigger "Inbound
Webhook" → copy the URL).

Every submission POSTs a JSON payload with the contact details *and* the full
estimate: system size, cost, savings, payback, green loan status, consent
flag. So the installer picks up the phone already knowing the job.

Leave the webhook blank while testing: the calculator still works, and prints
the payload to the browser console instead.

---

## The files

| File | What it is |
|---|---|
| `assets/js/config.js` | **The only file you edit per client.** Branding, fonts, contact details, webhook, tracking, and every calculation assumption. |
| `assets/js/nz-data.js` | Shared NZ data: regional solar yield, install pricing, bank green loans, consent rules. Edit when the country changes, not when the client does. |
| `assets/js/calculator.js` | The maths. Pure calculation, no page code. |
| `assets/js/app.js` | The question flow and the results page. |
| `assets/js/map.js` | The aerial map. No libraries, no CDN. |
| `assets/js/address.js` | Address suggestions, and the providers behind them. |
| `assets/css/styles.css` | All styling. Re-skins from the brand colour in config, so you shouldn't need to touch this. |
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
   We size to what the house can actually absorb while the sun is up, which is
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
- **Renters are exited gracefully** and never asked for contact details. They
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
- Solar Colab's brand colours are eyeballed from a screenshot of their site.
  If they have a brand guide with exact hex codes, those should replace them.
- No battery option yet. Worth adding once v1 is proven.
- Address suggestions have only been tested against a stand-in service, since
  LINZ is unreachable from the build environment.
- `address.search.debug` is on, which shows a status line under the address
  box. Turn it off before real traffic.
- A LINZ Developer API key needs requesting before launch. See above.
- Region detection from the pin uses nearest-town, checked against 27 NZ
  towns. It could still pick the neighbouring region right on a boundary,
  which would shift the sunshine figure slightly.
