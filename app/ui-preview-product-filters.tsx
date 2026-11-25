import { Redirect } from "expo-router";
import { Platform, View } from "react-native";

import { ProductFiltersScreen } from "@/components/publish/ProductFiltersScreen";

/**
 * Preview DEV des filtres produits / makeup (maquettes CREATE AI).
 * Ouvre /ui-preview-product-filters
 */
export default function UiPreviewProductFilters() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#111",
        alignItems: Platform.OS === "web" ? "center" : undefined,
      }}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: Platform.OS === "web" ? 390 : undefined,
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        <ProductFiltersScreen
          productImageUrl="https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=900&h=900&fit=crop"
          productTitle="T-shirt Oversize"
          productCategory="mode haut t-shirt flat-lay"
          onClose={() => undefined}
          onApply={() => undefined}
        />
      </View>
    </View>
  );
}
