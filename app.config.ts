import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  const organization = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  if (organization && project) {
    plugins.push([
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        organization,
        project,
      },
    ]);
  }
  return {
    ...config,
    name: config.name ?? "ShipShop",
    slug: config.slug ?? "ShipShop",
    plugins,
  };
};
