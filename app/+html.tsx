import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>
        {/* First paint système (avant React) : From Klambocore en bas. */}
        <div id="shipshop-boot-splash" aria-label="From Klambocore">
          <p className="boot-credit">From Klambocore</p>
        </div>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function hideBoot() {
    var el = document.getElementById('shipshop-boot-splash');
    if (!el || el.getAttribute('data-hidden') === '1') return;
    el.setAttribute('data-hidden', '1');
  }
  window.__shipshopHideBootSplash = hideBoot;
  // Laisse place au LaunchSplash React dès qu’il est peint.
  setTimeout(hideBoot, 1200);
  setTimeout(hideBoot, 4000);
})();`,
          }}
        />
      </body>
    </html>
  );
}

const responsiveBackground = `
html, body {
  height: 100%;
  margin: 0;
  background-color: #0A0A0F;
}
#shipshop-boot-splash {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #0A0A0F;
  transition: opacity 220ms ease;
  pointer-events: none;
}
#shipshop-boot-splash[data-hidden="1"] {
  opacity: 0;
  visibility: hidden;
}
#shipshop-boot-splash .boot-credit {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: max(28px, env(safe-area-inset-bottom, 0px) + 24px);
  margin: 0;
  text-align: center;
  color: rgba(255,255,255,0.72);
  font: 600 16px/1.2 system-ui, -apple-system, Segoe UI, sans-serif;
  letter-spacing: 0.4px;
}
/* Match comments composer: no browser outline on hover/focus for text fields */
input,
textarea {
  outline: none !important;
  box-shadow: none !important;
}
input:hover,
textarea:hover,
input:focus,
textarea:focus {
  outline: none !important;
  box-shadow: none !important;
}`;
