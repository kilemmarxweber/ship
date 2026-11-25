# Plan de développement --- Virtual Try-On (essayage virtuel)

**Architecture cible : React Native / Expo pour Android + Next.js pour
le Web + backend IA partagé**

Version du plan : 1.0\
Objectif : construire une plateforme d'essayage virtuel où un
utilisateur choisit un mannequin, sélectionne un vêtement à partir d'une
photo (vêtement seul ou porté), visualise un rendu IA 2D et, lorsque
l'asset 3D existe, tourne autour d'un mannequin habillé à 360°.

## Mapping ShipShop (état actuel)

Dans le dépôt **ShipShop** (Expo), un sous-ensemble du plan est déjà
branché sur les filtres produits CREATE AI :

- **Avatars 2D locaux** : `assets/mannequins/` + catalogue
  `src/avatars.ts` avec `bodyProfile` calibré (équivalent table
  `avatars` sans Supabase).
- **Preview client** : `src/virtual-try-on.ts` +
  `createClientPreviewTryOn` dans `src/tryon-types.ts` (provider
  `client-preview`, pas d’appel FASHN).
- **UI** : `ProductFiltersScreen` — mannequin nu → Essayer → porter →
  Valider ; détection `flat-lay` / `model`.

**Pas encore dans ShipShop** : monorepo, migrations Supabase, API
`POST /api/v1/tryons` hébergée, FASHN / FastAPI GPU, viewer GLB 3D
(phases 1, 4, 5, 6 du plan). Les types de session sont prêts pour
brancher `provider: "hosted"` plus tard.

---

## 1. Décisions d'architecture

### Applications clientes

---

Application Technologie Responsabilité

---

Mobile Android Expo + React Native + Parcours mobile,
TypeScript + NativeWind sélection d'images,
catalogue, essayage,
historique

Web Next.js + TypeScript + Site web, espace
Tailwind CSS utilisateur, catalogue,
administration et
essayage web

Visualisation 3D mobile Three.js / React Three Affichage des avatars
Fiber Native, après et vêtements GLB
validation de  
 compatibilité

Visualisation 3D web Three.js / React Three Affichage 3D dans le
Fiber Web navigateur

API métier Next.js Route Handlers Authentification,
ou backend Node.js catalogue, sessions,
séparé orchestration des
générations

Service IA Python + FastAPI + Inférence VTON
PyTorch auto-hébergée

Stockage / base Supabase (Postgres, Utilisateurs,
Storage, Auth) vêtements, avatars,
résultats et fichiers

IA hébergée API FASHN Essai virtuel sans
gérer les GPU

IA locale FASHN VTON 1.5 Contrôle du modèle et
auto-hébergé des traitements sur GPU

---

### Règle importante : séparer les résultats 2D et les assets 3D

- **VTON 2D** : génère une image du mannequin portant un vêtement
  depuis une vue donnée. Il ne produit pas automatiquement un vêtement
  3D.
- **Essayage 3D** : nécessite un avatar 3D et un vêtement 3D
  (GLB/glTF) ajusté au corps, avec matériaux, textures et
  éventuellement squelette/skin weights compatibles.
- Une photo de vêtement, même détourée, ne contient pas les
  informations nécessaires pour connaître automatiquement le dos,
  l'épaisseur, le patron ou la physique du tissu.

Pour la première version, utiliser des vêtements GLB préparés
manuellement pour le 360° et VTON 2D pour les vêtements qui n'ont pas
encore d'asset 3D.

---

## 2. Architecture logique

```text
                 ┌───────────────────────────┐
                 │        UTILISATEURS       │
                 └─────────────┬─────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
      ┌───────▼────────┐                ┌───────▼────────┐
      │ Android        │                │ Web            │
      │ Expo / RN      │                │ Next.js        │
      │ NativeWind     │                │ Tailwind CSS   │
      │ 3D viewer      │                │ 3D viewer      │
      └───────┬────────┘                └───────┬────────┘
              └────────────────┬────────────────┘
                               │ HTTPS
                     ┌─────────▼─────────┐
                     │ API métier        │
                     │ Auth / Catalogue  │
                     │ Try-on jobs       │
                     └──────┬───────┬────┘
                            │       │
                ┌───────────▼─┐   ┌─▼────────────────┐
                │ Supabase    │   │ Orchestrateur IA │
                │ Postgres    │   │ Hosted / Local   │
                │ Storage     │   └──────┬───────────┘
                └─────────────┘          │
                                  ┌──────▼─────────┐
                                  │ FASHN API      │
                                  │ ou FastAPI GPU │
                                  └────────────────┘
```

