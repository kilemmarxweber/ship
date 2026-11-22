import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

import { api, apiUpload, isVideoUrl } from "@/src/api";
import { useT } from "@/src/i18n";
import { pickMediaLibrary } from "@/src/pick-media";
import {
    clampScrollAdDelay,
    clampScrollAdPriority,
    clipName,
    FLASH_DATE_PLACEHOLDER,
    FLASH_TIME_PLACEHOLDER,
    fromLocalDateParts,
    maskFlashDate,
    maskFlashTime,
    nextPriority,
    parseScrollAdVideos,
    SCROLL_AD_DEFAULT_DELAY,
    SCROLL_AD_DEFAULT_VIDEO,
    SCROLL_AD_MAX_VIDEOS,
    toLocalDateParts,
    type ScrollAdClip,
} from "@/src/scroll-ad";
import { useSession } from "@/src/session";
import { showToast } from "@/src/toast";
import { appendUploadFile } from "@/src/upload-file";
import { useColors } from "@/src/use-colors";

type Payload = {
  scrollAdEnabled?: boolean;
  scrollAdDelaySeconds?: number;
  scrollAdStartsAt?: string | null;
  scrollAdEndsAt?: string | null;
  scrollAdVideos?: unknown;
  error?: string;
};

async function pickMedia() {
  const assets = await pickMediaLibrary({
    kind: "mixed",
    limit: 1,
  });
  return assets[0] ?? null;
}

export function FlashPubSettings() {
  const t = useT();
  const c = useColors();
  const token = useSession((state) => state.token);
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState(String(SCROLL_AD_DEFAULT_DELAY));
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [videos, setVideos] = useState<ScrollAdClip[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    void api<Payload>("/api/admin/content-source")
      .then((data) => {
        if (cancel) return;
        setEnabled(data.scrollAdEnabled !== false);
        setDelay(String(data.scrollAdDelaySeconds ?? SCROLL_AD_DEFAULT_DELAY));
        const start = toLocalDateParts(data.scrollAdStartsAt);
        const end = toLocalDateParts(data.scrollAdEndsAt);
        setStartDate(start.date);
        setStartTime(start.time);
        setEndDate(end.date);
        setEndTime(end.time);
        setVideos(parseScrollAdVideos(data.scrollAdVideos, false));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancel) setLoaded(false);
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  async function persist(patch: Record<string, unknown>) {
    setBusy(true);
    try {
      await api("/api/admin/content-source", {
        method: "POST",
        body: JSON.stringify(patch),
      });
      return true;
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : t("hoursFailed"),
        "error",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    const ok = await persist({ scrollAdEnabled: next });
    if (!ok) setEnabled(!next);
    else showToast(next ? t("flashOn") : t("flashOff"), "success");
  }

  async function save() {
    try {
      const ok = await persist({
        scrollAdDelaySeconds: clampScrollAdDelay(delay),
        scrollAdStartsAt: fromLocalDateParts(startDate, startTime),
        scrollAdEndsAt: fromLocalDateParts(endDate, endTime),
        scrollAdVideos: videos,
      });
      if (ok) showToast(t("flashSaved"), "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : t("hoursFailed"),
        "error",
      );
    }
  }

  async function addMedia() {
    if (videos.length >= SCROLL_AD_MAX_VIDEOS) {
      showToast(`Maximum ${SCROLL_AD_MAX_VIDEOS} médias`, "error");
      return;
    }
    setBusy(true);
    try {
      const asset = await pickMedia();
      if (!asset) return;
      const form = new FormData();
      await appendUploadFile(form, asset);
      form.append("variant", "product");
      const uploaded = await apiUpload<{ url?: string }>("/api/upload", form);
      if (!uploaded.url) throw new Error("Média non reçu");
      setVideos((prev) => [
        ...prev,
        {
          url: uploaded.url!,
          enabled: true,
          priority: nextPriority(prev),
        },
      ]);
      showToast("Média ajouté — enregistre pour publier", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Import impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  function addFox() {
    if (
      videos.some((clip) => clip.url === SCROLL_AD_DEFAULT_VIDEO) ||
      videos.length >= SCROLL_AD_MAX_VIDEOS
    ) {
      return;
    }
    setVideos((prev) => [
      ...prev,
      {
        url: SCROLL_AD_DEFAULT_VIDEO,
        enabled: true,
        priority: nextPriority(prev),
      },
    ]);
  }

  function move(rank: number, dir: -1 | 1) {
    setVideos((prev) => {
      const ranked = prev
        .map((item, i) => ({ item, i }))
        .sort((a, b) => a.item.priority - b.item.priority || a.i - b.i);
      const current = ranked[rank];
      const other = ranked[rank + dir];
      if (!current || !other) return prev;
      return prev.map((item, i) => {
        if (i === current.i) return { ...item, priority: other.item.priority };
        if (i === other.i) return { ...item, priority: current.item.priority };
        return item;
      });
    });
  }

  if (!token || !loaded) return null;

  const ranked = videos
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => a.clip.priority - b.clip.priority || a.index - b.index);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: "rgba(127,127,140,0.22)" },
      ]}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text }]}>{t("flashPub")}</Text>
        </View>
        <Switch
          value={enabled}
          disabled={busy}
          onValueChange={(next) => void toggleEnabled(next)}
          trackColor={{ false: "rgba(127,127,140,0.35)", true: c.buyStart }}
          thumbColor="#fff"
        />
      </View>

      <Text style={[styles.label, { color: c.text }]}>{t("flashDelay")}</Text>
      <TextInput
        value={delay}
        onChangeText={setDelay}
        keyboardType="number-pad"
        editable={!busy}
        placeholder="120"
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          { color: c.text, backgroundColor: "rgba(127,127,140,0.12)" },
        ]}
      />

      <DateTimeFields
        label={t("flashStart")}
        date={startDate}
        time={startTime}
        onDate={setStartDate}
        onTime={setStartTime}
        busy={busy}
        text={c.text}
        muted={c.textMuted}
      />
      <DateTimeFields
        label={t("flashEnd")}
        date={endDate}
        time={endTime}
        onDate={setEndDate}
        onTime={setEndTime}
        busy={busy}
        text={c.text}
        muted={c.textMuted}
      />

      <Text style={[styles.title, { color: c.text, fontSize: 14 }]}>
        {t("medias")} ({videos.length}/{SCROLL_AD_MAX_VIDEOS})
      </Text>

      {ranked.length === 0 ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          {t("mediasEmpty")}
        </Text>
      ) : (
        ranked.map(({ clip, index }, rank) => (
          <View
            key={`${clip.url}-${index}`}
            style={[
              styles.clip,
              {
                backgroundColor: "rgba(127,127,140,0.1)",
                opacity: clip.enabled ? 1 : 0.55,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setVideos((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, enabled: !item.enabled } : item,
                  ),
                )
              }
              disabled={busy}
              style={[
                styles.miniSwitch,
                {
                  backgroundColor: clip.enabled
                    ? c.buyStart
                    : "rgba(127,127,140,0.35)",
                },
              ]}
            >
              <View
                style={[
                  styles.miniKnob,
                  { alignSelf: clip.enabled ? "flex-end" : "flex-start" },
                ]}
              />
            </Pressable>
            <Ionicons
              name={isVideoUrl(clip.url) ? "videocam" : "image"}
              size={14}
              color={c.textMuted}
            />
            <Text
              style={[styles.clipName, { color: c.text }]}
              numberOfLines={1}
            >
              {clipName(clip.url)}
            </Text>
            <TextInput
              value={String(clip.priority)}
              keyboardType="number-pad"
              editable={!busy}
              onChangeText={(value) =>
                setVideos((prev) =>
                  prev.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          priority: clampScrollAdPriority(value, item.priority),
                        }
                      : item,
                  ),
                )
              }
              style={[styles.prio, { color: c.text }]}
            />
            <Pressable
              disabled={busy || rank === 0}
              onPress={() => move(rank, -1)}
              hitSlop={6}
            >
              <Ionicons
                name="arrow-up"
                size={16}
                color={rank === 0 ? c.textMuted : c.text}
              />
            </Pressable>
            <Pressable
              disabled={busy || rank === ranked.length - 1}
              onPress={() => move(rank, 1)}
              hitSlop={6}
            >
              <Ionicons
                name="arrow-down"
                size={16}
                color={rank === ranked.length - 1 ? c.textMuted : c.text}
              />
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() =>
                setVideos((prev) => prev.filter((_, i) => i !== index))
              }
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={16} color="#FF7A00" />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => void addMedia()}
          disabled={busy || videos.length >= SCROLL_AD_MAX_VIDEOS}
          style={[
            styles.ghost,
            { borderColor: "rgba(127,127,140,0.28)", opacity: busy ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.ghostText, { color: c.text }]}>
            {t("addMedia")}
          </Text>
        </Pressable>
        <Pressable
          onPress={addFox}
          disabled={
            busy ||
            videos.some((clip) => clip.url === SCROLL_AD_DEFAULT_VIDEO) ||
            videos.length >= SCROLL_AD_MAX_VIDEOS
          }
          style={[styles.ghost, { borderColor: "rgba(127,127,140,0.28)" }]}
        >
          <Text style={[styles.ghostText, { color: c.text }]}>
            {t("addFox")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => void save()}
        disabled={busy}
        style={[
          styles.save,
          { backgroundColor: c.emerald, opacity: busy ? 0.6 : 1 },
        ]}
      >
        <Text style={styles.saveText}>{busy ? "…" : "Enregistrer"}</Text>
      </Pressable>
    </View>
  );
}

