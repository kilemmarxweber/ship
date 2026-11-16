# SHIPSHOP — PLAN D'OPTIMISATION DE LA QUALITÉ LIVE VIDÉO

**Version corrigée :** 1.1 — alignée sur Expo + Next.js shop + LiveKit Cloud  
**Statut :** source de vérité pour l’implémentation qualité image live.

---

## 1. Contexte réel du projet

ShipShop est une place de marché vidéo (RDC) avec live shopping.

| Couche             | Stack réel                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Application mobile | Expo 58 / React Native (`ShipShop`), écran live dans `components/live/`            |
| Diffusion vidéo    | **LiveKit Cloud** (SFU) — ne pas remplacer                                         |
| Backend / API      | Next.js 16 (`C:\Users\kilemmarxweber\Desktop\shop`) — routes `/api/growth/lives/*` |
| Auth token SFU     | `GET                                                                               | POST /api/growth/lives/:id/sfu-token` → JWT LiveKit (`canPublish` host/guest) |

**Faux dans les versions antérieures de ce plan :** backend Express, React Native CLI bare, « activer » simulcast / adaptiveStream / dynacast (déjà actifs).

### Objectif

Améliorer la **netteté perçue** des lives (proche TikTok Live) en peaufinant capture, encodage et couches simulcast **déjà présents**, sans reconstruire LiveKit ni un second backend.

Priorités : image nette → fluidité → qualité adaptative → latence → stabilité → bande passante → Android/iOS.

---

## 2. Architecture actuelle

```text
Host Expo (LiveKitNative) ──publish simulcast──► LiveKit Cloud
Host Web (useLiveSfu)     ──publish simulcast──► LiveKit Cloud
LiveKit Cloud ──subscribe adaptive──► Viewer Expo (VideoTrack)
LiveKit Cloud ──subscribe adaptive──► Viewer Web (<video>)
shop /api/growth/lives/:id/sfu-token ──JWT──► clients
```

### Fichiers qualité critiques

| Rôle                              | Fichier                                      |
| --------------------------------- | -------------------------------------------- |
| Room + capture + rendu mobile     | `components/live/LiveKitNative.tsx`          |
| Profils / bitrates / couches      | `src/live-quality.ts`                        |
| Hystérésis host                   | `src/live-quality-manager.ts`                |
| Capture selfie web                | `shop/src/lib/growth/live-selfie-capture.ts` |
| Room SFU web                      | `shop/src/lib/growth/use-live-sfu.ts`        |
| Mint token (pas de knobs qualité) | `shop/src/lib/growth/live-sfu.ts`            |
| Profils partagés web              | `shop/src/lib/growth/live-quality.ts`        |

### Déjà en place (ne pas « réactiver »)

- `adaptiveStream`, `dynacast`, `simulcast: true`
- Capture portrait 1080×1920 avec repli 720×1280
- `contentHint: "detail"`, `degradationPreference: "maintain-resolution"`
- Badge qualité host (`ConnectionQuality`)
- Idempotence financière et règles métier live inchangées

### Problèmes réels à corriger

1. Couches simulcast calées sur presets **16:9 paysage** alors que la capture est **9:16 portrait**.
2. Bitrate primaire trop agressif (6 Mbps) → encodeur Android saturé, FPS en chute, flou.
3. `adaptiveStream: true` naïf ; mieux `{ pixelDensity: "screen" }` sur React Native.
4. Abonnement forcé de toutes les pistes (PiP) peut tirer de la HD inutile.
5. Pas de gestionnaire publisher avec hystérésis 1080 ↔ 720.
6. Qualité = **client** ; le JWT SFU n’impose pas résolution/bitrate.

---

## 3. Profils de qualité

| Profil   | Capture portrait | Bitrate primaire  | Quand                          |
| -------- | ---------------- | ----------------- | ------------------------------ |
| Économie | 720×1280 @ 24–30 | ~0,8–1,2 Mbps     | `Poor` / appareil faible       |
| Standard | 720×1280 @ 30    | ~1,7–2,5 Mbps     | Défaut stable Android          |
| Haute    | 1080×1920 @ 30   | ~3–4 Mbps (pas 6) | Wi‑Fi `Excellent` + capteur OK |

Simulcast : **base = capture** + 2 couches basses portrait (≈360p / ≈540–720p hauteur).  
Ne pas confondre : (1) couche reçue par chaque viewer (LiveKit) vs (2) résolution de capture côté host.

Règle : **ne jamais disconnect** la room pour changer de qualité.

---

## 4. Méthode d’implémentation

### Phase 0 — Doc

Ce document (stack réel + audit + fichiers cibles).

### Phase 1 — Netteté host mobile

Module `src/live-quality.ts` + branchement `ROOM_OPTIONS` dans `LiveKitNative.tsx` :

- bitrates réalistes ;
- couches simulcast portrait ;
- `adaptiveStream: { pixelDensity: "screen" }` ;
- fallback 720 si 1080 refuse.

### Phase 2 — LiveQualityManager

`src/live-quality-manager.ts` : `ConnectionQuality` + stats, hystérésis (descente rapide, remontée après ~8–12 s stables). Overlay stats **`__DEV__` ou rôle ADMIN uniquement**.

### Phase 3 — Spectateur

Scène principale plein écran ; PiP guests en couche basse via adaptive stream / taille layout.

### Phase 4 — Parité web shop

Miroir des profils dans `use-live-sfu` + `live-selfie-capture` + `shop/.../live-quality.ts`.  
Pas de changement métier sur `sfu-token`.

### Phase 5 — Tests

Scénarios Wi‑Fi / 4G / faible / instable / multi-viewers / téléphone mid-range / reconnexion / Android (+ iOS/web si dispo).

---

## 5. Critères d’acceptation

- Host démarre sans erreur.
- 720p stable par défaut sur mid-range Android.
- 1080p seulement si Excellent + capture OK.
- Deux viewers (bon / mauvais réseau) ne se limitent pas mutuellement.
- Changements de qualité sans déconnexion.
- Stats visibles uniquement en dev/admin.
- Aucune régression cadeaux / presence / screen share / sfu-token.
- Aucun secret LiveKit dans le client.

---

## 6. Hors scope

- Redis / sharding / multi-DB
- Remplacer LiveKit, HLS pour tous les viewers, SFU maison
- Backend Express
- Stats techniques pour acheteurs
- Imposer 1080p à tous les téléphones

---

## 7. Validation automatisée (lot livré)

- `npx tsc --noEmit` OK sur ShipShop et shop
- `npx eslint` OK sur les fichiers live qualité
- Smoke `src/live-quality.test.ts` : profils, bitrates sous 6 Mbps, simulcast portrait, `adaptiveStream.pixelDensity = screen`
- Route `sfu-token` non modifiée (métier inchangé)

**À valider sur appareil réel (manuel) :** Wi‑Fi Excellent → remontée high après ~10 s ; Poor → economy ; deux viewers réseau différent ; PiP guests en couche basse ; screen share / cadeaux / reconnexion.
