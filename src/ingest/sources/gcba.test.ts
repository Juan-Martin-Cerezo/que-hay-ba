import assert from "node:assert/strict";
import { test } from "node:test";
import { gcbaEventUrl } from "./gcba";

const BASE = "https://linda.buenosaires.gob.ar";

test("rewrites the retired /descubrir/ route to /eventos/", () => {
  assert.equal(
    gcbaEventUrl("/descubrir/noche-de-museos", null),
    `${BASE}/eventos/noche-de-museos`
  );
});

test("builds the slug route when the API only returns a slug", () => {
  assert.equal(gcbaEventUrl(null, "feria-de-libro"), `${BASE}/eventos/feria-de-libro`);
});

test("keeps absolute links untouched", () => {
  assert.equal(
    gcbaEventUrl("https://example.com/evento/42", null),
    "https://example.com/evento/42"
  );
});

test("falls back to the agenda index", () => {
  assert.equal(gcbaEventUrl(null, null), `${BASE}/agenda`);
});
