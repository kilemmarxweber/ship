import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { EventPoster } from "@/components/events/EventPoster";
import { api, apiUpload, mediaUrl } from "@/src/api";
import { EVENT_POSTERS, eventPosterUrl } from "@/src/event-poster";
import { formatMoney } from "@/src/format";
import { pickMediaLibrary } from "@/src/pick-media";
import { DEFAULT_FX_CDF } from "@/src/product-options";
import {
    FLASH_DATE_PLACEHOLDER,
    FLASH_TIME_PLACEHOLDER,
    fromLocalDateParts,
    maskFlashDate,
    maskFlashTime,
    toLocalDateParts,
} from "@/src/scroll-ad";
import { HAIRLINE } from "@/src/theme";
import type { PublicEvent } from "@/src/tickets";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";

type Sales = {
  gmv: number;
  platformRevenue: number;
  organizerDue: number;
  organizerPaid: number;
  sold: number;
  checkedIn: number;
};

type RefundRow = {
  id: string;
  status: string;
  reason: string;
  eventTitle: string;
  buyer: { name: string };
};

type UserHit = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  kind?: "ARTIST" | "ORGANIZATION";
  orgName?: string;
  shopName?: string;
};

type OrganizerKind = "ARTIST" | "ORGANIZATION";
type FeeMode = "PERCENT" | "FLAT";

const CURRENCIES = ["USD", "CDF", "KW"] as const;

function statusTone(
  status: string,
  c: { emerald: string; live: string; textMuted: string },
) {
  if (status === "ON_SALE") return c.emerald;
  if (status === "CANCELLED") return c.live;
  return c.textMuted;
}

function hitLabel(hit: UserHit) {
  if (hit.orgName && hit.shopName && hit.orgName !== hit.shopName) {
    return `${hit.orgName} · ${hit.shopName}`;
  }
  return hit.orgName || hit.shopName || hit.name;
}

function matchHit(
  query: string,
  hits: UserHit[],
  loose = false,
): UserHit | null {
  const needle = query.trim().toLowerCase();
  if (!needle || hits.length === 0) return null;
  const exact = hits.filter((hit) => {
    const label = hitLabel(hit).toLowerCase();
    return (
      hit.name.toLowerCase() === needle ||
      label === needle ||
      (hit.email && hit.email.toLowerCase() === needle)
    );
  });
  if (exact.length === 1) return exact[0] ?? null;
  if (!loose) return null;
  if (hits.length === 1) return hits[0] ?? null;
  const starts = hits.filter(
    (hit) =>
      hit.name.toLowerCase().startsWith(needle) ||
      hitLabel(hit).toLowerCase().startsWith(needle),
  );
  if (starts.length === 1) return starts[0] ?? null;
  return null;
}

