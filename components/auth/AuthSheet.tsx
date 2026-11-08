import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastHost } from "@/components/Toast";
import { authRequest } from "@/src/api";
import {
    countries,
    defaultCountry,
    digitsOnly,
    type CountryDial,
} from "@/src/countries";
import { useSession } from "@/src/session";
import { colors } from "@/src/theme";
import { showToast, useToast } from "@/src/toast";
import { useColors } from "@/src/use-colors";

export function AuthSheet() {
  const open = useSession((state) => state.authOpen);
  const closeAuth = useSession((state) => state.closeAuth);
  const hideToast = useToast((state) => state.hide);

  useEffect(() => {
    if (open) return;
    hideToast();
    Keyboard.dismiss();
  }, [open, hideToast]);

  if (!open) return null;
  return <AuthSheetContent closeAuth={closeAuth} hideToast={hideToast} />;
}

function AuthSheetContent({
  closeAuth,
  hideToast,
}: {
  closeAuth: () => void;
  hideToast: () => void;
}) {
  const setToken = useSession((state) => state.setToken);
  const insets = useSafeAreaInsets();
  const c = useColors();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [via, setVia] = useState<"phone" | "email">("phone");
  const [country, setCountry] = useState(defaultCountry);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [hidePass, setHidePass] = useState(true);
  const [pending, setPending] = useState(false);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => setKeyboard(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboard(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.dial.includes(needle) ||
        item.iso.toLowerCase().includes(needle),
    );
  }, [query]);

  function onPhoneChange(value: string) {
    setPhone(digitsOnly(value).slice(0, country.max));
  }

  function pickCountry(next: CountryDial) {
    setCountry(next);
    setPhone((current) => digitsOnly(current).slice(0, next.max));
    setPicking(false);
    setQuery("");
  }

  async function submit() {
    if (via === "phone") {
      if (phone.length < country.min) {
        showToast(
          `Le numéro ${country.name} doit avoir ${country.min} chiffre${country.min > 1 ? "s" : ""}.`,
          "error",
        );
        return;
      }
    } else if (!email.includes("@")) {
      showToast("Entre un e-mail valide.", "error");
      return;
    }
    if (password.length < 6) {
      showToast(
        "Le mot de passe doit contenir au moins 6 caractères.",
        "error",
      );
      return;
    }
    setPending(true);
    try {
      const fullPhone = `+${country.dial}${phone}`;
      const path =
        mode === "in" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email";
      const body =
        mode === "in"
          ? via === "email"
            ? { email: email.trim(), password }
            : { phone: fullPhone, password }
          : {
              email: via === "email" ? email.trim() : "",
              phone: via === "phone" ? fullPhone : "",
              name: name.trim() || "Client",
              password,
            };
      const result = await authRequest(path, body);
      if (!result.token) {
        throw new Error("Le serveur n'a pas renvoyé de jeton de session.");
      }
      await setToken(result.token);
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : "Connexion impossible",
        "error",
      );
    } finally {
      setPending(false);
    }
  }

  const lift = Platform.OS === "android" ? keyboard : 0;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeAuth}
    >
      <KeyboardAvoidingView
        style={[styles.frame, { backgroundColor: c.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ToastHost />
        <View
          style={[
            styles.page,
            {
              paddingTop: insets.top + 8,
              paddingBottom: Math.max(16, insets.bottom) + 12,
            },
          ]}
        >
          <View style={styles.head}>
            <View style={styles.brand}>
              <View style={[styles.brandIcon, { backgroundColor: c.emerald }]}>
                <Ionicons name="bag-handle" size={18} color="#04281c" />
              </View>
              <Text style={[styles.title, { color: c.text }]}>
                {mode === "in" ? "Se connecter" : "Créer un compte"}
              </Text>
            </View>
            <Pressable onPress={closeAuth} hitSlop={12} style={styles.close}>
              <Ionicons name="close" size={20} color={c.text} />
            </Pressable>
          </View>
          <View style={[styles.body, { marginBottom: lift }]}>
            <Text style={[styles.hint, { color: c.textMuted }]}>
              {via === "phone"
                ? "Numéro avec l'indicatif du pays"
                : "Connexion avec ton e-mail"}
            </Text>

            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, via === "phone" && styles.tabOn]}
                onPress={() => setVia("phone")}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={via === "phone" ? "#fff" : colors.muted}
                />
                <Text
                  style={[styles.tabText, via === "phone" && styles.tabTextOn]}
                >
                  Téléphone
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, via === "email" && styles.tabOn]}
                onPress={() => setVia("email")}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={via === "email" ? "#fff" : colors.muted}
                />
                <Text
                  style={[styles.tabText, via === "email" && styles.tabTextOn]}
                >
                  E-mail
                </Text>
              </Pressable>
            </View>

            {picking ? (
              <View style={styles.picker}>
                <View style={styles.field}>
                  <Ionicons name="search" size={18} color="#8d8d98" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Pays ou indicatif"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.fieldInput}
                    autoFocus
                  />
                </View>
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.iso + item.dial}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 220 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.countryRow}
                      onPress={() => pickCountry(item)}
                    >
                      <Text style={styles.flag}>{item.flag}</Text>
                      <Text style={styles.countryName}>{item.name}</Text>
                      <Text style={styles.dial}>+{item.dial}</Text>
                    </Pressable>
                  )}
                />
                <Pressable onPress={() => setPicking(false)}>
                  <Text style={styles.switch}>Fermer la liste</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {via === "phone" ? (
                  <View style={styles.phoneRow}>
                    <Pressable
                      style={styles.dialBtn}
                      onPress={() => setPicking(true)}
                    >
                      <Text style={styles.flag}>{country.flag}</Text>
                      <Text style={styles.dial}>+{country.dial}</Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color={colors.muted}
                      />
                    </Pressable>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Ionicons
                        name="phone-portrait-outline"
                        size={18}
                        color="#8d8d98"
                      />
                      <TextInput
                        value={phone}
                        onChangeText={onPhoneChange}
                        keyboardType="phone-pad"
                        maxLength={country.max}
                        placeholder={`${country.min} chiffres`}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.fieldInput}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.field}>
                    <Ionicons name="mail-outline" size={18} color="#8d8d98" />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="ex.  toi@mail.com"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.fieldInput}
                    />
                  </View>
                )}
                {via === "phone" ? (
                  <Text style={styles.counter}>
                    {phone.length}/{country.max} · {country.name}
                  </Text>
                ) : null}

                {mode === "up" ? (
                  <View style={styles.field}>
                    <Ionicons name="person-outline" size={18} color="#8d8d98" />
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Nom complet"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={styles.fieldInput}
                    />
                  </View>
                ) : null}

                <View style={styles.field}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#8d8d98"
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={hidePass}
                    placeholder="Mot de passe"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.fieldInput}
                  />
                  <Pressable
                    onPress={() => setHidePass((value) => !value)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={hidePass ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#8d8d98"
                    />
                  </Pressable>
                </View>

                <Pressable
                  style={styles.primary}
                  onPress={() => void submit()}
                  disabled={pending}
                >
                  {pending ? (
                    <ActivityIndicator color="#04281c" />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          mode === "in"
                            ? "log-in-outline"
                            : "person-add-outline"
                        }
                        size={20}
                        color="#04281c"
                      />
                      <Text style={styles.primaryText}>
                        {mode === "in" ? "Se connecter" : "Créer le compte"}
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMode(mode === "in" ? "up" : "in");
                    hideToast();
                  }}
                >
                  <Text style={styles.switch}>
                    {mode === "in" ? "Créer un compte" : "J'ai déjà un compte"}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: 22,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 10,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#fff" },
  close: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: colors.muted, fontSize: 13 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabOn: { backgroundColor: colors.emerald },
  tabText: { fontWeight: "700", color: colors.muted, fontSize: 13 },
  tabTextOn: { color: "#fff" },
  phoneRow: { flexDirection: "row", gap: 8 },
  dialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  flag: { fontSize: 18 },
  dial: { fontWeight: "700", color: "#fff" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  fieldInput: { flex: 1, fontSize: 16, color: "#fff", paddingVertical: 10 },
  counter: { color: colors.muted, fontSize: 12, marginTop: -4 },
  picker: { gap: 8 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  countryName: { flex: 1, color: "#fff", fontWeight: "600" },
  primary: {
    backgroundColor: colors.emerald,
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#04281c", fontWeight: "800", fontSize: 16 },
  switch: {
    textAlign: "center",
    color: colors.emerald,
    fontWeight: "700",
    padding: 8,
  },
});
