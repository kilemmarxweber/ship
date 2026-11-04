import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api } from "@/src/api";
import { colors } from "@/src/theme";

export type MapPoint = { lat: number; lng: number };
type Seg = { lat: number; lng: number; color?: string };
type XY = { x: number; y: number };
type Tile = { key: string; x: number; y: number; left: number; top: number };

const KINSHASA: MapPoint = { lat: -4.325, lng: 15.322 };
const TILE_SIZE = 256;
const MAP_PAD = 52;
const TILE_HEADERS = {
  Accept: "image/png",
  "User-Agent": "ShipShop/1.0 (live-tracking; mobile)",
};
const TILE_HOSTS = [
  (z: number, x: number, y: number) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  (z: number, x: number, y: number) =>
    `https://tile.openstreetmap.de/${z}/${x}/${y}.png`,
  (z: number, x: number, y: number) =>
    `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
];

function lonToX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToY(lat: number, zoom: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom
  );
}

function bearingDeg(from: MapPoint, to: MapPoint) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function fitView(points: MapPoint[], width: number, height: number) {
  if (points.length === 0) return { center: KINSHASA, zoom: 13 };
  if (points.length === 1) return { center: points[0], zoom: 15 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  for (let zoom = 17; zoom >= 10; zoom--) {
    const dx = Math.abs(
      lonToX(Math.max(...lngs), zoom) - lonToX(Math.min(...lngs), zoom),
    );
    const dy = Math.abs(
      latToY(Math.min(...lats), zoom) - latToY(Math.max(...lats), zoom),
    );
    if (dx + MAP_PAD * 2 <= width && dy + MAP_PAD * 2 <= height) {
      return { center, zoom };
    }
  }
  return { center, zoom: 12 };
}

function tilesFor(
  center: MapPoint,
  zoom: number,
  width: number,
  height: number,
): Tile[] {
  const cx = lonToX(center.lng, zoom);
  const cy = latToY(center.lat, zoom);
  const left = cx - width / 2;
  const top = cy - height / 2;
  const n = 2 ** zoom;
  const x0 = Math.floor(left / TILE_SIZE);
  const y0 = Math.floor(top / TILE_SIZE);
  const x1 = Math.floor((left + width) / TILE_SIZE);
  const y1 = Math.floor((top + height) / TILE_SIZE);
  const out: Tile[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      const tx = ((x % n) + n) % n;
      out.push({
        key: `${zoom}-${tx}-${y}`,
        x: tx,
        y,
        left: x * TILE_SIZE - left,
        top: y * TILE_SIZE - top,
      });
    }
  }
  return out;
}

function project(
  point: MapPoint,
  center: MapPoint,
  zoom: number,
  width: number,
  height: number,
): XY {
  return {
    x: width / 2 + lonToX(point.lng, zoom) - lonToX(center.lng, zoom),
    y: height / 2 + latToY(point.lat, zoom) - latToY(center.lat, zoom),
  };
}

function DashedRoute({ from, to }: { from: XY; to: XY }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.dash,
        {
          width: length,
          left: (from.x + to.x) / 2 - length / 2,
          top: (from.y + to.y) / 2 - 1.5,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
}

export function ParcelMap({
  courier,
  destination,
  etaText,
  distanceKm,
  live,
  mode = "buyer",
  label = "En route",
}: {
  courier: MapPoint | null;
  destination: MapPoint | null;
  etaText?: string | null;
  distanceKm?: number | null;
  live?: boolean;
  mode?: "buyer" | "courier" | "pin";
  label?: string;
}) {
  const [path, setPath] = useState<Seg[]>([]);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 340, height: 280 });
  const [hostIndex, setHostIndex] = useState(0);
  const [tilesReady, setTilesReady] = useState(false);
  const [display, setDisplay] = useState<MapPoint | null>(courier);
  const [heading, setHeading] = useState(0);
  const prevGps = useRef<MapPoint | null>(null);
  const displayRef = useRef<MapPoint | null>(courier);
  const courierLat = courier?.lat;
  const courierLng = courier?.lng;
  const destLat = destination?.lat;
  const destLng = destination?.lng;

  useEffect(() => {
    if (
      mode !== "courier" ||
      courierLat == null ||
      courierLng == null ||
      destLat == null ||
      destLng == null
    ) {
      return;
    }
    const q = new URLSearchParams({
      fromLat: String(courierLat),
      fromLng: String(courierLng),
      toLat: String(destLat),
      toLng: String(destLng),
    });
    void api<{ segments?: Seg[]; path?: MapPoint[]; note?: string }>(
      `/api/directions?${q}`,
    )
      .then((data) => {
        if (data.segments?.length) setPath(data.segments);
        else if (data.path?.length) setPath(data.path);
        setRouteNote(typeof data.note === "string" ? data.note : null);
      })
      .catch(() => undefined);
  }, [mode, courierLat, courierLng, destLat, destLng]);

  useEffect(() => {
    if (courierLat == null || courierLng == null) return;
    const to = { lat: courierLat, lng: courierLng };
    const from = displayRef.current ?? to;
    const moved =
      prevGps.current &&
      (Math.abs(prevGps.current.lat - to.lat) > 0.00001 ||
        Math.abs(prevGps.current.lng - to.lng) > 0.00001);
    const nextHeading = moved ? bearingDeg(from, to) : null;
    prevGps.current = to;

    const start = Date.now();
    const duration = 900;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const ease = 1 - (1 - t) ** 2;
      const next = {
        lat: from.lat + (to.lat - from.lat) * ease,
        lng: from.lng + (to.lng - from.lng) * ease,
      };
      displayRef.current = next;
      setDisplay(next);
      if (nextHeading != null) setHeading(nextHeading);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [courierLat, courierLng]);

  const camera = useMemo(() => {
    if (mode === "pin" && destLat != null && destLng != null) {
      return { center: { lat: destLat, lng: destLng }, zoom: 17 };
    }
    const points: MapPoint[] = [];
    if (courierLat != null && courierLng != null) {
      points.push({ lat: courierLat, lng: courierLng });
    }
    if (destLat != null && destLng != null) {
      points.push({ lat: destLat, lng: destLng });
    }
    return fitView(points, box.width, box.height);
  }, [mode, courierLat, courierLng, destLat, destLng, box.width, box.height]);

  const centerLat = camera.center.lat;
  const centerLng = camera.center.lng;
  const zoom = camera.zoom;
  const tiles = useMemo(
    () =>
      tilesFor({ lat: centerLat, lng: centerLng }, zoom, box.width, box.height),
    [centerLat, centerLng, zoom, box.width, box.height],
  );

  const tileUrl = TILE_HOSTS[Math.min(hostIndex, TILE_HOSTS.length - 1)];

  const shown =
    courierLat != null && courierLng != null
      ? (display ?? { lat: courierLat, lng: courierLng })
      : null;
  const cameraPoint = { lat: centerLat, lng: centerLng };
  const from = shown
    ? project(shown, cameraPoint, zoom, box.width, box.height)
    : null;
  const to = destination
    ? project(destination, cameraPoint, zoom, box.width, box.height)
    : null;
  const road =
    mode === "courier"
      ? path
          .filter((_, index) => index % 4 === 0)
          .map((point) =>
            project(point, cameraPoint, zoom, box.width, box.height),
          )
      : [];
  function onTileError() {
    setHostIndex((index) => Math.min(index + 1, TILE_HOSTS.length - 1));
  }

  if (!courier && !destination) {
    return (
      <View style={styles.empty}>
        <Ionicons name="navigate-outline" size={22} color={colors.muted} />
        <Text style={styles.emptyText}>Position livreur en attente…</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setBox({ width, height });
      }}
    >
      <View style={styles.canvas}>
        {tiles.map((tile) => (
          <Image
            key={`${hostIndex}-${tile.key}`}
            source={{
              uri: tileUrl(zoom, tile.x, tile.y),
              headers: TILE_HEADERS,
            }}
            style={[styles.tile, { left: tile.left, top: tile.top }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onLoad={() => setTilesReady(true)}
            onError={onTileError}
          />
        ))}
      </View>
      {!tilesReady ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#0f766e" />
          <Text style={styles.loadingText}>Chargement de la carte…</Text>
        </View>
      ) : null}
      <View style={styles.overlay} pointerEvents="none">
        {from &&
        to &&
        mode !== "pin" &&
        !(mode === "courier" && path.length > 1) ? (
          <DashedRoute from={from} to={to} />
        ) : null}
        {road.map((point, index) => (
          <View
            key={`${point.x}-${index}`}
            style={[
              styles.roadDot,
              {
                left: point.x - 3,
                top: point.y - 3,
                backgroundColor: path[index * 4]?.color ?? "#22c55e",
              },
            ]}
          />
        ))}
        {to ? (
          <View style={[styles.destWrap, { left: to.x - 14, top: to.y - 36 }]}>
            <Ionicons name="location" size={28} color="#2563eb" />
          </View>
        ) : null}
        {from && mode !== "pin" ? (
          <View
            style={[
              styles.motoWrap,
              {
                left: from.x - 20,
                top: from.y - 20,
                transform: [{ rotate: `${heading}deg` }],
              },
            ]}
          >
            <Text style={styles.moto}>🛵</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.attrib}>© OpenStreetMap</Text>
      <View style={styles.hud}>
        <Text style={styles.hudLive}>
          {mode === "pin"
            ? `📍 ${label}`
            : `${live ? "● Temps réel  " : ""}🛵 ${label}`}
        </Text>
        {distanceKm != null ? (
          <Text style={styles.hudMeta}>{distanceKm} km</Text>
        ) : null}
        {etaText ? <Text style={styles.hudEta}>ETA {etaText}</Text> : null}
        {routeNote ? <Text style={styles.hudNote}>{routeNote}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 280,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e8e4dc",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  canvas: { ...StyleSheet.absoluteFill },
  tile: {
    position: "absolute",
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  overlay: { ...StyleSheet.absoluteFill },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(232,228,220,0.72)",
  },
  loadingText: { color: "#44403c", fontSize: 12, fontWeight: "700" },
  dash: {
    position: "absolute",
    height: 0,
    borderTopWidth: 3,
    borderStyle: "dashed",
    borderColor: "#ff5722",
    opacity: 0.9,
  },
  destWrap: {
    position: "absolute",
    width: 28,
    height: 36,
    alignItems: "center",
  },
  motoWrap: {
    position: "absolute",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  moto: {
    fontSize: 28,
    lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  roadDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  attrib: {
    position: "absolute",
    right: 8,
    top: 8,
    color: "rgba(0,0,0,0.55)",
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hud: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  hudLive: { color: colors.emerald, fontWeight: "800", fontSize: 11 },
  hudMeta: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  hudEta: { color: colors.emerald, fontWeight: "800", fontSize: 11 },
  hudNote: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "600",
    width: "100%",
  },
  empty: {
    height: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#16161c",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { color: colors.muted, fontSize: 13 },
});