Les deux clients utilisent les mêmes endpoints et les mêmes données. Les
clés secrètes restent exclusivement côté serveur.

---

## 3. Outils à installer

### 3.1 Outils communs

---

Outil Utilité

---

Node.js LTS Exécuter Next.js, Expo et les
outils JavaScript

npm ou pnpm Gestion des dépendances

Git Versionner le code

Cursor IDE et agent de développement

Android Studio Android SDK, émulateur et ADB

JDK compatible avec la version Compilation Android
Expo/Android choisie

Expo Go (pour premiers essais) Tester rapidement les écrans
compatibles

EAS CLI (facultatif) Builds Android et distribution

Supabase CLI (facultatif) Développement local et migrations

Python 3.10/3.11 selon les Service IA
dépendances du modèle

Docker Isoler le backend IA et les
services

---

**Matériel recommandé :** ordinateur avec 16 Go de RAM minimum pour le
développement mobile/web ; GPU NVIDIA compatible CUDA avec suffisamment
de VRAM pour l'auto-hébergement IA. Le modèle FASHN VTON 1.5 annonce
environ 8 Go de VRAM pour l'inférence, à confirmer selon la résolution
et la configuration.

### 3.2 Outils mobile Android

- Expo + React Native + TypeScript
- Expo Router
- NativeWind
- `expo-image-picker` pour sélectionner les photos
- `expo-image` pour afficher les images
- `expo-file-system` pour les fichiers
- `react-native-safe-area-context`
- Three.js / React Three Fiber Native uniquement après un prototype de
  compatibilité sur appareil Android
- Android Studio Emulator et ADB
- Maestro pour les tests de parcours, en option

### 3.3 Outils Web

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Three Fiber et Three.js pour la scène 3D web
- Zod pour valider les données
- Supabase Auth et client Supabase
- Playwright pour les tests navigateur

### 3.4 Backend et IA

- Next.js Route Handlers pour l'API métier
- Supabase Auth, Postgres et Storage
- Python + FastAPI pour le service IA local
- PyTorch + CUDA pour FASHN VTON 1.5
- Redis et une file de tâches (ex. BullMQ ou Celery) lorsque le volume
  le justifie
- FASHN API comme fournisseur hébergé
- Sentry ou équivalent pour les erreurs et la surveillance
  (facultatif)

### 3.5 Création des vêtements 3D

- Blender : préparation, nettoyage et optimisation des fichiers 3D
- CLO 3D ou Marvelous Designer : création et simulation des vêtements
- Export GLB/glTF
- Compression des textures et modèles avant livraison mobile

---

## 4. Organisation des dépôts

Pour un projet maintenable, utiliser un monorepo :

```text
virtual-tryon/
├── apps/
│   ├── mobile/                 # Expo + React Native + NativeWind
│   └── web/                    # Next.js
├── services/
│   └── vton-ai/                # FastAPI + PyTorch + modèle local
├── packages/
│   ├── shared-types/           # Types TypeScript partagés
│   ├── api-client/             # Client API commun web/mobile
│   └── design-tokens/          # Couleurs, tailles, tokens communs
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
│   └── PLAN.md
├── .env.example
├── package.json
└── README.md
```

Ne pas partager les composants React Native avec Next.js sans vérifier
leur compatibilité. Partager en priorité les types, schémas de
validation, constantes et clients API.

---

## 5. Initialisation des projets

Les commandes ci-dessous sont un point de départ. Les versions précises
des dépendances doivent être alignées avec la version Expo et React
Native générée par le CLI.

### 5.1 Créer le monorepo

```bash
mkdir virtual-tryon
cd virtual-tryon
git init
mkdir -p apps services packages docs
```

Créer le projet mobile :

```bash
npx create-expo-app@latest apps/mobile
```

Créer le projet web :

```bash
npx create-next-app@latest apps/web
```

Pour le web, choisir TypeScript, App Router et Tailwind CSS.

### 5.2 Dépendances mobile

Depuis `apps/mobile` :

```bash
cd apps/mobile
npx expo install expo-image-picker expo-image expo-file-system react-native-safe-area-context
```

