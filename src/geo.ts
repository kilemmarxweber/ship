import { requireOptionalNativeModule } from "expo-modules-core";
import * as ExpoLocation from "expo-location";
import { Linking, Platform } from "react-native";

export type GeoCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type GeoErrorCode = "permission" | "services" | "unavailable";

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toCoords(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): GeoCoords {
  const accuracy = coords.accuracy;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy:
      typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy > 0
        ? accuracy
        : null,
  };
}

export async function openDeviceLocationSettings() {
  if (Platform.OS === "android") {
    try {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return;
    } catch {
      await Linking.openSettings();
      return;
    }
  }
  await Linking.openSettings();
}

export async function openAppPermissionSettings() {
  await Linking.openSettings();
}

function loadExpoLocation() {
  const native = requireOptionalNativeModule("ExpoLocation");
  if (!native) return null;
  return ExpoLocation;
}

async function fromExpoLocation(
  Location: typeof import("expo-location"),
): Promise<GeoCoords> {
  let enabled = await Location.hasServicesEnabledAsync();
  if (!enabled && Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
      enabled = await Location.hasServicesEnabledAsync();
    } catch {
      enabled = false;
    }
  }
  if (!enabled) {
    throw new GeoError("services", "Localisation système désactivée");
  }

  const current = await Location.getForegroundPermissionsAsync();
  const status =
    current.status === "granted"
      ? current.status
      : (await Location.requestForegroundPermissionsAsync()).status;
  if (status !== "granted") {
    throw new GeoError("permission", "Permission de localisation refusée");
  }

  const last = await Location.getLastKnownPositionAsync();
  try {
    const fresh = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return toCoords(fresh.coords);
  } catch {
    if (last) return toCoords(last.coords);
    throw new GeoError("unavailable", "Position introuvable");
  }
}

function fromBrowserGeo(): Promise<GeoCoords> {
  const geo = globalThis.navigator?.geolocation;
  if (!geo?.getCurrentPosition) {
    return Promise.reject(new GeoError("unavailable", "GPS indisponible"));
  }
  return new Promise((resolve, reject) => {
    geo.getCurrentPosition(
      (position) => resolve(toCoords(position.coords)),
      () => reject(new GeoError("unavailable", "GPS refusé ou indisponible")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  });
}

export async function getDeviceCoords(): Promise<GeoCoords> {
  const Location = loadExpoLocation();
  if (Location) return fromExpoLocation(Location);
  return fromBrowserGeo();
}

export function watchDeviceCoords(
  onCoords: (coords: GeoCoords) => void,
): () => void {
  let cancelled = false;
  const Location = loadExpoLocation();
  if (Location) {
    let sub: { remove: () => void } | null = null;
    void (async () => {
      try {
        let enabled = await Location.hasServicesEnabledAsync();
        if (!enabled && Platform.OS === "android") {
          try {
            await Location.enableNetworkProviderAsync();
            enabled = await Location.hasServicesEnabledAsync();
          } catch {
            enabled = false;
          }
        }
        if (!enabled) return;
        const current = await Location.getForegroundPermissionsAsync();
        const status =
          current.status === "granted"
            ? current.status
            : (await Location.requestForegroundPermissionsAsync()).status;
        if (status !== "granted" || cancelled) return;
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 8,
          },
          (position) => onCoords(toCoords(position.coords)),
        );
      } catch {
        return;
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }
  const geo = globalThis.navigator?.geolocation;
  if (!geo?.watchPosition) return () => undefined;
  const watchId = geo.watchPosition(
    (position) => onCoords(toCoords(position.coords)),
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 4000 },
  );
  return () => geo.clearWatch(watchId);
}

export function geoErrorCode(error: unknown): GeoErrorCode {
  return error instanceof GeoError ? error.code : "unavailable";
}
