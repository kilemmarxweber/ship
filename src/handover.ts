export type HandoverQrPayload = {
  v: 1 | 2;
  o?: string;
  g?: string;
  c: string;
  s: string;
};

export function qrImageUrl(data: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

export function parseHandoverQrPayload(raw: string): HandoverQrPayload | null {
  const trimmed = raw.trim();
  try {
    const data = JSON.parse(trimmed) as Partial<HandoverQrPayload>;
    if (
      data.v === 2 &&
      typeof data.g === "string" &&
      typeof data.c === "string" &&
      typeof data.s === "string"
    ) {
      return { v: 2, g: data.g, c: data.c.toUpperCase(), s: data.s };
    }
    if (
      data.v === 1 &&
      typeof data.o === "string" &&
      typeof data.c === "string" &&
      typeof data.s === "string"
    ) {
      return { v: 1, o: data.o, c: data.c.toUpperCase(), s: data.s };
    }
  } catch {
    // CHIPSHOP2|handoverId|CODE|shopId
  }
  const parts = trimmed.split("|");
  if (parts[0] === "CHIPSHOP2" && parts.length >= 4) {
    return { v: 2, g: parts[1], c: parts[2].toUpperCase(), s: parts[3] };
  }
  if (parts[0] === "CHIPSHOP" && parts.length >= 4) {
    return { v: 1, o: parts[1], c: parts[2].toUpperCase(), s: parts[3] };
  }
  return null;
}
