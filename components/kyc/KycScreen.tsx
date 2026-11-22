import { Ionicons } from "@expo/vector-icons";
import { IconBackButton } from "@/components/ui/IconBackButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, mediaUrl } from "@/src/api";
import { isOnline } from "@/src/offline/network";
import { captureKycPhoto, pickKycFromLibrary } from "@/src/kyc-upload";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast } from "@/src/toast";

type SellerType = "INDIVIDUAL" | "BUSINESS";
type KycStatus = "NONE" | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

type Kyc = {
  id?: string;
  status: KycStatus;
  sellerType: SellerType | null;
  legalName: string | null;
  phone: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  rejectReason: string | null;
  step1Complete: boolean;
  step2Complete: boolean;
};

function DocSlot({
  label,
  hint,
  url,
  gallery,
  cameraFacing,
  onUploaded,
}: {
  label: string;
  hint: string;
  url: string | null;
  gallery: boolean;
  cameraFacing: "front" | "back";
  onUploaded: (url: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const preview = mediaUrl(url);

  async function run(job: () => Promise<string | null>) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await job();
      if (next) await onUploaded(next);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Upload impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.doc}>
      <View style={styles.docThumb}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.docImage} />
        ) : (
          <Ionicons name="camera-outline" size={22} color={colors.muted} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.docTitle}>{label}</Text>
        <Text style={styles.lead}>{hint}</Text>
      </View>
      <View style={styles.docActions}>
        {gallery ? (
          <Pressable
            style={styles.docBtn}
            disabled={busy}
            onPress={() => void run(pickKycFromLibrary)}
          >
            <Text style={styles.docBtnText}>{busy ? "…" : "Galerie"}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.docBtn, !gallery && styles.docBtnPrimary]}
          disabled={busy}
          onPress={() => void run(() => captureKycPhoto(cameraFacing))}
        >
          <Text
            style={[styles.docBtnText, !gallery && styles.docBtnPrimaryText]}
          >
            {busy ? "…" : cameraFacing === "front" ? "Selfie" : "Photo"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function KycScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSession((state) => state.token);
  const openAuth = useSession((state) => state.openAuth);
  const query = useQuery({
    queryKey: ["kyc", token ?? "guest"],
    enabled: Boolean(token),
    queryFn: () => api<{ kyc?: Kyc | null }>("/api/kyc"),
  });
  const kyc = query.data?.kyc ?? null;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 16,
        gap: 14,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <IconBackButton color={"#fff"} />
      <Text style={styles.title}>Devenir Business pro</Text>
      <Text style={styles.lead}>
        Formulaire, puis photos de pièce d’identité. Publier reste possible sans
        KYC.
      </Text>

      {!token ? (
        <Pressable style={styles.primary} onPress={openAuth}>
          <Text style={styles.primaryText}>Se connecter</Text>
        </Pressable>
      ) : query.isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : kyc?.status === "PENDING" ? (
        <View style={styles.status}>
          <Ionicons name="time-outline" size={28} color="#F5C14A" />
          <Text style={styles.statusTitle}>Dossier en revue</Text>
          <Text style={styles.lead}>
            L’équipe examine vos documents. Vous serez notifié après décision.
          </Text>
        </View>
      ) : kyc?.status === "APPROVED" ? (
        <View style={styles.status}>
          <Ionicons name="shield-checkmark" size={28} color={colors.emerald} />
          <Text style={styles.statusTitle}>Business pro vérifié</Text>
          <Text style={styles.lead}>
            Votre badge PRO est actif sur votre profil.
          </Text>
        </View>
      ) : (
        <KycForm
          key={kyc?.id ?? kyc?.status ?? "draft"}
          kyc={kyc}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: ["kyc", token ?? "guest"],
            })
          }
        />
      )}
    </ScrollView>
  );
}

