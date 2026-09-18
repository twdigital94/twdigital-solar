# TWdigital Solar Calculator

## Writing style

**Never use em dashes (U+2014) anywhere.** Not in user-facing copy, not in code
comments, not in documentation, not in commit messages, not in chat replies.
Use a comma, a colon, a full stop, or brackets instead, and rewrite the
sentence properly rather than swapping in a hyphen.

En dashes (U+2013) are fine where they're correct: numeric ranges such as
`$14,000` to `$15,000` as rendered on the results page, and compound
directions such as the East/west roof option.

Tim is not a developer. Explain technical decisions in plain English and
default to the simplest thing that works, not the most sophisticated.

## Project shape

`assets/js/config.js` is the only file that should need editing to set up a new
client: branding, fonts, contact details, GoHighLevel webhook, tracking IDs,
pricing overrides, and every calculation assumption. If something a client
would want to change is hardcoded elsewhere, that's a bug in the design.

`assets/js/nz-data.js` holds shared New Zealand data (regional yield, install
pricing, bank green loans, consent rules). Edit it when the country changes,
not when the client does.

Run `node build.js` after changing anything, which regenerates the
single-file `dist/index.html` used for previews and for pasting straight into
GoHighLevel.

## Secrets

This repository is PUBLIC. No API keys, webhook URLs or client credentials go
in it. `address.linzBasemapsKey` stays blank in the committed `config.js`; a
key is passed in at build time with `LINZ_KEY=... node build.js` or set on the
deployed copy only.

## Things not to break

- Green loans are top-ups on an existing mortgage with that specific bank,
  plus about 20% equity. Outright owners and renters qualify for none of them.
  Never imply otherwise.
- Kiwibank offers a $2,000 cashback, not a discounted rate.
- ANZ and Kiwibank require a SEANZ-accredited installer.
- Renters exit the flow before contact capture. They can't authorise an
  install, so they aren't a lead.
- Building consent is always phrased as "likely", never certain. Only panel
  area can be checked from the answers.
- Size systems to the household's daylight load, not their whole annual usage.
  Sizing to the full bill oversizes the array and lengthens payback.
