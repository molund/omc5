// The Clayton Clipper's status as data for machines, written when the site is built (trackside/prerender.js): dist/status.json,
// and the schema.org Dataset in the map page's <head> that describes it, so crawlers and apps can find and read it. It is
// dedicated to the public domain (CC0 1.0). Plain JS, no Svelte, so the build can run it.
import { cardSpan } from "./placeGantry.js";
import { SITE } from "./comments.js";

/** The route's span count, as the progress card's "of" figure (the span numbers in map.svg). */
export const TOTAL_SPANS = 105;
/** CC0 1.0 Universal: no rights reserved. */
export const LICENSE = "https://creativecommons.org/publicdomain/zero/1.0/";
/** How the velocity is worked out, in the Leash Log's repository. */
export const METHOD = "https://github.com/molund/omc5-admin/blob/main/docs/velocity-calculation.md";

const pad = (n) => String(n).padStart(2, "0");
/**
 * A Date in BC time (UTC−7 all year), to the second: "2026-11-11T08:45:00-07:00".
 * @param {Date} date
 * @returns {string}
 */
export function bcTime(date) {
  const d = new Date(+date - 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}-07:00`;
}

/**
 * The status as it is published in status.json.
 * @param {{ updated: Date|null, span: number|null, complete: boolean, spansPerWeek: string|null }} status From lib/status.js.
 * @param {{ time: Date, value: number }[]} points The velocity's values, oldest first (lib/velocityChart.js).
 * @param {Date} [builtAt]
 * @returns {object}
 */
export function statusData(status, points, builtAt = new Date()) {
  const shown = status.span == null ? null : cardSpan(status.span);
  const spansPerWeek = status.spansPerWeek == null || isNaN(+status.spansPerWeek) ? null : +status.spansPerWeek;
  return {
    name: "Clayton Clipper status",
    gantry: "Clayton Clipper",
    updated: status.updated ? bcTime(status.updated) : null,
    span: {
      current: status.span,
      segmentsHung: status.complete,
      shownOnCard: shown,
      total: TOTAL_SPANS,
      percentOfRoute: shown == null ? null : Math.round((shown / TOTAL_SPANS) * 1000) / 10,
    },
    velocity:
      spansPerWeek == null
        ? null
        : {
            spansPerWeek,
            isEstimate: true,
            window:
              "168 hours up to the last check-in, extended by the hours without gantry work in any statutory holiday (up to 24 each)",
            // newest first, the first being spansPerWeek itself
            series: [...points].reverse().map((p) => ({ time: bcTime(p.time), spansPerWeek: p.value })),
            method: METHOD,
          },
    definitions: {
      span: "The Clayton Clipper span the gantry has arrived at: the span number goes up when the gantry moves there.",
      segmentsHung: "Whether all that span's segments are hung.",
      shownOnCard:
        "The span number the progress card shows: one less than `current` while the gantry is on a double girder span, where only its arrival is logged.",
      velocity:
        "An estimate of how far the gantry gets in a week, in spans, worked out from site visits and the weekly shutdown; see `method`.",
    },
    license: LICENSE,
    source: SITE,
    builtAt: builtAt.toISOString(),
  };
}

/**
 * The schema.org Dataset that describes status.json and the map data, for the map page's head.
 * @param {object} data From statusData.
 * @returns {object}
 */
export function datasetJsonLd(data) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Clayton Clipper progress: Surrey Langley SkyTrain guideway",
    description:
      "Where the Clayton Clipper gantry is on the Surrey Langley SkyTrain guideway in Surrey, BC, and its estimated pace in spans per week, with the guideway's spans, supports and pillars as map data.",
    url: SITE,
    isAccessibleForFree: true,
    license: LICENSE,
    ...(data.updated ? { dateModified: data.updated } : {}),
    creator: { "@type": "Person", name: "Mike" },
    spatialCoverage: "Surrey, British Columbia: Hillcrest to Bakerview",
    keywords: ["Surrey Langley SkyTrain", "Clayton Clipper", "guideway", "gantry", "construction progress"],
    variableMeasured: [
      ...(data.span.current == null
        ? []
        : [
            {
              "@type": "PropertyValue",
              name: "Current span",
              value: data.span.current,
              unitText: `span number (of ${data.span.total})`,
            },
          ]),
      ...(data.velocity
        ? [
            {
              "@type": "PropertyValue",
              name: "Velocity",
              value: data.velocity.spansPerWeek,
              unitText: "spans per week",
              measurementTechnique: "Estimated from site visits over the last 168 hours; see " + data.velocity.method,
            },
          ]
        : []),
    ],
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "status.json" },
      ...["spans", "supports", "pillars"].map((k) => ({
        "@type": "DataDownload",
        encodingFormat: "application/geo+json",
        contentUrl: `${SITE}data/sls-hillcrest-to-bakerview-${k}.geojson`,
      })),
    ],
  };
}
