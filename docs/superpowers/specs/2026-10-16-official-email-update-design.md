# Official Email Update Design

## Goal

Replace the foundation's public official email address with
`fbd_2025@mail.ru` everywhere the production website presents it to visitors.

## Scope

The change updates the shared site configuration, published website legal
content, donation-offer content, and related expectations in
component/page/SEO/admin-default tests. All rendered labels and `mailto:`
destinations use the same lowercase address.

The change does not alter downloadable DOCX documents, visitor-supplied email
addresses, administrator inbox links generated from contact requests, project
plans, historical implementation plans, or artifacts on unrelated branches.

## Implementation

`src/config/site.ts` remains the source for ordinary public contact links.
Hard-coded legal clauses in `src/content/legal.ts` and
`src/content/donation-offer.ts` are updated separately because their text is
published verbatim. Tests first assert the new configuration, SEO value,
footer/contact links, donation preview link, and legal text, then production
content is changed. The requisites-draft test is also updated because its
default email is derived from the shared site configuration.

## Verification

- A repository search finds no old official address in production source or
  current public-facing tests.
- Focused configuration, SEO, layout, donation, and information-page tests pass.
- `npm run verify` passes with the documented validation environment.
- A production build contains the new address and no old address in generated
  public HTML.
