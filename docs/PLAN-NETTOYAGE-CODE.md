# Plan — Mega prompt de nettoyage du code mort & des répétitions

> Projet : ShipShop (Expo SDK 58 / React Native 0.88 / React 19 / expo-router / TypeScript strict)
> Date : 2026-11-08
> Objectif : supprimer le code inutilisable et la duplication inutile **sans changer le comportement**, avec preuve et garde-fous à chaque étape.

---

## 0. Résumé exécutif

Le nettoyage se fait en **6 phases** et **5 vagues**. Chaque vague est un lot atomique :

1. **Baseline** — mesurer avant de toucher (tsc, lint, knip, jscpd, bundle).
2. **Inventaire** — lister, pas supprimer.
3. **Classification** — certain / probable / à vérifier, avec preuve.
4. **Exécution** — une vague = un commit, gates verts.
5. **Vérification** — tsc + lint + tests manuels des écrans touchés.
6. **Rapport** — tableau avant/après + résidus assumés.

Le mega prompt (§5) est conçu pour être donné tel quel à un agent (OpenCode, Claude Code, Codex). Il contient les règles, les pièges spécifiques à ce repo, le format de preuve et les critères d'arrêt.

---

## 1. État des lieux mesuré (2026-11-08)

| Métrique | Valeur |
|---|---|
| Fichiers TS/TSX (hors node_modules, dist, android) | **210** |
| Lignes TS/TSX | **~42 400** |
| Routes dans `app/` | **48** |
| Routes « stubs » (< 300 octets, réexport d'un écran) | **29** |
| Écrans réels dans `components/` | ~60 |
| Modules logique dans `src/` | ~45 |
| Splits plateforme légitimes (`*.web.ts[x]`) | **6** |
| `console.log` / `any` explicite / `@ts-ignore` | **0 / 0 / 0** |
| `TODO/FIXME` | 1 |
| `eslint-disable` | 1 |

**Architecture réelle** (à ne pas contredire) :

- `app/` = routes expo-router, volontairement **minces** : `export { default } from "@/components/..."`.
- `components/` = écrans et composants.
- `src/` = logique métier, stores, offline, thème, i18n.
- `plugins/` = config plugins Expo + natif Android injecté.
- `dist/`, `android/`, `.expo/` = **générés, gitignored**, jamais édités à la main.
- `app.json` a `experiments.typedRoutes: true` → supprimer une route régénère `.expo/types`.

> ⚠️ `AGENTS.md` affirme que les routes vivent dans `src/app/`. C'est faux : elles sont dans `app/`. À corriger dans la doc (voir F9).

---

## 2. Taxonomie des déchets (ce que le prompt doit chercher)

| Code | Catégorie | Définition | Action type |
|---|---|---|---|
| **D1** | Fichier mort | Aucun import/require/résolution dynamique | Supprimer |
| **D2** | Export mort | Symbole exporté jamais importé (hors entrée de route) | Supprimer l'export, garder le reste |
| **D3** | Dépendance morte | Package dans `package.json` jamais importé, absent de `app.json`/plugins | `npx expo install --fix` puis retrait |
| **D4** | Asset mort | Image/font/son non référencé par code, `app.json` ou `require()` | Supprimer |
| **D5** | Duplication | Même logique/constante/type/style à ≥ 2 endroits | Factoriser **ou** justifier |
| **D6** | Code inaccessible | Branche `if (false)`, feature flag jamais activé, écran non routé | Supprimer ou documenter |
| **D7** | Dérive documentaire | Doc/config qui décrit un état qui n'existe plus | Corriger |

**Duplication à détecter en priorité** (spécifique à ce repo) :

- 3 voies d'accès aux couleurs : `colors` (dark figé), `useColors()` (thème réactif), `palettes`/`paletteOf()`.
- Helpers de formatage (`src/format.ts`) vs formats inline dans les écrans.
- Validation/téléphone (`src/phone.ts`) vs regex inline.
- Types dupliqués entre `src/types.ts` et types locaux d'écrans.
- Blocs `StyleSheet.create` quasi identiques (cartes, sheets, lignes, boutons).
- Motifs répétés : `try/catch` + toast, `useQuery` + `PagedMore`, `router.push` + `safeBack`.
- Clés i18n définies mais jamais utilisées (`src/i18n.ts`).
- Constantes magiques dupliquées (couleurs hex, tailles, timeouts, limites de pagination).

---

## 3. Zones interdites / faux positifs (le prompt doit les respecter)

1. **Splits plateforme** — ne jamais supprimer un `.web.ts[x]` « en double » :
   - `components/live/LiveKitGate.web.tsx`, `components/live/LiveMedia.web.tsx`
   - `components/useClientOnlyValue.web.ts`, `components/useColorScheme.web.ts`
   - `src/offline/db.web.ts`, `src/live-rtc.web.ts`
2. **Stubs de routes `app/`** — un fichier de 60 octets n'est pas du code mort, c'est une route.
3. **Routes dynamiques** — `[id].tsx`, `[slug].tsx`, `[page].tsx`, `(tabs)`, `_layout.tsx`, `+not-found.tsx`, `+html.tsx` sont résolues par le routeur, pas par un import.
4. **Plugins natifs** — `plugins/*.js` + `plugins/native/*.java` sont référencés depuis `app.json`, jamais importés par du TS.
5. **Assets** — référencés via `require()`, `app.json` (`icon`, `splash`, `favicon`, `plugins`), ou chemins runtime.
6. **i18n** — une clé peut être consommée par `t("...")` construit dynamiquement.
7. **Reanimated worklets** — une fonction utilisée uniquement dans un worklet peut sembler morte à l'analyse statique.
8. **`process.env.EXPO_PUBLIC_*`** et deep links (`scheme`, `intentFilters`) — références invisibles au graphe d'imports.

---

## 4. Outillage et commandes de référence

Aucun outil n'est installé aujourd'hui. Utiliser `npx --yes` pour ne pas polluer `package.json` pendant l'audit.

```bash
# Gates obligatoires
npx tsc --noEmit
npx expo lint
npx expo-doctor

# Graphe d'imports + fichiers/exports/deps morts (audit seul)
npx --yes knip@5 --include files,exports,dependencies,unlisted,duplicates

# Duplication (texte collé + quasi-duplicats)
npx --yes jscpd@4 --min-lines 12 --min-tokens 70 \
  --format typescript,tsx --ignore "**/node_modules/**,**/dist/**,**/android/**,**/.expo/**" .

# Recherche de références (la preuve)
rg -n --glob '!node_modules' --glob '!dist' --glob '!android' "NomDuSymbole" .

# Routes générées (après suppression d'une route)
npx expo customize tsconfig.json   # non — ne pas faire
npx expo start --clear            # régénère .expo/types
```

Config knip recommandée (fichier temporaire, non commité pendant l'audit) :

```json
{
  "entry": ["app/**/*.{ts,tsx}", "expo-router/entry", "plugins/*.js", "scripts/*.{js,mjs}"],
  "project": ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
  "ignore": ["dist/**", "android/**", ".expo/**", "node_modules/**"],
  "ignoreExportsUsedInFile": true
}
```

> Ne pas installer knip/jscpd en dépendance de production. Si installation : `devDependencies` uniquement, et la retirer à la fin si elle n'est pas adoptée.

---

## 5. MEGA PROMPT (à copier-coller tel quel)

````text
# RÔLE
Tu es un ingénieur senior TypeScript / React Native / Expo, spécialisé dans le nettoyage
de bases de code existantes. Tu es chirurgical, evidence-driven, et tu préfères laisser
un doute documenté plutôt que casser une fonctionnalité.

# MISSION
Nettoyer le dépôt ShipShop :
1. supprimer le code inutilisable (fichiers, exports, dépendances, assets, branches mortes) ;
2. détecter et réduire la duplication inutile (logique, constantes, types, styles, clés i18n) ;
3. corriger les dérives documentaires liées au code ;
SANS changer le comportement observable de l'application.

# CONTEXTE VÉRIFIÉ (ne pas le contredire sans preuve)
- Expo SDK 58, React Native 0.88, React 19, expo-router, TypeScript strict.
- Alias d'import : `@/*` -> racine du repo.
- `app/` contient 48 routes, dont 29 stubs volontaires du type
  `export { default } from "@/components/X"`. Ce ne sont PAS des doublons.
- `components/` contient les écrans/composants ; `src/` contient la logique.
- `plugins/` contient des config plugins Expo référencés par `app.json`.
- `dist/`, `android/`, `.expo/`, `node_modules/` sont générés : NE JAMAIS LES ÉDITER.
- `app.json` active `experiments.typedRoutes: true`.
- Splits plateforme légitimes à préserver :
  components/live/LiveKitGate.web.tsx, components/live/LiveMedia.web.tsx,
  components/useClientOnlyValue.web.ts, components/useColorScheme.web.ts,
  src/offline/db.web.ts, src/live-rtc.web.ts.

# RÈGLES NON NÉGOCIABLES
R1. Zéro changement de comportement. Un nettoyage ne modifie ni UI, ni navigation, ni réseau,
    ni offline, ni LiveKit, ni KYC, ni paiement.
R2. Aucune suppression sans PREUVE de non-usage (voir §PREUVE).
R3. Si une référence dynamique est possible (routeur, require(), t(), worklet, env, deep link,
    plugin natif, asset app.json), le statut est À VÉRIFIER — on ne supprime pas.
R4. Ne jamais éditer ios/, android/, .expo/, dist/, node_modules/.
R5. Ne jamais supprimer un `.web.ts[x]` au motif qu'un fichier homonyme existe.
R6. Ne jamais supprimer un fichier de `app/` sans traiter la navigation, les deep links
    et les typed routes ; un stub de route reste un stub de route.
R7. Pas de refactor « au passage ». Une vague = un type de déchet = un commit.
R8. Gates obligatoires : `npx tsc --noEmit` et `npx expo lint` doivent rester à 0 erreur
    avant ET après chaque vague. Toute nouvelle erreur = rollback du lot.
R9. Un lot = un commit atomique, message conventionnel :
    `chore(cleanup): remove <quoi> (<n> fichiers, <n> lignes)`.
R10. En cas de doute : statut À VÉRIFIER, ligne dans le rapport, aucune modification.
R11. Ne jamais retirer une dépendance sans vérifier : imports TS, `app.json` > plugins,
     config plugins, imports dynamiques, scripts npm, EAS.
R12. Le rapport final est obligatoire, même si rien n'a été supprimé.

# PREUVE (obligatoire pour chaque suppression)
Une suppression n'est valide que si les 3 vérifications sont faites :
P1. `rg -n --glob '!node_modules' --glob '!dist' --glob '!android' "<symbole|chemin>" .`
    ne renvoie que la définition et, le cas échéant, des occurrences dans des fichiers
    eux-mêmes morts (chaîne de mort à démontrer).
P2. Le fichier n'est pas une entrée : pas une route `app/`, pas un `_layout`, pas un
    `+not-found`/`+html`, pas un plugin de `app.json`, pas un asset de `app.json`.
P3. `npx tsc --noEmit` + `npx expo lint` passent après suppression.

# PHASE 0 — BASELINE (lecture seule)
1. Lis package.json, app.json, tsconfig.json, eslint.config.js, AGENTS.md.
2. Lance et note : `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`.
3. Compte : fichiers TS/TSX, lignes, routes, stubs, deps.
4. Sauvegarde les sorties dans `docs/cleanup/baseline.txt` (ou affiche-les).
Ne modifie AUCUN fichier dans cette phase.

# PHASE 1 — INVENTAIRE (lecture seule)
Produis 6 listes brutes, sans conclure :
I1. Fichiers candidats morts (knip files + graphe d'imports manuel).
I2. Exports candidats morts (knip exports, en excluant les entrées de route).
I3. Dépendances candidates mortes (knip dependencies/unlisted).
I4. Assets candidats morts (assets/** non référencés par code/app.json).
I5. Blocs dupliqués (jscpd) + duplication sémantique (couleurs, formats, validation, types,
    styles, clés i18n, constantes magiques).
I6. Branches mortes / flags / code commenté / TODO.
Pour chaque entrée : chemin, symbole, nombre de références, fichiers référents.

# PHASE 2 — CLASSIFICATION
Classe chaque candidat :
- CERTAIN : preuve P1+P2+P3, aucun doute.
- PROBABLE : pas de référence, mais zone sensible (runtime/natif/config).
- À VÉRIFIER : référence dynamique possible ou intention ambiguë.
- FAUX POSITIF : split plateforme, stub de route, plugin, asset app.json, entrée.
Sortie : tableau markdown trié par (impact lignes) x (risque faible).

# PHASE 3 — DÉTECTION DE DUPLICATION (analyse, pas encore de patch)
Cherche spécifiquement :
1. Couleurs : `colors` vs `useColors()` vs `palettes`/`paletteOf` vs `constants/Colors.ts`.
2. Formatage : helpers de `src/format.ts` vs formats inline (prix, dates, distances).
3. Téléphone/validation : `src/phone.ts` vs regex inline.
4. Types : doublons entre `src/types.ts` et types locaux.
5. Styles : blocs `StyleSheet.create` quasi identiques (cartes, lignes, sheets, boutons).
6. Data fetching : motifs `useQuery` + pagination + `PagedMore` répétés.
7. Erreurs : `try/catch` + toast répétés au lieu d'un helper.
8. Constantes magiques : hex, timeouts, limites de page, tailles.
9. i18n : clés définies non utilisées ; libellés FR codés en dur alors qu'une clé existe.
Pour chaque duplication : occurrences (fichier:ligne), taille estimée, proposition
(factoriser / laisser + justification), risque.

# PHASE 4 — EXÉCUTION PAR VAGUES
Ordre imposé (du moins risqué au plus risqué) :
V1. Leftovers de template Expo + composants morts évidents.
V2. Exports morts dans des fichiers vivants.
V3. Duplication mécanique sûre (constantes, types, helpers purs) — 1 commit par famille.
V4. Dépendances, assets, scripts, config plugins orphelins.
V5. Dérive documentaire (AGENTS.md, docs) + résidus assumés.

Pour chaque vague :
a) annonce le périmètre exact (liste de fichiers) ;
b) applique R1–R12 ;
c) lance les gates ;
d) si gate rouge : `git checkout -- <fichiers du lot>` et reclasse en À VÉRIFIER ;
e) commit atomique ;
f) mets à jour `docs/cleanup/journal.md` (voir §RAPPORT).

Interdictions d'exécution :
- ne jamais supprimer un fichier encore importé, même par un fichier que tu crois mort :
  démontre la chaîne de mort de la feuille vers la racine ;
- ne jamais « corriger » un type en `any` pour faire passer tsc ;
- ne jamais déplacer un fichier « pour ranger » pendant un lot de suppression ;
- ne jamais mélanger suppression et factorisation dans le même commit.

# PHASE 5 — VÉRIFICATION
1. `npx tsc --noEmit` -> 0 erreur.
2. `npx expo lint` -> 0 erreur (warnings baseline autorisés uniquement).
3. `npx expo-doctor` -> pas de régression.
4. Vérifie que les routes supprimées ne sont plus référencées (navigation, deep links).
5. Vérifie `app.json` : plugins et assets toujours résolus.
6. Si un écran a été touché, teste manuellement : ouverture, navigation retour, offline.
7. Compare les métriques baseline vs final.

# PHASE 6 — RAPPORT (obligatoire)
Écris `docs/cleanup/RAPPORT.md` avec :

## Métriques
| Métrique | Avant | Après | Delta |
|---|---|---|---|
| Fichiers TS/TSX | | | |
| Lignes TS/TSX | | | |
| Dépendances | | | |
| Exports morts (knip) | | | |
| Duplications (jscpd) | | | |

## Suppressions
| ID | Type | Fichier/Symbole | Preuve | Commit |
|---|---|---|---|---|

## Duplications traitées
| ID | Motif | Occurrences | Action | Risque |
|---|---|---|---|---|

## Résidus assumés (À VÉRIFIER)
| ID | Élément | Raison du doute | Ce qu'il faut vérifier |
|---|---|---|---|

## Rollback
Pour chaque commit : commande exacte de revert.

# FORMAT DE RÉPONSE ATTENDU (à chaque étape)
1. Ce que j'ai vérifié (commandes + résultats).
2. Ce que je propose (tableau).
3. Ce que je n'ai pas touché et pourquoi.
4. Prochaine action, avec le gate à passer.

# CRITÈRES D'ARRÊT
- Une suppression sans preuve P1/P2/P3 -> STOP, reclasser.
- Gate rouge -> STOP, rollback du lot.
- Doute sur une zone sensible (LiveKit, offline, KYC, paiement, natif, routeur) -> STOP,
  rapport, demander validation humaine.
- Plus aucun candidat CERTAIN -> arrêter la vague, ne pas élargir le périmètre.

# CHECKLIST FINALE
[ ] Aucun fichier de app/ supprimé sans traitement de la navigation
[ ] Aucun .web.ts[x] supprimé
[ ] Aucun plugin/asset de app.json orphelin par ma faute
[ ] tsc 0 erreur, lint 0 erreur
[ ] Chaque suppression a une preuve écrite
[ ] Chaque vague a un commit atomique réversible
[ ] RAPPORT.md rempli, résidus documentés
````

---

## 6. Découpage en vagues — détail

### Vague 0 — Baseline (aucune modif)
```bash
npx tsc --noEmit > docs/cleanup/tsc-before.txt 2>&1
npx expo lint > docs/cleanup/lint-before.txt 2>&1
npx expo-doctor > docs/cleanup/doctor-before.txt 2>&1
npx --yes knip@5 --include files,exports,dependencies,unlisted,duplicates > docs/cleanup/knip-before.txt 2>&1
npx --yes jscpd@4 --min-lines 12 --min-tokens 70 --format typescript,tsx \
  --ignore "**/node_modules/**,**/dist/**,**/android/**,**/.expo/**" . > docs/cleanup/jscpd-before.txt 2>&1
```

### Vague 1 — Leftovers template + composants morts (risque : très faible)

| ID | Élément | Preuve | Confiance | Action |
|---|---|---|---|---|
| F1 | `components/EditScreenInfo.tsx` | 0 import externe (seulement auto-références) | Certaine | Supprimer |
| F2 | `components/StyledText.tsx` | importé uniquement par F1 | Certaine (après F1) | Supprimer |
| F3 | `components/ExternalLink.tsx` | importé uniquement par F1 | Certaine (après F1) | Supprimer |
| F4 | `components/Soon.tsx` | 0 référence | Certaine | Supprimer |
| F5 | `components/ui/SoftSpinner.tsx` | 0 référence | Certaine | Supprimer |
| F6 | `components/useClientOnlyValue.ts` + `.web.ts` | 0 référence | Certaine | Supprimer |
| F7 | `components/Themed.tsx` + `components/useColorScheme.ts` + `.web.ts` | utilisés uniquement par `app/modal.tsx`, `app/+not-found.tsx` et F1 | Probable | Remplacer les 2 usages par `src/theme` + `useColors`, puis supprimer |
| F8 | `constants/Colors.ts` | utilisé uniquement par F7 et F1 ; doublon de `src/theme.ts` | Certaine après F7 | Supprimer |

> Gain estimé : ~8 fichiers, ~300 lignes, 0 dépendance.

### Vague 2 — Exports morts dans fichiers vivants
- `knip --include exports` puis filtre manuel.
- Exclure : entrées de route, exports consommés par `app.json`, types réexportés publiquement.
- 1 commit par module (`src/format.ts`, `src/theme.ts`, etc.).

### Vague 3 — Duplication mécanique sûre
Ordre : constantes → types → helpers purs → styles partagés → i18n.
- Interdit dans cette vague : toucher à un écran pour « uniformiser » son rendu.
- Chaque factorisation doit être couverte par un comportement identique (diff de rendu nul).

### Vague 4 — Dépendances, assets, scripts, plugins

| ID | Élément | Preuve | Confiance | Action |
|---|---|---|---|---|
| F9 | `plugins/withScreenShareKeepAlive.js` + `plugins/native/MediaProjectionService.java` + `plugins/native/ScreenShareKeepAliveService.java` | absent de `app.json` > `plugins` | **À VÉRIFIER** — le partage d'écran LiveKit peut en dépendre | Vérifier la feature avant toute suppression |
| F10 | `scripts/patch-safe-back.mjs` | absent de `package.json` > `scripts`, 0 import | Probable | Supprimer ou documenter |
| F11 | `scripts/make-app-icons.py` | absent de `package.json` > `scripts` | Probable | Conserver si outil de génération d'icônes, sinon supprimer |
| F12 | Dépendances knip | à établir | À établir | Vérifier `app.json` + imports dynamiques avant retrait |

> ⚠️ F9 est le point le plus dangereux du plan : un config plugin orphelin peut être une
> fonctionnalité native cassée **ou** un vestige. Ne pas trancher sans test du partage d'écran.

### Vague 5 — Dérive documentaire + résidus
- `AGENTS.md` : corriger « routes dans `src/app/` » → « routes dans `app/` ».
- Documenter les faux positifs conservés (splits `.web`, stubs, plugins).
- Archiver `docs/cleanup/` ou le supprimer après revue.

---

## 7. Definition of Done

- [ ] `npx tsc --noEmit` : 0 erreur.
- [ ] `npx expo lint` : 0 erreur, aucune nouvelle warning.
- [ ] `npx expo-doctor` : pas de régression.
- [ ] Aucun fichier `app/` supprimé sans vérification navigation/deep links.
- [ ] Aucun `.web.ts[x]` supprimé.
- [ ] Aucun plugin/asset `app.json` cassé.
- [ ] Chaque suppression a une preuve P1/P2/P3 dans `docs/cleanup/RAPPORT.md`.
- [ ] Chaque vague est un commit atomique réversible.
- [ ] Métriques avant/après renseignées.
- [ ] Résidus « À VÉRIFIER » listés avec la question exacte à trancher.

**Objectif chiffré réaliste** : −8 à −15 fichiers, −400 à −1 500 lignes, −0 à −3 dépendances, sans toucher aux écrans métier. Toute promesse supérieure doit être justifiée par knip/jscpd, pas par intuition.

---

## 8. Risques et rollback

| Risque | Probabilité | Mitigation |
|---|---|---|
| Supprimer un composant utilisé par un worklet Reanimated | Moyenne | rg sur le nom + test manuel de l'écran |
| Supprimer une route encore liée par deep link | Moyenne | vérifier `app.json` scheme + `router.push` + `href` |
| Casser le partage d'écran LiveKit (F9) | Moyenne | test manuel avant/après, statut À VÉRIFIER par défaut |
| Casser les typed routes | Faible | `npx expo start --clear` après changement de routes |
| Casser l'offline (db.web / sync) | Faible | ne pas toucher `src/offline/**` en vague 1–3 |
| Retirer une dep utilisée par un config plugin | Faible | vérifier `app.json` avant `npm uninstall` |
| « Nettoyage » qui devient un refactor géant | Élevée | R7 + vagues + un commit par famille |

**Rollback** : chaque commit est isolé ; `git revert <sha>` suffit. En cas de gate rouge
pendant une vague : `git checkout -- <fichiers du lot>` avant tout autre essai.

---

## 9. Prompt court de reprise (par vague)

```text
Contexte : ShipShop, Expo SDK 58, routes dans app/, logique dans src/, composants dans components/.
Applique le protocole docs/PLAN-NETTOYAGE-CODE.md (R1–R12, preuves P1–P3).
Vague : <V1|V2|V3|V4|V5>. Périmètre : <liste>.
Livrables : diff minimal, gates tsc+lint verts, commit atomique, mise à jour du journal.
Interdit : changer le comportement, toucher app/ (hors V5 doc), .web.ts[x], plugins, assets app.json.
Si doute : classe À VÉRIFIER et explique pourquoi, ne supprime pas.
```
