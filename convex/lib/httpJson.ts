/** HTTP JSON has a separate encoded-byte budget from Convex values. */
export const HTTP_JSON_BYTES = 8 * 1024 * 1024;
export class HttpCapacityError extends Error {}

/** Count the native serializer's output while it walks a plain response value.
 * Abort before constructing an oversized complete body. JSON.stringify still
 * owns escaping, omission, array nulls, and cycle detection. Individual strings
 * come from bounded Convex documents or fixed application messages. */
export function boundedJson(value: unknown, maxBytes = HTTP_JSON_BYTES): string | undefined {
  const encoder = new TextEncoder();
  const entries = new WeakMap<object, number>();
  let bytes = 0, root = true;
  const add = (n: number) => {
    bytes += n;
    if (bytes > maxBytes) throw new HttpCapacityError("HTTP JSON exceeds 8 MiB.");
  };
  return JSON.stringify(value, function (key, item) {
    const omitted = item === undefined || typeof item === "function" || typeof item === "symbol";
    if (!root) {
      const array = Array.isArray(this);
      if (omitted && !array) return item;
      const count = entries.get(this) ?? 0;
      if (count) add(1); // comma
      entries.set(this, count + 1);
      if (!array) add(encoder.encode(JSON.stringify(key)).byteLength + 1); // colon
    }
    root = false;
    if (item !== null && typeof item === "object") {
      add(2); // opening and closing delimiter
      entries.set(item, 0);
    } else if (omitted) {
      if (Array.isArray(this)) add(4);
    } else {
      add(encoder.encode(JSON.stringify(item)).byteLength);
    }
    return item;
  });
}