export function EventTicketSettings() {
  const c = useColors();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [salesState, setSalesState] = useState<{
    eventId: string;
    sales: Sales | null;
  } | null>(null);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [organizerKind, setOrganizerKind] = useState<OrganizerKind>("ARTIST");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerUserId, setOrganizerUserId] = useState("");
  const [pickedLabel, setPickedLabel] = useState("");
  const [userHitResults, setUserHitResults] = useState<{
    query: string;
    kind: OrganizerKind;
    hits: UserHit[];
  } | null>(null);
  const pickedIdRef = useRef("");
  const [feeMode, setFeeMode] = useState<FeeMode>("PERCENT");
  const [feePct, setFeePct] = useState("10");
  const [feeFlat, setFeeFlat] = useState("2");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("10");
  const [quota, setQuota] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [fxCdf, setFxCdf] = useState(String(DEFAULT_FX_CDF));
  const [fxConfirmed, setFxConfirmed] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const sales = salesState?.eventId === selectedId ? salesState.sales : null;
  const currentQuery = organizerName.trim();
  const userHits =
    userHitResults?.query === currentQuery &&
    userHitResults.kind === organizerKind
      ? userHitResults.hits
      : [];

  function setUserHits(hits: UserHit[]) {
    setUserHitResults({
      query: currentQuery,
      kind: organizerKind,
      hits,
    });
  }

  const load = useCallback(async () => {
    const [ev, rf] = await Promise.all([
      api<{ events?: PublicEvent[] }>("/api/admin/events"),
      api<{ refunds?: RefundRow[] }>("/api/admin/ticket-refunds"),
    ]);
    setEvents(ev.events ?? []);
    setRefunds(rf.refunds ?? []);
  }, []);

  const pickHit = useCallback(
    (hit: UserHit, closeList = true) => {
      const label = hitLabel(hit);
      pickedIdRef.current = hit.id;
      setOrganizerUserId(hit.id);
      setPickedLabel(label);
      setOrganizerName((current) => current.trim() || label);
      if (closeList) {
        setUserHitResults({
          query: organizerName.trim(),
          kind: organizerKind,
          hits: [],
        });
      }
    },
    [organizerKind, organizerName],
  );

  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!selectedId || selectedId === "new") return;
    void api<{ sales?: Sales }>(`/api/admin/events/${selectedId}/sales`)
      .then((data) =>
        setSalesState({ eventId: selectedId, sales: data.sales ?? null }),
      )
      .catch(() => setSalesState({ eventId: selectedId, sales: null }));
  }, [selectedId]);

  const searchHits = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (q.length < 2) return [] as UserHit[];
      const data = await api<{ users?: UserHit[] }>(
        `/api/admin/events/users?kind=${organizerKind}&q=${encodeURIComponent(q)}`,
      );
      return data.users ?? [];
    },
    [organizerKind],
  );

  useEffect(() => {
    const q = organizerName.trim();
    if (q.length < 2) return;
    if (pickedIdRef.current && q === pickedLabel.trim()) return;
    const timer = setTimeout(() => {
      void searchHits(q)
        .then((hits) => {
          setUserHitResults({ query: q, kind: organizerKind, hits });
          const auto = matchHit(q, hits);
          if (auto && !pickedIdRef.current) pickHit(auto, true);
        })
        .catch(() =>
          setUserHitResults({ query: q, kind: organizerKind, hits: [] }),
        );
    }, 250);
    return () => clearTimeout(timer);
  }, [organizerName, organizerKind, pickedLabel, searchHits, pickHit]);

  function pickKind(next: OrganizerKind) {
    if (next === organizerKind) return;
    setOrganizerKind(next);
    setOrganizerUserId("");
    pickedIdRef.current = "";
    setPickedLabel("");
    setUserHits([]);
  }

  function resetNew() {
    setSelectedId("new");
    setTitle("");
    setVenue("");
    setCity("");
    setOrganizerKind("ARTIST");
    setOrganizerName("");
    setOrganizerUserId("");
    pickedIdRef.current = "";
    setPickedLabel("");
    setUserHits([]);
    setFeeMode("PERCENT");
    setFeePct("10");
    setFeeFlat("2");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setPrice("10");
    setQuota("100");
    setCurrency("USD");
    setFxCdf(String(DEFAULT_FX_CDF));
    setFxConfirmed(false);
    setImageUrl("");
  }

  function fill(event: PublicEvent) {
    setSelectedId(event.id);
    setTitle(event.title);
    setVenue(event.venue);
    setCity(event.city);
    setImageUrl(event.imageUrl ?? "");
    setOrganizerKind(
      event.organizerKind === "ORGANIZATION" ? "ORGANIZATION" : "ARTIST",
    );
    setOrganizerName(event.organizerName);
    setOrganizerUserId(event.organizerUserId ?? "");
    pickedIdRef.current = event.organizerUserId ?? "";
    setPickedLabel(event.organizerName);
    setUserHits([]);
    setFeeMode(event.platformFeeMode === "FLAT" ? "FLAT" : "PERCENT");
    setFeePct(String((event.platformFeeBps ?? 0) / 100));
    setFeeFlat(String((event.platformFeeCents ?? 0) / 100));
    const start = toLocalDateParts(event.startsAt);
    const end = toLocalDateParts(event.endsAt);
    setStartDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
    setCurrency(event.currency);
    setFxCdf(String(event.fxCdfPerUsd ?? DEFAULT_FX_CDF));
    setFxConfirmed(true);
    const type = event.ticketTypes[0];
    if (type) {
      setPrice(String(type.priceCents / 100));
      setQuota(String(type.quota));
    }
  }

  async function save() {
    const typed = organizerName.trim() || pickedLabel.trim();
    if (typed.length < 2) {
      showToast(
        organizerKind === "ORGANIZATION"
          ? "Indique le nom de l’organisation"
          : "Indique le nom de l’artiste",
      );
      return;
    }
    setBusy(true);
    try {
      const userId = pickedIdRef.current || organizerUserId || undefined;
      const startsAt = fromLocalDateParts(startDate, startTime);
      const endsAt = fromLocalDateParts(endDate, endTime);
      if (!startsAt || !endsAt) {
        showToast("Indique début et fin");
        return;
      }
      if (!fxConfirmed) {
        showToast("Valide le taux de change du jour");
        return;
      }
      const fxCdfPerUsd = Number.parseInt(fxCdf, 10) || DEFAULT_FX_CDF;
      const data = await api<{ event?: PublicEvent; error?: string }>(
        "/api/admin/events",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            description: title,
            venue,
            city,
            currency,
            fxCdfPerUsd,
            organizerKind,
            organizerName: typed,
            imageUrl:
              imageUrl.trim() ||
              eventPosterUrl(null, `${title}|${organizerName}`),
            ...(userId ? { organizerUserId: userId } : {}),
            platformFeeMode: feeMode,
            platformFeeBps: Math.round(Number(feePct) * 100),
            platformFeeCents: Math.round(Number(feeFlat) * 100),
            startsAt,
            endsAt,
            ticketTypes: [
              {
                name: "Standard",
                description: "",
                priceCents: Math.round(Number(price) * 100),
                quota: Number(quota),
              },
            ],
          }),
        },
      );
      if (data.event) fill(data.event);
      showToast("Événement enregistré");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string) {
    if (!selectedId || selectedId === "new") return;
    setBusy(true);
    try {
      if (action === "promote") {
        await api(`/api/admin/events/${selectedId}/promote`, {
          method: "POST",
          body: "{}",
        });
      } else {
        await api(`/api/admin/events/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({ action }),
        });
      }
      showToast("OK");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible");
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "APPROVE" | "REJECT") {
    try {
      await api("/api/admin/ticket-refunds", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      });
      showToast(action === "APPROVE" ? "Remboursé" : "Refusé");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Impossible");
    }
  }

  async function uploadPoster() {
    try {
      setBusy(true);
      const assets = await pickMediaLibrary({ kind: "images", limit: 1 });
      const asset = assets[0];
      if (!asset) return;
      const form = new FormData();
      await appendUploadFile(form, asset);
      form.append("variant", "product");
      const uploaded = await apiUpload<{ url?: string }>("/api/upload", form);
      if (!uploaded.url) throw new Error("Affiche non reçue");
      setImageUrl(uploaded.url);
      if (selectedId && selectedId !== "new") {
        await api(`/api/admin/events/${selectedId}`, {
          method: "PATCH",
          body: JSON.stringify({ imageUrl: uploaded.url }),
        });
        await load();
      }
      showToast("Affiche ajoutée");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
  ];
  const isOrg = organizerKind === "ORGANIZATION";

  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: HAIRLINE }]}
    >
      <View style={styles.head}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: "rgba(255,77,141,0.14)" },
          ]}
        >
          <Ionicons name="ticket-outline" size={18} color={c.buyStart} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: c.text }]}>
            Vente de billets
          </Text>
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Sur demande · commission ShipShop
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Pressable
          onPress={resetNew}
          style={[
            styles.chip,
            {
              backgroundColor:
                selectedId === "new" ? c.buyStart : "rgba(127,127,140,0.12)",
              borderColor: selectedId === "new" ? c.buyStart : "transparent",
            },
          ]}
        >
          <Ionicons
            name="add"
            size={14}
            color={selectedId === "new" ? "#fff" : c.text}
          />
          <Text
            style={[
              styles.chipText,
              { color: selectedId === "new" ? "#fff" : c.text },
            ]}
          >
            Nouveau
          </Text>
        </Pressable>
        {events.map((event) => {
          const on = selectedId === event.id;
          return (
            <Pressable
              key={event.id}
              onPress={() => fill(event)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? c.buyStart : "rgba(127,127,140,0.12)",
                  borderColor: on ? c.buyStart : "transparent",
                },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: on ? "#fff" : statusTone(event.status, c),
                  },
                ]}
              />
              <Text
                style={[styles.chipText, { color: on ? "#fff" : c.text }]}
                numberOfLines={1}
              >
                {event.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedId ? (
        <View style={{ gap: 12 }}>
          <Text style={[styles.label, { color: c.text }]}>Bénéficiaire</Text>
          <View style={styles.kindRow}>
            {(
              [
                ["ARTIST", "Artiste", "mic-outline"],
                ["ORGANIZATION", "Organisation", "business-outline"],
              ] as const
            ).map(([key, label, icon]) => {
              const on = organizerKind === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => pickKind(key)}
                  style={[
                    styles.kindBtn,
                    {
                      borderColor: on ? c.buyStart : HAIRLINE,
                      backgroundColor: on
                        ? "rgba(255,77,141,0.12)"
                        : "rgba(127,127,140,0.08)",
                    },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={on ? c.buyStart : c.textMuted}
                  />
                  <Text style={[styles.kindTitle, { color: c.text }]}>
                    {label}
                  </Text>
                  <Text style={[styles.kindMeta, { color: c.textMuted }]}>
                    {key === "ARTIST" ? "Compte perso" : "Boutique ou org"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {organizerName.trim().length >= 2 ? (
            <View
              style={[
                styles.picked,
                { backgroundColor: "rgba(255,77,141,0.12)" },
              ]}
            >
              <Ionicons
                name={isOrg ? "business" : "mic"}
                size={16}
                color={c.buyStart}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.pickedName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {organizerName.trim()}
                </Text>
                <Text style={[styles.kindMeta, { color: c.textMuted }]}>
                  {isOrg ? "Organisation" : "Artiste"}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={c.emerald} />
            </View>
          ) : null}

          <View
            style={[
              styles.search,
              { backgroundColor: "rgba(127,127,140,0.12)" },
            ]}
          >
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              value={organizerName}
              onChangeText={setOrganizerName}
              placeholder={isOrg ? "Nom de l’organisation" : "Nom de l’artiste"}
              placeholderTextColor={c.textMuted}
              style={[styles.searchInput, { color: c.text }]}
            />
          </View>
          {userHits.map((hit) => (
            <Pressable
              key={hit.id}
              onPress={() => pickHit(hit)}
              style={[styles.hit, { borderColor: HAIRLINE }]}
            >
              <Ionicons
                name={isOrg ? "business-outline" : "person-outline"}
                size={16}
                color={c.textMuted}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.hitName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {hitLabel(hit)}
                </Text>
                <Text
                  style={[styles.kindMeta, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {hit.name}
                  {hit.email ? ` · ${hit.email}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}

          <Text style={[styles.label, { color: c.text }]}>Affiche</Text>
          <EventPoster
            eventId={
              selectedId === "new"
                ? title || organizerName || "new"
                : selectedId
            }
            imageUrl={imageUrl || null}
            title={title || "Aperçu"}
            organizerName={organizerName || undefined}
            kind={organizerKind}
            tall
            style={styles.posterPreview}
          />
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posterStrip}
          >
            <Pressable
              onPress={() => void uploadPoster()}
              disabled={busy}
              style={[styles.posterPick, { borderColor: c.buyStart }]}
            >
              <Ionicons name="image-outline" size={20} color={c.buyStart} />
              <Text style={[styles.posterPickText, { color: c.buyStart }]}>
                Importer
              </Text>
            </Pressable>
            {EVENT_POSTERS.map((url) => {
              const on = imageUrl === url;
              return (
                <Pressable
                  key={url}
                  onPress={() => {
                    setImageUrl(url);
                    if (selectedId && selectedId !== "new") {
                      void api(`/api/admin/events/${selectedId}`, {
                        method: "PATCH",
                        body: JSON.stringify({ imageUrl: url }),
                      })
                        .then(() => {
                          showToast("Affiche enregistrée");
                          return load();
                        })
                        .catch(() => showToast("Affiche non sauvée"));
                    }
                  }}
                  style={[
                    styles.posterThumbWrap,
                    on && { borderColor: c.buyStart },
                  ]}
                >
                  <Image
                    source={{ uri: mediaUrl(url) ?? url }}
                    style={styles.posterThumb}
                    contentFit="cover"
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          {imageUrl ? (
            <Pressable onPress={() => setImageUrl("")}>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                Retirer l’affiche (affiche auto)
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.label, { color: c.text }]}>Événement</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titre"
            placeholderTextColor={c.textMuted}
            style={inputStyle}
          />
          <View style={styles.row}>
            <TextInput
              value={venue}
              onChangeText={setVenue}
              placeholder="Lieu"
              placeholderTextColor={c.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Ville"
              placeholderTextColor={c.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>
          <DateTimeFields
            label="Début"
            date={startDate}
            time={startTime}
            onDate={setStartDate}
            onTime={setStartTime}
            text={c.text}
            muted={c.textMuted}
          />
          <DateTimeFields
            label="Fin"
            date={endDate}
            time={endTime}
            onDate={setEndDate}
            onTime={setEndTime}
            text={c.text}
            muted={c.textMuted}
          />

          <Text style={[styles.label, { color: c.text }]}>
            Commission ShipShop
          </Text>
          <View style={styles.row}>
            {(
              [
                ["PERCENT", "%"],
                ["FLAT", "Chiffre"],
              ] as const
            ).map(([key, label]) => {
              const on = feeMode === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFeeMode(key)}
                  style={[
                    styles.seg,
                    {
                      backgroundColor: on
                        ? c.buyStart
                        : "rgba(127,127,140,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: on ? "#fff" : c.text }]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              value={feeMode === "PERCENT" ? feePct : feeFlat}
              onChangeText={feeMode === "PERCENT" ? setFeePct : setFeeFlat}
              keyboardType="decimal-pad"
              placeholder={feeMode === "PERCENT" ? "10" : "2"}
              placeholderTextColor={c.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>

          <Text style={[styles.label, { color: c.text }]}>Billet</Text>
          <View style={styles.row}>
            {CURRENCIES.map((code) => {
              const on = currency === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setCurrency(code)}
                  style={[
                    styles.seg,
                    {
                      backgroundColor: on
                        ? c.primary
                        : "rgba(127,127,140,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: on ? "#fff" : c.text }]}
                  >
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, { color: c.text }]}>
            Taux du jour (1 $US = N CDF)
          </Text>
          <TextInput
            value={fxCdf}
            onChangeText={(value) => {
              setFxCdf(value.replace(/[^\d]/g, ""));
              setFxConfirmed(false);
            }}
            keyboardType="number-pad"
            placeholder={String(DEFAULT_FX_CDF)}
            placeholderTextColor={c.textMuted}
            style={inputStyle}
            editable={selectedId === "new"}
          />
          {selectedId === "new" ? (
            <Pressable
              onPress={() => setFxConfirmed((v) => !v)}
              style={styles.check}
            >
              <Text style={{ color: c.text }}>
                {fxConfirmed ? "☑ " : "☐ "}Je valide le taux du jour
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              Taux figé à la création — utilisé pour payer en $US / CDF / KW
            </Text>
          )}
          <View style={styles.row}>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="Prix"
              placeholderTextColor={c.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
            <TextInput
              value={quota}
              onChangeText={setQuota}
              keyboardType="number-pad"
              placeholder="Quota"
              placeholderTextColor={c.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
          </View>

          {selectedId === "new" ? (
            <Pressable
              style={[
                styles.save,
                { backgroundColor: c.emerald, opacity: busy ? 0.6 : 1 },
              ]}
              disabled={busy}
              onPress={() => void save()}
            >
              <Text style={styles.saveText}>{busy ? "…" : "Enregistrer"}</Text>
            </Pressable>
          ) : (
            <View style={styles.actions}>
              <Pressable
                style={[styles.save, { backgroundColor: c.emerald, flex: 1 }]}
                disabled={busy}
                onPress={() => void act("publish")}
              >
                <Text style={styles.saveText}>Publier</Text>
              </Pressable>
              <Pressable
                style={[styles.save, { backgroundColor: c.primary, flex: 1 }]}
                disabled={busy}
                onPress={() => void act("promote")}
              >
                <Text style={styles.primaryText}>Pubs</Text>
              </Pressable>
              <Pressable
                style={[styles.ghost, { borderColor: HAIRLINE }]}
                disabled={busy}
                onPress={() => void act("settle")}
              >
                <Text style={[styles.ghostText, { color: c.text }]}>
                  Verser
                </Text>
              </Pressable>
              <Pressable
                style={[styles.ghost, { borderColor: c.live }]}
                disabled={busy}
                onPress={() => void act("cancel")}
              >
                <Text style={[styles.ghostText, { color: c.live }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                style={[styles.ghost, { borderColor: HAIRLINE }]}
                onPress={() => router.push("/profile/ticket-scan" as Href)}
              >
                <Ionicons name="qr-code-outline" size={16} color={c.text} />
                <Text style={[styles.ghostText, { color: c.text }]}>
                  Scanner
                </Text>
              </Pressable>
            </View>
          )}

          {sales ? (
            <View
              style={[
                styles.kpis,
                {
                  backgroundColor: "rgba(0,214,143,0.1)",
                  borderColor: "rgba(0,214,143,0.25)",
                },
              ]}
            >
              <Text style={[styles.kpiValue, { color: c.emerald }]}>
                {formatMoney(sales.platformRevenue, currency)}
              </Text>
              <Text style={[styles.kindMeta, { color: c.textMuted }]}>
                Revenu ShipShop · GMV {formatMoney(sales.gmv, currency)} · dû{" "}
                {formatMoney(sales.organizerDue, currency)} · {sales.sold}{" "}
                billets
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Nouveau pour lancer un event, ou ouvre un existant.
        </Text>
      )}

      {refunds.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: c.text }]}>Remboursements</Text>
          {refunds.map((row) => (
            <View
              key={row.id}
              style={[styles.refund, { borderColor: HAIRLINE }]}
            >
              <Text style={[styles.hitName, { color: c.text }]}>
                {row.eventTitle} · {row.buyer.name}
              </Text>
              <Text style={[styles.kindMeta, { color: c.textMuted }]}>
                {row.status}
              </Text>
              {row.status === "PENDING" ? (
                <View style={styles.row}>
                  <Pressable
                    style={[styles.seg, { backgroundColor: c.emerald }]}
                    onPress={() => void review(row.id, "APPROVE")}
                  >
                    <Text style={styles.saveText}>Accepter</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.ghost, { borderColor: HAIRLINE }]}
                    onPress={() => void review(row.id, "REJECT")}
                  >
                    <Text style={[styles.ghostText, { color: c.text }]}>
                      Refuser
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DateTimeFields({
  label,
  date,
  time,
  onDate,
  onTime,
  text,
  muted,
}: {
  label: string;
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  text: string;
  muted: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={date}
          onChangeText={(value) => onDate(maskFlashDate(value))}
          placeholder={FLASH_DATE_PLACEHOLDER}
          placeholderTextColor={muted}
          keyboardType="number-pad"
          maxLength={10}
          autoCapitalize="none"
          style={[
            styles.input,
            { flex: 1, color: text, backgroundColor: "rgba(127,127,140,0.12)" },
          ]}
        />
        <TextInput
          value={time}
          onChangeText={(value) => onTime(maskFlashTime(value))}
          placeholder={FLASH_TIME_PLACEHOLDER}
          placeholderTextColor={muted}
          keyboardType="number-pad"
          maxLength={5}
          autoCapitalize="none"
          style={[
            styles.input,
            {
              width: 92,
              textAlign: "center",
              color: text,
              backgroundColor: "rgba(127,127,140,0.12)",
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", includeFontPadding: false },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  label: { fontSize: 13, fontWeight: "800", includeFontPadding: false },
  posterPreview: {
    width: "100%",
    height: 200,
    borderRadius: 18,
    minHeight: 200,
  },
  posterStrip: { gap: 8, paddingRight: 8 },
  posterPick: {
    width: 72,
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  posterPickText: { fontSize: 10, fontWeight: "800" },
  posterThumbWrap: {
    width: 72,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  posterThumb: { width: "100%", height: "100%" },
  chips: { flexDirection: "row", gap: 8, paddingRight: 8 },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
    includeFontPadding: false,
    maxWidth: 160,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  kindRow: { flexDirection: "row", gap: 8 },
  kindBtn: {
    flex: 1,
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 2,
    padding: 12,
    gap: 4,
  },
  kindTitle: { fontWeight: "800", fontSize: 14, includeFontPadding: false },
  kindMeta: { fontSize: 11, fontWeight: "600" },
  picked: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickedName: { fontWeight: "800", fontSize: 14, includeFontPadding: false },
  search: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  hit: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hitName: { fontWeight: "700", fontSize: 14, includeFontPadding: false },
  input: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontWeight: "700",
    fontSize: 14,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  seg: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  save: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#04281c", fontWeight: "800" },
  primaryText: { color: "#fff", fontWeight: "800" },
  ghost: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ghostText: { fontWeight: "800", fontSize: 13, includeFontPadding: false },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  check: { paddingVertical: 4 },
  kpis: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  kpiValue: { fontSize: 22, fontWeight: "800" },
  refund: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
});
