// Every outbound claim on the page links to one of these. `checked` is the last date a person opened the URL.
// Project links: README "Tech stack (NSAC)" (opened 2026-10-18). Mars fact sheet: opened 2026-11-07.
// Circulation and the NASA bed-rest paper block automated fetches (HTTP 403 / PDF), so they carry no date.

export type SourceId =
  | "osd569"
  | "osd575"
  | "osdrApi"
  | "donki"
  | "issChecklist"
  | "circulation"
  | "marsGravity"
  | "bedRest";

export interface Source {
  readonly url: string;
  readonly checked?: string;
}

export const SOURCES: Readonly<Record<SourceId, Source>> = {
  osd569: { url: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569", checked: "2026-10-18" },
  osd575: { url: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575", checked: "2026-10-18" },
  osdrApi: { url: "https://visualization.osdr.nasa.gov/biodata/api/", checked: "2026-10-18" },
  donki: { url: "https://ccmc.gsfc.nasa.gov/tools/DONKI/", checked: "2026-10-18" },
  // Mirror: the original nasa.gov link is dead.
  issChecklist: {
    url: "https://newspaceeconomy.ca/wp-content/uploads/2022/11/163533main_iss_med_cl.pdf",
    checked: "2026-10-18",
  },
  circulation: { url: "https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665" },
  marsGravity: { url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", checked: "2026-11-07" },
  bedRest: { url: "https://ntrs.nasa.gov/api/citations/20120000718/downloads/20120000718.pdf" },
};

export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];
