// FILE: lib/sanity/queries.ts
// -----------------------------------------------------------------------------
// GROQ queries matching sanity/schemaTypes. Kept as plain strings (not
// defineQuery/TypeGen) since there's no live project yet to generate types
// against — see lib/sanity/client.ts.
// -----------------------------------------------------------------------------

export const HOME_PAGE_QUERY = `*[_type == "homePage"][0]{
  storySections[]{ title, body },
  leadTimeNote,
  fragmentLabels[]{ title, num, desc },
}`;

export const FAQ_QUERY = `*[_type == "faqItem"] | order(order asc){
  question,
  answer,
}`;