function DateTimeFields({
  label,
  date,
  time,
  onDate,
  onTime,
  busy,
  text,
  muted,
}: {
  label: string;
  date: string;
  time: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  busy: boolean;
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
          editable={!busy}
          placeholder={FLASH_DATE_PLACEHOLDER}
          placeholderTextColor={muted}
          keyboardType="number-pad"
          maxLength={10}
          autoCapitalize="none"
          style={[
            styles.input,
            styles.dateInput,
            { color: text, backgroundColor: "rgba(127,127,140,0.12)" },
          ]}
        />
        <TextInput
          value={time}
          onChangeText={(value) => onTime(maskFlashTime(value))}
          editable={!busy}
          placeholder={FLASH_TIME_PLACEHOLDER}
          placeholderTextColor={muted}
          keyboardType="number-pad"
          maxLength={5}
          autoCapitalize="none"
          style={[
            styles.input,
            styles.timeInput,
            { color: text, backgroundColor: "rgba(127,127,140,0.12)" },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 16, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontWeight: "700",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateInput: { flex: 1 },
  timeInput: { width: 92, textAlign: "center" },
  clip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  miniSwitch: {
    width: 32,
    height: 20,
    borderRadius: 999,
    padding: 2,
    justifyContent: "center",
  },
  miniKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
  clipName: { flex: 1, fontSize: 12, fontWeight: "700" },
  prio: {
    width: 36,
    height: 32,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 12,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ghost: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ghostText: { fontWeight: "800", fontSize: 12 },
  save: { borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  saveText: { color: "#04281c", fontWeight: "800" },
});
