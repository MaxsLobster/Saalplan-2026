// Plan-Konfigurationen: großer (316) und kleiner (297) Saalplan.
// Jeder Plan hat eine eigene Standplan-Tabelle in Airtable (eigene Field-IDs)
// und ein eigenes Layout. Die Aussteller-Tabelle ist für beide Pläne gleich
// (siehe airtable.js).

export const PLANS = {
  gross: {
    id: "gross",
    label: "Großer Plan (316)",
    tableId: "tbljZknVzXCKYdZOw",
    fields: {
      standnummer: "fldgBkoI2u3cHqwst",
      status: "fld3cJuNZanJDuthr",
      aussteller: "fld0oxATWSj2rtHfq",
      notes: "fld5asKKZLZAakrZ8",
      bezahlt: "fldv64vqwCSeeHNKv",
      re_nr: "fldG5eh7obfn21Vly",
    },
    layout: "./layout.js",
  },
  klein: {
    id: "klein",
    label: "Kleiner Plan (297)",
    tableId: "tblPh5rYtVtcmHWGJ",
    fields: {
      standnummer: "fldBLU9QpHvkXRCnw",
      status: "fldRI2F6qyhenpYaq",
      aussteller: "fldJOFJFSSZ5OVCSL",
      notes: "fldi2vbcZAld2kc8D",
      bezahlt: "fldmzS64KeYBj7J4L",
      re_nr: "fld3dl3N909bBkoB1",
    },
    layout: "./layout-klein.js",
  },
};

const PLAN_KEY = "saalplan_plan_v1";
const DEFAULT_PLAN_ID = "gross";

function loadActivePlanId() {
  try {
    const id = localStorage.getItem(PLAN_KEY);
    return PLANS[id] ? id : DEFAULT_PLAN_ID;
  } catch {
    return DEFAULT_PLAN_ID;
  }
}

export function setActivePlanId(id) {
  if (!PLANS[id]) throw new Error(`Unbekannter Plan: ${id}`);
  localStorage.setItem(PLAN_KEY, id);
}

// Wird einmal beim Laden festgelegt — Plan-Wechsel geht nur über Reload.
export const ACTIVE_PLAN = PLANS[loadActivePlanId()];