Installer NativeWind selon la version retenue et suivre sa documentation
officielle. Pour NativeWind v4, la configuration classique utilise
Tailwind CSS v3, Babel, Metro et `global.css`. Ne pas copier une
configuration v4 dans un projet v5 sans adaptation.

### 5.3 Dépendances 3D

Pour le Web :

```bash
cd apps/web
npm install three @react-three/fiber @react-three/drei
```

Pour React Native, faire d'abord un prototype séparé et suivre la
documentation React Three Fiber Native correspondant aux versions de
React, React Native et Expo du projet. Ne pas supposer que toutes les
fonctionnalités de Drei ou WebGL du navigateur sont disponibles sur
mobile.

### 5.4 Dépendances Web et API

Dans `apps/web` :

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

### 5.5 Service IA local

Dans `services/vton-ai` :

```bash
python -m venv .venv
```

Activer l'environnement puis installer les dépendances recommandées par
le dépôt officiel FASHN VTON 1.5. Vérifier au préalable la version de
Python, PyTorch et CUDA prise en charge par le dépôt.

```bash
pip install fastapi uvicorn pillow requests python-multipart
```

Puis cloner et installer le modèle selon ses instructions officielles :

```bash
git clone https://github.com/fashn-AI/fashn-vton-1.5.git
cd fashn-vton-1.5
```

Ne pas inventer l'initialisation du pipeline : reprendre exactement
l'API Python et les paramètres de la version du dépôt installée.

---

## 6. Modèles et stratégie IA

### 6.1 Mode hébergé

Utiliser l'API FASHN pour lancer une génération depuis le backend.

Flux :

1.  Le client envoie les images au stockage privé.
2.  Le backend vérifie l'utilisateur et les fichiers.
3.  Le backend crée une session d'essayage.
4.  Le backend appelle FASHN avec les URL accessibles et sécurisées
    requises.
5.  Le backend stocke l'identifiant de prédiction.
6.  Le backend vérifie le statut ou reçoit un webhook si disponible.
7.  Le résultat est copié dans Supabase Storage.
8.  Le client récupère une URL signée pour afficher le résultat.

Ne jamais appeler l'API FASHN directement depuis l'application mobile
avec une clé secrète.

### 6.2 Mode auto-hébergé

Déployer FASHN VTON 1.5 dans un service Python avec GPU NVIDIA/CUDA.

Flux :

1.  Le backend métier crée une tâche.
2.  La tâche est envoyée au service IA local.
3.  Le service charge les images depuis un stockage contrôlé.
4.  Le modèle génère le résultat.
5.  Le résultat est envoyé vers Supabase Storage.
6.  La tâche passe à `completed` ou `failed`.

Le service IA doit être protégé par authentification interne, limites de
taille, validation des fichiers et limites de concurrence.

### 6.3 Photos à plat et photos portées

Prévoir un champ `garment_photo_type` :

- `flat-lay` : vêtement seul, posé à plat.
- `model` : vêtement porté par une personne.

Prévoir un prétraitement distinct pour chaque type : contrôle de
qualité, orientation, résolution, détection/segmentation si nécessaire
et validation de catégorie. Tester les deux types avec un jeu de photos
représentatif avant mise en production.

### 6.4 Reconstruction 3D

La génération 2D ne doit pas être utilisée comme si elle avait produit
un modèle 3D.

Pour le 360° :

- créer/importer un avatar GLB ;
- créer/importer le vêtement GLB ;
- ajuster le vêtement à la morphologie ;
- vérifier le squelette et les poids d'influence si le vêtement est
  animé ;
- optimiser les textures et le nombre de polygones ;
- stocker l'asset 3D et sa compatibilité dans la base.

La reconstruction automatique d'un vêtement 3D depuis une ou deux photos
est un chantier R&D distinct. Ne pas la promettre dans le MVP.

---

## 7. API métier proposée

Préfixe : `/api/v1`

Méthode Endpoint Rôle

---

POST `/uploads/sign` Obtenir une URL signée d'envoi
GET `/avatars` Lister les mannequins
GET `/garments` Lister les vêtements
GET `/garments/:id` Détail d'un vêtement et ses assets
POST `/tryons` Créer une session d'essayage
GET `/tryons/:id` Lire le statut d'une génération
GET `/tryons` Historique de l'utilisateur
POST `/tryons/:id/cancel` Annuler si le fournisseur le permet
GET `/garments/:id/3d-assets` Obtenir les modèles 3D compatibles

