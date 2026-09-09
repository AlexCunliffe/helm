const generic = [
  ["work", "Work", "#5B8DEF"], ["finance", "Finance", "#9B7EDB"],
  ["people", "People", "#E89C58"], ["admin", "Admin", "#6CB8A8"],
  ["home", "Home", "#C58BA6"], ["personal", "Personal", "#92AC67"],
];
const classic = [
  ["ops", "Operations", "#5B8DEF"], ["finance", "Finance", "#9B7EDB"],
  ["production", "Production", "#E89C58"], ["cs", "Customer service", "#6CB8A8"],
  ["sales", "Sales", "#C58BA6"], ["projects", "Projects", "#B9A05D"],
  ["personal", "Personal", "#92AC67"],
];
export const AREA_PRESETS = Object.fromEntries(Object.entries({ generic, classic }).map(([name, rows]) =>
  [name, rows.map(([key, label, color], order) => ({ key, label, color, order }))]));
export function validateAreas(areas) {
  if (!Array.isArray(areas) || !areas.length || areas.length > 100) throw new Error("Use 1 to 100 areas.");
  const keys = new Set();
  for (const a of areas) {
    if (!a || typeof a !== "object" || Object.keys(a).some(k => !["key", "label", "color", "order", "vaultDomain"].includes(k))) throw new Error("Use the supported area fields only.");
    if (typeof a.key !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(a.key) || keys.has(a.key)) throw new Error("Use distinct lowercase area keys.");
    keys.add(a.key);
    if (typeof a.label !== "string" || !a.label.trim() || a.label.length > 120) throw new Error("Use an area label of 1 to 120 characters.");
    if (typeof a.color !== "string" || !/^#[0-9a-f]{6}$/i.test(a.color)) throw new Error("Use a six-digit hex area color.");
    if (!Number.isSafeInteger(a.order) || a.order < 0 || a.order > 10000) throw new Error("Use an area order from 0 to 10000.");
    if (a.vaultDomain !== undefined && (typeof a.vaultDomain !== "string" || a.vaultDomain.length > 200)) throw new Error("Use at most 200 characters for vaultDomain.");
  }
  return areas;
}
