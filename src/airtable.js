// Airtable API-Client
// Nutzt Field-IDs statt Field-Namen, damit Umbenennen in Airtable die App nicht bricht.

export const BASE_ID = "appzM35eYQFe9a5mr";
export const STANDPLAN_TABLE = "tblkOneCVJYxtF02Q";
export const AUSSTELLER_TABLE = "tbl4mVnPf7GaX7VAU";

export const FIELDS = {
  standnummer: "fldlygk7GHnebSxuO",
  status: "fldzNYM0enUAdYmnw",
  aussteller: "flda44845oVa3pKx2",
  notes: "flddQW3eixZuAMj3T",
  bezahlt: "fldadSt4ZlU9l5nde",
  re_nr: "fldrUNX5vZcoAiX5i",
  firmenname: "fldx7M45sZshwe0h8",
  aussteller_notizen: "fldPPJxBgu3jpzkLV",
};

const BASE_URL = "https://api.airtable.com/v0";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Alle Records einer Tabelle holen (über Paginierung)
export async function listAllRecords(token, tableId) {
  const all = [];
  let offset = null;
  do {
    const url = new URL(`${BASE_URL}/${BASE_ID}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable GET ${tableId} fehlgeschlagen (${res.status}): ${text}`);
    }
    const data = await res.json();
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

// Standplan-Record updaten
export async function updateStandplanRecord(token, recordId, fields) {
  const url = `${BASE_URL}/${BASE_ID}/${STANDPLAN_TABLE}/${recordId}?returnFieldsByFieldId=true`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH fehlgeschlagen (${res.status}): ${text}`);
  }
  return res.json();
}

// Neuen Aussteller anlegen
export async function createAussteller(token, firmenname) {
  const url = `${BASE_URL}/${BASE_ID}/${AUSSTELLER_TABLE}?returnFieldsByFieldId=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      fields: { [FIELDS.firmenname]: firmenname },
      returnFieldsByFieldId: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable POST Aussteller fehlgeschlagen (${res.status}): ${text}`);
  }
  return res.json();
}

// Token validieren: einfacher Probe-Aufruf
export async function validateToken(token) {
  const url = new URL(`${BASE_URL}/${BASE_ID}/${STANDPLAN_TABLE}`);
  url.searchParams.set("maxRecords", "1");
  const res = await fetch(url, { headers: authHeaders(token) });
  return res.ok;
}
