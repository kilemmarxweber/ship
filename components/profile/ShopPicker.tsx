import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SearchField } from "@/components/ui/SearchField";
import { useColors } from "@/src/use-colors";

export type ShopPickerShop = {
  id: string;
  name: string;
  slug?: string;
  owner?: { name?: string | null } | null;
};

export function shopLabel(shop: ShopPickerShop) {
  return shop.owner?.name ? `${shop.name} · ${shop.owner.name}` : shop.name;
}

export function ShopPicker({
  shops,
  value,
  onChange,
  placeholder = "Boutique",
  allLabel,
}: {
  shops: ShopPickerShop[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allLabel?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return shops;
    return shops.filter((shop) =>
      `${shop.name} ${shop.slug ?? ""} ${shop.owner?.name ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [shops, q]);

  const selected = shops.find((shop) => shop.id === value);
  const label = selected
    ? shopLabel(selected)
    : allLabel && !value
      ? allLabel
      : placeholder;

  if (shops.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          setOpen((next) => !next);
          if (open) setQ("");
        }}
        style={[
          styles.trigger,
          {
            backgroundColor: "rgba(127,127,140,0.12)",
            borderColor: open ? c.buyStart : "rgba(127,127,140,0.22)",
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={c.textMuted}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: c.sheet,
              borderColor: "rgba(127,127,140,0.22)",
            },
          ]}
        >
          <SearchField
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher une boutique"
            autoFocus
            style={{ margin: 8 }}
          />
          <ScrollView
            style={styles.list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {allLabel ? (
              <Pressable
                onPress={() => {
                  onChange("");
                  setOpen(false);
                  setQ("");
                }}
                style={[
                  styles.option,
                  !value && { backgroundColor: `${c.primary}18` },
                ]}
              >
                <Text
                  style={[styles.optionText, { color: c.text }]}
                  numberOfLines={1}
                >
                  {allLabel}
                </Text>
                {!value ? (
                  <Ionicons name="checkmark" size={18} color={c.primary} />
                ) : null}
              </Pressable>
            ) : null}
            {filtered.map((shop) => {
              const on = shop.id === value;
              return (
                <Pressable
                  key={shop.id}
                  onPress={() => {
                    onChange(shop.id);
                    setOpen(false);
                    setQ("");
                  }}
                  style={[
                    styles.option,
                    on && { backgroundColor: `${c.primary}18` },
                  ]}
                >
                  <Text
                    style={[styles.optionText, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {shopLabel(shop)}
                  </Text>
                  {on ? (
                    <Ionicons name="checkmark" size={18} color={c.primary} />
                  ) : null}
                </Pressable>
              );
            })}
            {filtered.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>
                Aucune boutique
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  trigger: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  triggerText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 14,
    includeFontPadding: false,
    paddingRight: 4,
  },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 280,
  },
  list: { maxHeight: 220 },
  option: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionText: { flex: 1, fontSize: 14, fontWeight: "600" },
  empty: { padding: 12, fontSize: 12 },
});