Exemple de création de session :

```json
{
  "avatarId": "uuid-avatar",
  "garmentId": "uuid-garment",
  "provider": "hosted",
  "garmentPhotoType": "flat-lay",
  "category": "tops"
}
```

Réponse :

```json
{
  "id": "uuid-session",
  "status": "queued",
  "provider": "hosted"
}
```

Statuts recommandés :

- `queued`
- `processing`
- `completed`
- `failed`
- `cancelled`

Le client ne choisit jamais directement une URL arbitraire de callback
ni un fournisseur sans validation backend.

---

## 8. Modèle de données Supabase

### `avatars`

- `id` UUID
- `name` TEXT
- `thumbnail_path` TEXT
- `model_glb_path` TEXT
- `body_profile` JSONB
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ

### `garments`

- `id` UUID
- `name` TEXT
- `category` TEXT
- `photo_type` TEXT
- `image_path` TEXT
- `brand` TEXT nullable
- `is_active` BOOLEAN
- `created_at` TIMESTAMPTZ

### `garment_3d_assets`

- `id` UUID
- `garment_id` UUID
- `avatar_id` UUID nullable
- `glb_path` TEXT
- `texture_path` TEXT nullable
- `skeleton_id` TEXT nullable
- `size_label` TEXT nullable
- `fit_profile` JSONB nullable
- `created_at` TIMESTAMPTZ

### `tryon_sessions`

- `id` UUID
- `user_id` UUID
- `avatar_id` UUID
- `garment_id` UUID
- `provider` TEXT
- `provider_job_id` TEXT nullable
- `status` TEXT
- `result_path` TEXT nullable
- `error_code` TEXT nullable
- `created_at` TIMESTAMPTZ
- `completed_at` TIMESTAMPTZ nullable

Activer RLS sur les tables contenant des données utilisateur. Les
utilisateurs ne doivent lire que leurs propres sessions. Les opérations
privilégiées sont effectuées côté serveur avec une clé secrète.

---

## 9. Écrans à développer

### Mobile Android

1.  Accueil / catalogue.
2.  Filtres par catégorie.
3.  Détail du vêtement.
4.  Sélection du mannequin.
5.  Essayage 3D avec rotation et zoom.
6.  Essayage IA 2D.
7.  Résultat et comparaison avant/après.
8.  Historique des essayages.
9.  Profil et préférences.

### Web Next.js

1.  Landing page.
2.  Catalogue.
3.  Détail produit.
4.  Studio d'essayage 3D.
5.  Générateur Virtual Try-On.
6.  Galerie des résultats.
7.  Authentification et compte.
8.  Administration des vêtements.
9.  Gestion des avatars et assets 3D.
10. Suivi des générations et coûts IA.

---

## 10. Plan d'exécution par phases

### Phase 0 --- Audit et fondations

- Vérifier les versions Node, Expo, React Native et Next.js.
- Initialiser Git et le monorepo.
- Définir les variables d'environnement.
- Créer les types partagés.
- Configurer lint, formatage et TypeScript.

**Livrable :** dépôts mobile et web qui démarrent proprement.

### Phase 1 --- Backend et données

- Créer le projet Supabase.
- Créer les migrations SQL.
- Configurer Auth et Storage.
- Définir les tables et politiques RLS.
- Créer les routes de catalogue et d'upload.

**Livrable :** catalogue partagé entre mobile et web.

### Phase 2 --- Mobile Android

- Construire la navigation Expo Router.
- Créer le catalogue et les filtres.
- Ajouter la sélection de photos.
- Afficher le mannequin 3D.
- Tester rotation, zoom et performances sur appareil Android.

**Livrable :** parcours mobile fonctionnel avec avatar 3D.

### Phase 3 --- Web Next.js

- Construire les pages catalogue et détail.
- Ajouter le viewer 3D web.
- Ajouter les outils d'administration.
- Réutiliser les mêmes API et types.

**Livrable :** application web connectée au même backend.

### Phase 4 --- Virtual Try-On hébergé

- Intégrer FASHN API côté serveur.
- Créer les sessions et statuts.
- Gérer erreurs, délais et quotas.
- Stocker les résultats.
- Afficher l'image générée sur les deux clients.

**Livrable :** premier essayage IA fonctionnel.

### Phase 5 --- Virtual Try-On auto-hébergé

