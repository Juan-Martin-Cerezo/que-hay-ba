import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEvent,
  computeTimeWindow,
  formatPriceLabel,
  isInsideCaba,
  makeDedupKey,
  makeVenueKey,
  parseArtDateTime,
  parsePrice,
} from "./normalise";

describe("parsePrice", () => {
  it("detects genuinely free events in Spanish text", () => {
    assert.deepEqual(parsePrice("Entrada libre y gratuita, por orden de llegada"), {
      isFree: true,
      priceMin: 0,
      priceMax: 0,
    });
    assert.deepEqual(parsePrice("Actividad sin costo con inscripción previa"), {
      isFree: true,
      priceMin: 0,
      priceMax: 0,
    });
  });

  it("refuses to mark a la gorra or arancelada or disclaimer-only text as Gratis", () => {
    assert.deepEqual(parsePrice("Espectáculo a la gorra"), {
      isFree: false,
      priceMin: null,
      priceMax: null,
    });
    assert.deepEqual(
      parsePrice("Actividad arancelada. Los miércoles la entrada es sin costo."),
      {
        isFree: false,
        priceMin: null,
        priceMax: null,
      }
    );
    assert.deepEqual(
      parsePrice(
        "Encuentro anual. Este es un espacio de difusión abierto y gratuito. El contenido de eventos de privados..."
      ),
      {
        isFree: false,
        priceMin: null,
        priceMax: null,
      }
    );
  });

  it("extracts ARS ranges and formatted prices even when explicitFree is passed", () => {
    assert.deepEqual(parsePrice("Entradas desde: $ 10.000,00 - Viernes 21:00 hs"), {
      isFree: false,
      priceMin: 10000,
      priceMax: 10000,
    });
    assert.deepEqual(parsePrice("General $8.000 / Platea $15.000", true), {
      isFree: false,
      priceMin: 8000,
      priceMax: 15000,
    });
  });

  it("returns null bounds when price is unparseable", () => {
    const p = parsePrice("Consultar en boletería");
    assert.deepEqual(p, { isFree: false, priceMin: null, priceMax: null });
    assert.equal(formatPriceLabel(p.isFree, p.priceMin, p.priceMax), "Precio no informado");
  });
});

describe("classifyEvent", () => {
  it("classifies music, theatre, gastro, outdoor and workshops accurately", () => {
    assert.equal(classifyEvent("Recital de Jazz & cuarteto en vivo"), "musica");
    assert.equal(classifyEvent("Obra de teatro y comedia stand up"), "teatro");
    assert.equal(classifyEvent("Feria gastronómica y degustación de vinos"), "gastronomia");
    assert.equal(classifyEvent("Caminata guiada por la Reserva Ecológica"), "aire_libre");
    assert.equal(classifyEvent("Taller intensivo de fotografía y charla"), "talleres");
    assert.equal(classifyEvent("Muestra permanente en el museo"), "arte");
  });
});

describe("isInsideCaba & deduplication keys", () => {
  it("accepts Obelisco and rejects La Plata", () => {
    assert.equal(isInsideCaba(-34.6037, -58.3816), true);
    assert.equal(isInsideCaba(-34.9214, -57.9544), false);
  });

  it("merges identical events within the same 30m slot at the same address", () => {
    const v1 = makeVenueKey("Teatro Gran Rex", "Av. Corrientes 857, CABA");
    const v2 = makeVenueKey("Gran Rex", "Corrientes 857");
    assert.equal(v1, v2);

    const t1 = parseArtDateTime("2026-10-30", "21:00")!;
    const t2 = parseArtDateTime("2026-10-30", "21:10")!;
    assert.equal(
      makeDedupKey("Festival de Jazz!", v1, t1),
      makeDedupKey("festival de jazz", v2, t2)
    );
  });
});

describe("computeTimeWindow", () => {
  it("builds valid windows for now, today, weekend and custom date", () => {
    const ref = new Date("2026-10-18T15:00:00Z"); // Sunday 12:00 ART
    assert.equal(computeTimeWindow("now", ref).liveNow, true);
    const wDate = computeTimeWindow("2026-10-24", ref);
    assert.equal(wDate.from.toISOString(), "2026-10-24T03:00:00.000Z");
    assert.equal(wDate.to.toISOString(), "2026-10-25T02:59:59.000Z");
  });
});