function KycForm({
  kyc,
  onSaved,
}: {
  kyc: Kyc | null;
  onSaved: () => Promise<unknown>;
}) {
  const [step, setStep] = useState<1 | 2>(
    kyc?.step1Complete && !kyc.step2Complete ? 2 : 1,
  );
  const [busy, setBusy] = useState(false);
  const [sellerType, setSellerType] = useState<SellerType>(
    kyc?.sellerType ?? "INDIVIDUAL",
  );
  const [legalName, setLegalName] = useState(kyc?.legalName ?? "");
  const [phone, setPhone] = useState(kyc?.phone ?? "");
  const [idNumber, setIdNumber] = useState(kyc?.idNumber ?? "");
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(
    kyc?.idFrontUrl ?? null,
  );
  const [idBackUrl, setIdBackUrl] = useState<string | null>(
    kyc?.idBackUrl ?? null,
  );
  const [selfieUrl, setSelfieUrl] = useState<string | null>(
    kyc?.selfieUrl ?? null,
  );

  async function patch(body: Record<string, unknown>) {
    const data = await api<{ kyc?: Kyc }>("/api/kyc", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const next = data.kyc;
    if (next) {
      if (next.sellerType) setSellerType(next.sellerType);
      setLegalName(next.legalName ?? "");
      setPhone(next.phone ?? "");
      setIdNumber(next.idNumber ?? "");
      setIdFrontUrl(next.idFrontUrl);
      setIdBackUrl(next.idBackUrl);
      setSelfieUrl(next.selfieUrl);
    }
    await onSaved();
    return next;
  }

  async function saveStep1() {
    if (legalName.trim().length < 2) {
      showToast("Nom légal trop court", "error");
      return;
    }
    if (phone.trim().length < 9) {
      showToast("Téléphone trop court", "error");
      return;
    }
    if (idNumber.trim().length < 4) {
      showToast("Numéro de pièce trop court", "error");
      return;
    }
    setBusy(true);
    try {
      await patch({
        sellerType,
        legalName: legalName.trim(),
        phone: phone.trim(),
        idNumber: idNumber.trim(),
      });
      setStep(2);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Enregistrement impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDoc(
    field: "idFrontUrl" | "idBackUrl" | "selfieUrl",
    url: string,
  ) {
    if (field === "idFrontUrl") setIdFrontUrl(url);
    if (field === "idBackUrl") setIdBackUrl(url);
    if (field === "selfieUrl") setSelfieUrl(url);
    await patch({ [field]: url });
  }

  async function submit() {
    if (!(await isOnline())) {
      showToast("Vérification indisponible hors-ligne", "info");
      return;
    }
    setBusy(true);
    try {
      await patch({
        sellerType,
        legalName: legalName.trim(),
        phone: phone.trim(),
        idNumber: idNumber.trim(),
        idFrontUrl,
        idBackUrl,
        selfieUrl,
      });
      await api<{ kyc?: Kyc }>("/api/kyc", { method: "POST" });
      await onSaved();
      showToast("Dossier envoyé pour revue", "success");
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Soumission impossible",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {kyc?.status === "REJECTED" && kyc.rejectReason ? (
        <View style={styles.reject}>
          <Text style={styles.rejectTitle}>Dossier refusé</Text>
          <Text style={styles.lead}>{kyc.rejectReason}</Text>
        </View>
      ) : null}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, step === 1 && styles.tabOn]}
          onPress={() => setStep(1)}
        >
          <Text style={[styles.tabText, step === 1 && styles.tabTextOn]}>
            1. Identité
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, step === 2 && styles.tabOn]}
          onPress={() => setStep(2)}
        >
          <Text style={[styles.tabText, step === 2 && styles.tabTextOn]}>
            2. Documents
          </Text>
        </Pressable>
      </View>

      {step === 1 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Type de Business</Text>
          <View style={styles.row}>
            {(
              [
                ["INDIVIDUAL", "Particulier"],
                ["BUSINESS", "Entreprise"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.choice, sellerType === key && styles.choiceOn]}
                onPress={() => setSellerType(key)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    sellerType === key && styles.choiceTextOn,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Nom légal</Text>
          <TextInput
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Nom et prénom ou raison sociale"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+243 8XX XXX XXX"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Text style={styles.label}>N° pièce d’identité</Text>
          <TextInput
            value={idNumber}
            onChangeText={setIdNumber}
            placeholder="CNI, passeport…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable
            style={styles.primary}
            disabled={busy}
            onPress={() => void saveStep1()}
          >
            <Text style={styles.primaryText}>{busy ? "…" : "Continuer"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <DocSlot
            label="Pièce — recto"
            hint="Galerie ou photo nette, caméra arrière."
            url={idFrontUrl}
            gallery
            cameraFacing="back"
            onUploaded={(url) => saveDoc("idFrontUrl", url)}
          />
          <DocSlot
            label="Pièce — verso"
            hint="Cadrez le verso, photo nette."
            url={idBackUrl}
            gallery
            cameraFacing="back"
            onUploaded={(url) => saveDoc("idBackUrl", url)}
          />
          <DocSlot
            label="Selfie"
            hint="Caméra avant obligatoire. Pas de photo galerie."
            url={selfieUrl}
            gallery={false}
            cameraFacing="front"
            onUploaded={(url) => saveDoc("selfieUrl", url)}
          />
          <View style={styles.row}>
            <Pressable
              accessibilityLabel="Retour"
              style={styles.ghostIcon}
              onPress={() => setStep(1)}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={[
                styles.primary,
                { flex: 1 },
                (!idFrontUrl || !idBackUrl || !selfieUrl || busy) && {
                  opacity: 0.5,
                },
              ]}
              disabled={busy || !idFrontUrl || !idBackUrl || !selfieUrl}
              onPress={() => void submit()}
            >
              <Text style={styles.primaryText}>{busy ? "…" : "Soumettre"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 16,
    overflow: "visible",
  },
  backText: {
    color: "#fff",
    fontWeight: "700",
    includeFontPadding: false,
    paddingRight: 12,
    flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  lead: { color: colors.muted, lineHeight: 18, fontSize: 13 },
  primary: {
    backgroundColor: "#FF7A00",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  status: { alignItems: "center", gap: 8, paddingTop: 24 },
  statusTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  reject: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  rejectTitle: { color: "#ff8a8a", fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  tabOn: { backgroundColor: "#FF7A00" },
  tabText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  tabTextOn: { color: "#fff" },
  card: {
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 14,
  },
  label: { color: "#fff", fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", gap: 8 },
  choice: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: 12,
    alignItems: "center",
  },
  choiceOn: { borderColor: "#FF7A00", backgroundColor: "rgba(255,122,0,0.18)" },
  choiceText: { color: colors.muted, fontWeight: "700" },
  choiceTextOn: { color: "#fff" },
  ghostIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  doc: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 10,
  },
  docThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  docImage: { width: 56, height: 56 },
  docTitle: { color: "#fff", fontWeight: "800", fontSize: 13 },
  docActions: { gap: 4 },
  docBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  docBtnPrimary: { backgroundColor: "#FF7A00", borderColor: "#FF7A00" },
  docBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  docBtnPrimaryText: { color: "#fff" },
});
