const {
  AndroidConfig,
  withAndroidStyles,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const BRANDING_SRC = "assets/images/splash-branding.png";
const DRAWABLE_NAME = "splashscreen_branding";

/**
 * Affiche « From Klambocore » en bas du splash système Android 12+
 * via windowSplashScreenBrandingImage.
 */
function withAndroidSplashBranding(config) {
  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const src = path.join(projectRoot, BRANDING_SRC);
      if (!fs.existsSync(src)) {
        throw new Error(`Splash branding manquant: ${BRANDING_SRC}`);
      }
      const drawableDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable",
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(src, path.join(drawableDir, `${DRAWABLE_NAME}.png`));
      return modConfig;
    },
  ]);

  config = withAndroidStyles(config, (stylesConfig) => {
    stylesConfig.modResults = AndroidConfig.Styles.assignStylesValue(
      stylesConfig.modResults,
      {
        add: true,
        parent: {
          name: "Theme.App.SplashScreen",
          parent: "Theme.SplashScreen",
        },
        name: "windowSplashScreenBrandingImage",
        value: `@drawable/${DRAWABLE_NAME}`,
      },
    );
    return stylesConfig;
  });

  return config;
}

module.exports = withAndroidSplashBranding;
