import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGcbaUrl } from "./gcba";

describe("buildGcbaUrl", () => {
  it("rewrites the retired /descubrir pathAlias to /eventos", () => {
    assert.equal(
      buildGcbaUrl({
        pathAlias: "/descubrir/congreso-de-informatica",
        slug: "congreso-de-informatica",
      }),
      "https://linda.buenosaires.gob.ar/eventos/congreso-de-informatica"
    );
  });

  it("builds /eventos/<slug> when pathAlias is missing", () => {
    assert.equal(
      buildGcbaUrl({ pathAlias: null, slug: "jazz-en-parque" }),
      "https://linda.buenosaires.gob.ar/eventos/jazz-en-parque"
    );
  });

  it("keeps absolute external links untouched", () => {
    assert.equal(
      buildGcbaUrl({ pathAlias: "https://otro.sitio/x", slug: "x" }),
      "https://otro.sitio/x"
    );
  });

  it("falls back to /agenda without a usable slug", () => {
    assert.equal(
      buildGcbaUrl({ pathAlias: "/descubrir", slug: null }),
      "https://linda.buenosaires.gob.ar/agenda"
    );
    assert.equal(
      buildGcbaUrl({ pathAlias: null, slug: null }),
      "https://linda.buenosaires.gob.ar/agenda"
    );
  });
});