- Installer le modèle sur serveur GPU.
- Créer le service FastAPI.
- Ajouter une file de tâches.
- Connecter le backend métier.
- Comparer qualité, latence et coût avec l'API hébergée.

**Livrable :** fournisseur IA interchangeable.

### Phase 6 --- Vêtements 3D

- Préparer les premiers vêtements GLB.
- Ajuster les vêtements sur les avatars.
- Tester les tailles.
- Gérer textures et matériaux.
- Optimiser le rendu mobile.

**Livrable :** essayage 3D cohérent à 360° pour un catalogue limité.

### Phase 7 --- Qualité et production

- Tests Android sur appareils réels.
- Tests web avec Playwright.
- Tests de parcours avec Maestro.
- Tests de sécurité et RLS.
- Compression des assets.
- Monitoring, sauvegardes et quotas.
- Documentation de déploiement.

**Livrable :** version bêta prête à être testée par des utilisateurs.

---

## 11. Tests d'acceptation

Le MVP est validé lorsque :

- L'utilisateur peut se connecter sur mobile et sur le web.
- Le catalogue est identique sur les deux plateformes.
- Les images peuvent être envoyées dans un stockage privé.
- Une photo à plat peut être envoyée au moteur VTON.
- Une photo de vêtement porté passe par le prétraitement adapté.
- Une génération peut être suivie jusqu'à son résultat ou son échec.
- Le résultat est consultable dans l'historique.
- Le mannequin GLB tourne à 360° sur Android.
- Le viewer 3D web fonctionne dans les navigateurs ciblés.
- Un vêtement GLB compatible peut être affiché sur un avatar.
- Aucun secret API n'est exposé dans les bundles clients.
- Les utilisateurs ne peuvent pas consulter les résultats privés
  d'autres comptes.

---

## 12. Sécurité, coûts et limites

- Ne jamais exposer les clés FASHN ou Supabase Service Role dans Expo
  ou le navigateur.
- Limiter le poids, les formats et les dimensions des images.
- Vérifier les droits d'utilisation des photos et des modèles.
- Obtenir le consentement des personnes photographiées.
- Définir une durée de conservation et une procédure de suppression
  des images.
- Utiliser des URLs signées à durée limitée.
- Limiter le nombre de générations par utilisateur.
- Journaliser les erreurs sans enregistrer inutilement les images
  privées.
- Mesurer le coût par génération pour l'API hébergée et le GPU
  auto-hébergé.
- Vérifier les licences de chaque modèle, dataset et asset 3D avant
  usage commercial.

---

## 13. Documentation officielle à consulter

- Expo : https://docs.expo.dev/
- Expo Router : https://docs.expo.dev/router/introduction/
- NativeWind : https://www.nativewind.dev/
- Next.js : https://nextjs.org/docs
- Supabase : https://supabase.com/docs
- React Three Fiber : https://r3f.docs.pmnd.rs/
- React Three Fiber Native :
  https://r3f.docs.pmnd.rs/getting-started/installation
- Three.js : https://threejs.org/docs/
- FASHN VTON 1.5 : https://github.com/fashn-AI/fashn-vton-1.5
- FASHN API : https://docs.fashn.ai/
- FastAPI : https://fastapi.tiangolo.com/
- Maestro : https://maestro.mobile.dev/
- Playwright : https://playwright.dev/docs/intro
- Blender : https://docs.blender.org/
- CLO 3D : https://www.clo3d.com/
- Marvelous Designer : https://www.marvelousdesigner.com/

---

## 14. Ordre de priorité conseillé

**Ne commence pas par la reconstruction automatique de vêtements 3D.**
C'est la partie la plus difficile et la plus coûteuse.

Ordre conseillé :

1.  Catalogue + Supabase.
2.  Avatar GLB rotatif.
3.  VTON hébergé.
4.  Résultats et historique.
5.  VTON auto-hébergé.
6.  Catalogue de vêtements GLB préparés.
7.  Ajustement des vêtements et tailles.
8.  Recherche sur la reconstruction 3D automatique.

**Résultat attendu :** une application Android Expo, un site web Next.js
et un backend commun. Les deux clients peuvent utiliser le même
catalogue, les mêmes avatars, les mêmes sessions d'essayage et les mêmes
moteurs IA, tandis que le viewer 3D affiche les vêtements GLB réellement
préparés pour les avatars.
