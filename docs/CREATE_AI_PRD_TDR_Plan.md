# CREATE AI --- Plan directeur, PRD et TDR

**Version :** 1.1\
**Date :** 23 novembre 2026\
**Statut :** Document de cadrage --- intake média caméra + upload\
**Stack cible :** React Native (Expo) + Next.js + TypeScript

------------------------------------------------------------------------

## 1. Résumé exécutif

CREATE AI est une plateforme mobile et web de découverte, de
visualisation et de création de contenus assistés par intelligence
artificielle autour de produits de plusieurs catégories : **Mode,
Beauté, Tech, Coiffure et Alimentaire**.

L'expérience principale permet à un utilisateur de sélectionner une
catégorie, importer une photo d'un produit ou d'un article, choisir un
style ou un profil de visualisation, puis obtenir une création générée
ou transformée par IA. Le résultat peut être consulter, comparer,
enregistrer et partager.

Le premier cas d'usage prioritaire est l'essayage virtuel de vêtements :
l'utilisateur fournit une image d'un vêtement, choisit un modèle
(adulte, enfant, jeune ou senior, homme ou femme, teinte de peau,
morphologie et pose), puis demande une image réaliste du modèle portant
le vêtement. Le système doit préserver autant que possible les
caractéristiques essentielles du produit fourni.

**Principe produit :** une expérience simple côté utilisateur, un moteur
IA interchangeable côté serveur et des règles de sécurité, de
consentement et de modération intégrées dès la conception.

## 2. Vision, objectifs et périmètre

### 2.1 Vision

Devenir un studio de création visuelle IA accessible depuis un téléphone
ou un navigateur, permettant aux particuliers, créateurs, commerçants et
marques de présenter et visualiser leurs produits avec des rendus de
qualité.

### 2.2 Objectifs

-   Proposer une interface cohérente et moderne sur Android, iOS et le
    web.
-   Permettre l'importation d'images depuis la caméra, la galerie ou un
    fichier.
-   Fournir des parcours adaptés à chaque catégorie de produits.
-   Générer des images réalistes et, dans une phase ultérieure, des
    vidéos.
-   Permettre de sauvegarder, retrouver, partager et supprimer ses
    créations.
-   Préparer une architecture évolutive permettant de changer de
    fournisseur IA.
-   Mesurer l'usage, les coûts de génération, la qualité et les erreurs.

### 2.3 Publics cibles

-   Utilisateurs souhaitant essayer ou visualiser un produit avant
    achat.
-   Boutiques, vendeurs en ligne et petites entreprises.
-   Créateurs de contenu et influenceurs.
-   Marques et professionnels souhaitant produire des visuels marketing.
-   Administrateurs chargés de gérer les catégories, modèles, styles et
    contenus.

### 2.4 Périmètre du MVP

**Inclus :** - Application mobile Expo pour Android et iOS. -
Application web Next.js responsive. - Inscription, connexion et gestion
du profil. - Catalogue des cinq catégories. - Importation et stockage
sécurisé des images. - Parcours Mode IA complet en priorité. - Parcours
initiaux pour Beauté, Tech, Coiffure et Alimentaire. - Sélection de
styles et paramètres adaptés à chaque catégorie. - Génération d'images
via un fournisseur IA externe. - Historique, galerie, téléchargement et
partage. - Modération des entrées et sorties, gestion des erreurs et
quotas. - Interface d'administration minimale.

**Hors périmètre initial :** - Paiement marchand et marketplace
complète. - Achat direct de produits et gestion de livraison. - Essayage
3D temps réel ou reconstruction corporelle avancée. - Génération vidéo à
grande échelle. - Réseau social complet, messagerie et commentaires
publics. - Diagnostic médical, dermatologique ou nutritionnel. -
Garantie que le rendu IA représente exactement la matière, la taille, la
couleur ou les propriétés physiques d'un produit.

## 3. Expérience utilisateur et navigation

### 3.1 Navigation principale

1.  **Accueil / Explorer** : catégories, tendances, exemples et
    créations récentes.
2.  **Créer** : démarrer un nouveau projet IA.
3.  **Galerie** : créations enregistrées et historique.
4.  **Favoris** : styles, modèles et créations sauvegardés.
5.  **Profil** : compte, paramètres, confidentialité, crédits et aide.

Sur mobile, utiliser une barre de navigation inférieure. Sur le web,
utiliser une navigation latérale ou supérieure selon la largeur
disponible.

### 3.2 Parcours générique de création

1.  L'utilisateur choisit une catégorie.
2.  Il sélectionne un type de création ou un filtre.
3.  Il ajoute un média via **caméra (photo ou vidéo ≤ 60 s)**,
    **galerie**, **fichiers**, ou un exemple fourni. Toutes les sources
    passent par le même pipeline d'upload avant la suite du parcours.
4.  L'application affiche les paramètres disponibles pour cette
    catégorie.
5.  L'utilisateur configure le rendu et confirme les droits
    d'utilisation de l'image.
6.  Un récapitulatif présente les options et le coût éventuel en
    crédits.
7.  L'utilisateur lance la génération.
8.  L'application affiche l'état : en attente, en cours, terminé ou
    échoué.
9.  Le résultat s'affiche avec les actions : recommencer, modifier,
    comparer, enregistrer, télécharger et partager.
10. L'utilisateur peut supprimer l'image source et le résultat depuis sa
    galerie.

### 3.3 Principes UX

-   Interface mobile-first, rapide et compréhensible.
-   Une action principale clairement visible par écran.
-   Prévisualisation avant génération.
-   Paramètres avancés facultatifs, masqués par défaut.
-   États de chargement explicites et possibilité de quitter puis
    retrouver une génération.
-   Messages d'erreur compréhensibles, sans exposer les détails
    techniques.
-   Accessibilité : contrastes suffisants, tailles de texte lisibles,
    libellés accessibles et navigation clavier sur le web.
-   Les filtres doivent être des options réellement appliquées par le
    moteur IA, et non de simples décorations d'interface.

### 3.4 Intake média à l'ajout d'article

Lors de la publication d'un article (parcours vendeur / publish),
l'utilisateur doit pouvoir :

1.  **Prendre une photo** avec la caméra appareil.
2.  **Filmer une vidéo** (durée maximale 60 secondes).
3.  **Importer** depuis la galerie ou les fichiers du téléphone /
    navigateur.

Ces trois actions coexistent : l'upload existant n'est jamais retiré.
Chaque média capturé ou importé est prévisualisé, puis envoyé via
`POST /api/upload` (`variant=product`) avant d'être référencé dans
`images[]` du produit (`POST /api/products`).

**Mapping d'implémentation ChipShop (lot actuel) :**

-   **Mobile Android / iOS :** application Expo `ShipShop`
    (`ArticleStudio`, `MediaStrip`, `pick-media` +
    `expo-image-picker`).
-   **Web :** monolithe Next.js `Desktop/shop`
    (`media-uploader.tsx`).
-   **API / stockage :** mêmes routes `/api/upload` et `/api/products` ;
    fichiers sur disque local `/uploads` (pas de migration S3 dans ce
    lot).

------------------------------------------------------------------------

# PARTIE A --- PRD (Product Requirements Document)

## 4. Catalogue des catégories et styles de filtres

Les styles ci-dessous constituent le catalogue initial à valider. Chaque
catégorie possède ses propres paramètres, contrôles et règles de
génération. Les options non prises en charge par le fournisseur IA
choisi doivent être désactivées ou signalées clairement.

## 4.1 Catégorie MODE

### Objectif

Permettre à l'utilisateur d'importer une photo de vêtement, chaussure ou
accessoire et de générer une visualisation portée par un modèle virtuel.

### Types de produits

-   Hauts : t-shirts, chemises, polos, pulls, vestes.
-   Bas : pantalons, jeans, jupes, shorts.
-   Tenues : robes, costumes, ensembles, uniformes.
-   Chaussures : baskets, chaussures habillées, sandales.
-   Accessoires : sacs, lunettes, chapeaux, bijoux.

### Paramètres de modèle

-   Présentation : masculine, féminine ou neutre.
-   Tranche d'âge représentée : enfant, adolescent, jeune adulte, adulte
    ou senior.
-   Teint de peau : palette de teintes variées, dont peau claire,
    moyenne et foncée.
-   Morphologie : plusieurs silhouettes non stigmatisantes.
-   Taille apparente : options de proportions, sans prétendre mesurer la
    taille réelle du vêtement.
-   Pose : debout, marche, assise, portrait, face, profil, trois-quarts.
-   Expression : naturelle, souriante, éditoriale.
-   Nombre de modèles : un modèle au départ, plusieurs modèles en
    évolution.

### Styles visuels Mode

1.  **Studio e-commerce** : fond uni clair, éclairage homogène, pose
    neutre, vêtement lisible.
2.  **Streetwear urbain** : décor de rue, pose décontractée, ambiance
    contemporaine.
3.  **Luxe éditorial** : éclairage travaillé, décor premium, cadrage
    magazine.
4.  **Casual quotidien** : environnement naturel, rendu spontané.
5.  **Business / classique** : décor professionnel et posture soignée.
6.  **Sport / fitness** : décor sportif et pose dynamique.
7.  **Traditionnel / culturel** : mise en scène respectueuse du contexte
    demandé, sans caricature.
8.  **Minimaliste** : fond neutre et attention portée au produit.
9.  **Outdoor / lifestyle** : parc, plage, ville ou décor extérieur.
10. **Défilé / fashion show** : podium et éclairage de défilé.

### Contrôles de fidélité

-   Conserver autant que possible la coupe, les motifs, logos et
    couleurs visibles du vêtement.
-   Ne pas inventer de marque ou de logo.
-   Signaler que les rendus sont des simulations et peuvent différer du
    produit réel.
-   Prévoir une option de comparaison entre photo source et résultat.
-   Si l'image source ne montre pas suffisamment le produit, demander
    une autre photo ou afficher un avertissement.

### Résultat attendu

Une image du modèle portant le produit, avec possibilité de changer le
modèle, la pose ou le décor sans devoir réimporter le produit lorsque le
moteur le permet.

## 4.2 Catégorie BEAUTÉ

### Objectif

Visualiser des styles de maquillage et la présentation de produits
cosmétiques à partir d'une image ou d'un portrait fourni avec
consentement.

### Sous-catégories

-   Maquillage : lèvres, yeux, teint, maquillage complet.
-   Produits : rouge à lèvres, fond de teint, mascara, fard, soins.
-   Ongles : couleurs et styles de manucure.
-   Looks : naturel, soirée, glamour, artistique.

### Styles visuels

1.  **Naturel / nude** : rendu discret.
2.  **Glamour** : maquillage marqué et éclairage studio.
3.  **Soirée** : contraste et couleurs soutenues.
4.  **Éditorial** : rendu artistique de magazine.
5.  **Minimal clean** : peau et maquillage d'apparence légère.
6.  **Couleurs créatives** : associations de couleurs et effets
    artistiques.
7.  **Studio produit** : packshot cosmétique, fond propre et lumière
    contrôlée.

### Paramètres

-   Zone : lèvres, yeux, visage complet ou ongles.
-   Intensité : légère, moyenne ou prononcée.
-   Palette : tons chauds, froids, neutres ou couleurs personnalisées.
-   Finition : mate, satinée ou brillante.
-   Éclairage et arrière-plan.

### Précautions

-   Présenter les résultats comme des simulations visuelles, pas comme
    un diagnostic ni une recommandation médicale.
-   Ne pas déduire une maladie ou un état de santé depuis une photo.
-   Ne pas modifier l'identité d'une personne sans demande explicite.
-   Obtenir le consentement de la personne photographiée.

## 4.3 Catégorie TECH

### Objectif

Mettre en scène des appareils et accessoires technologiques dans des
visuels de présentation ou de marketing.

### Sous-catégories

-   Smartphones et tablettes.
-   Ordinateurs et périphériques.
-   Écouteurs et casques.
-   Montres et objets connectés.
-   Accessoires et équipements.

### Styles visuels

1.  **Packshot blanc** : fond blanc, produit centré, ombre légère.
2.  **Studio premium** : fond sombre, éclairage de contour.
3.  **Futuriste / néon** : ambiance technologique, lumières colorées.
4.  **Minimaliste** : composition épurée.
5.  **Lifestyle bureau** : produit dans un espace de travail.
6.  **Gaming** : ambiance gaming et éclairage dynamique.
7.  **Outdoor** : produit dans un environnement extérieur.
8.  **Publicité commerciale** : composition avec espace prévu pour un
    slogan ajouté séparément.

### Paramètres

-   Type de décor.
-   Couleur de fond.
-   Angle : face, trois-quarts, profil, vue du dessus.
-   Éclairage : doux, contrasté, néon.
-   Composition : seul, en situation ou avec accessoires.
-   Format : carré, portrait ou paysage.

### Règles de fidélité

-   Préserver autant que possible la forme, les ports, boutons, logos et
    détails visibles.
-   Ne pas inventer de caractéristiques, performances, prix ou
    compatibilités.
-   Les textes promotionnels doivent être ajoutés dans une étape de mise
    en page distincte afin d'éviter les textes erronés générés dans
    l'image.

## 4.4 Catégorie COIFFURE

### Objectif

Permettre de prévisualiser des coiffures et couleurs de cheveux sur un
portrait avec le consentement de la personne.

### Sous-catégories

-   Coupes courtes, mi-longues et longues.
-   Tresses, locks, twists et styles protecteurs.
-   Perruques et extensions.
-   Coiffures naturelles, bouclées, lisses et crépues.
-   Colorations et mèches.

### Styles visuels

1.  **Classique** : coiffure quotidienne.
2.  **Tendance** : look contemporain.
3.  **Élégant** : coiffure de cérémonie.
4.  **Afro / naturel** : textures et styles naturels variés.
5.  **Tresses** : variantes de tresses et nattes.
6.  **Locks** : différentes longueurs et formes.
7.  **Coloration** : couleurs naturelles ou créatives.
8.  **Salon professionnel** : rendu de catalogue coiffure.

### Paramètres

-   Type de coupe ou coiffure.
-   Longueur.
-   Texture.
-   Couleur.
-   Volume.
-   Raie et forme générale.
-   Intensité du changement.

### Précautions

-   Ne pas promettre une correspondance parfaite avec le résultat réel
    d'un salon.
-   Préserver autant que possible le visage et les caractéristiques de
    la personne.
-   Indiquer que la prévisualisation est indicative.

## 4.5 Catégorie ALIMENTAIRE

### Objectif

Créer des visuels culinaires ou commerciaux à partir d'une photo de
plat, d'ingrédient ou d'emballage.

### Sous-catégories

-   Plats préparés.
-   Fruits et légumes.
-   Boissons.
-   Pâtisseries et desserts.
-   Produits emballés.
-   Menus et visuels de restaurant.

### Styles visuels

1.  **Restaurant premium** : dressage raffiné et lumière maîtrisée.
2.  **Street food** : ambiance conviviale et urbaine.
3.  **Maison / authentique** : présentation chaleureuse.
4.  **Healthy / frais** : composition lumineuse et ingrédients visibles.
5.  **Publicité produit** : produit mis en avant.
6.  **Rustique** : matières naturelles et décor artisanal.
7.  **Minimaliste** : fond simple et plat central.
8.  **Menu restaurant** : visuel vertical ou carré prêt à intégrer dans
    un menu.

### Paramètres

-   Type de repas ou produit.
-   Décor : table, cuisine, restaurant, extérieur, studio.
-   Angle : dessus, face, trois-quarts, gros plan.
-   Éclairage : naturel, studio, chaleureux.
-   Style de dressage.
-   Format de sortie.

### Précautions

-   Ne pas inventer d'ingrédients, allergènes, valeurs nutritionnelles
    ou allégations de santé.
-   Les informations alimentaires doivent provenir de données saisies ou
    vérifiées, et non être déduites de l'image.
-   Signaler qu'une image générée peut ne pas représenter exactement le
    produit servi.

## 5. Exigences fonctionnelles

  ------------------------------------------------------------------------
  ID                Fonction           Priorité          Critère
                                                         d'acceptation
  ----------------- ------------------ ----------------- -----------------
  FR-001            Inscription et     P0                Un utilisateur
                    connexion                            peut créer un
                                                         compte et ouvrir
                                                         une session.

  FR-002            Catalogue          P0                Les cinq
                    catégories                           catégories sont
                                                         visibles et
                                                         accessibles.

  FR-003            Intake média       P0                Sources : caméra
                                                         photo, caméra
                                                         vidéo (≤ 60 s),
                                                         galerie et
                                                         fichiers.
                                                         Prévisualisation
                                                         avant envoi.
                                                         Refus de
                                                         permission géré
                                                         clairement.

  FR-003b           Pipeline upload    P0                Toutes les
                    unifié                               sources utilisent
                                                         le même
                                                         `POST /api/upload`
                                                         (max 12 médias,
                                                         poster vidéo
                                                         serveur
                                                         inchangé).

  FR-004            Prévisualisation   P0                L'image importée
                                                         et les paramètres
                                                         sont visibles
                                                         avant envoi.

  FR-005            Filtres par        P0                Les options
                    catégorie                            affichées
                                                         correspondent à
                                                         la catégorie
                                                         sélectionnée.

  FR-006            Génération IA Mode P0                Une demande
                                                         valide peut
                                                         produire un
                                                         résultat ou une
                                                         erreur explicite.

  FR-007            Génération autres  P1                Les parcours
                    catégories                           Beauté, Tech,
                                                         Coiffure et
                                                         Alimentaire sont
                                                         disponibles selon
                                                         les capacités IA.

  FR-008            Historique         P0                L'utilisateur
                                                         retrouve ses
                                                         générations.

  FR-009            Téléchargement et  P0                Le résultat peut
                    partage                              être enregistré
                                                         ou partagé.

  FR-010            Suppression        P0                L'utilisateur
                                                         peut supprimer
                                                         une création et
                                                         demander la
                                                         suppression des
                                                         fichiers
                                                         associés.

  FR-011            Crédits et quotas  P1                Le système
                                                         contrôle les
                                                         limites et
                                                         affiche le coût
                                                         avant génération.

  FR-012            Administration     P1                Un administrateur
                                                         gère catégories,
                                                         styles et
                                                         paramètres
                                                         autorisés.

  FR-013            Génération vidéo   P2                Fonction ajoutée
                                                         après validation
                                                         du parcours
                                                         image.

  FR-014            Comparaison        P1                L'utilisateur
                    avant/après                          peut comparer
                                                         l'image source et
                                                         le rendu.
  ------------------------------------------------------------------------

**Priorités :** P0 = indispensable au MVP ; P1 = version suivante ; P2 =
évolution ultérieure.

## 6. Écrans à concevoir

### Application mobile

1.  Splash screen et onboarding.
2.  Inscription / connexion.
3.  Accueil et catégories.
4.  Catalogue de styles.
5.  Importation de photo.
6.  Configuration du filtre.
7.  Confirmation de génération.
8.  Progression de génération.
9.  Résultat et actions.
10. Galerie et détail d'une création.
11. Profil, paramètres et confidentialité.
12. Crédits, limites et aide.

### Application web

-   Pages publiques de présentation.
-   Authentification.
-   Studio de création responsive.
-   Galerie personnelle.
-   Détail des créations.
-   Profil et paramètres.
-   Tableau de bord administrateur séparé et protégé.

## 7. Exigences non fonctionnelles et qualité

-   **Performance :** chargement progressif des images, pagination et
    redimensionnement des médias.
-   **Fiabilité :** génération asynchrone, reprise d'affichage du statut
    et gestion des échecs.
-   **Sécurité :** validation des fichiers, contrôle d'accès côté
    serveur, limitation de débit et secrets uniquement côté serveur.
-   **Confidentialité :** consentement, politique de conservation,
    suppression et contrôle d'accès aux images.
-   **Accessibilité :** contrastes, libellés, tailles tactiles et
    compatibilité avec les lecteurs d'écran.
-   **Compatibilité :** versions Android et iOS définies au lancement,
    navigateurs modernes.
-   **Évolutivité :** fournisseur IA abstrait derrière une interface
    interne.
-   **Observabilité :** journaux techniques sans exposer les images
    privées ni les données sensibles.
-   **Coûts :** suivi du coût par génération, quotas, limites et
    alertes.

## 8. Mesures de succès (KPI)

-   Taux d'inscription terminée.
-   Taux d'importation réussie.
-   Taux de génération terminée.
-   Temps médian et 95e percentile de génération.
-   Taux de génération relancée après échec.
-   Taux de sauvegarde et de partage.
-   Utilisateurs actifs quotidiens et mensuels.
-   Coût IA moyen par création réussie.
-   Taux de signalement de résultats inappropriés.
-   Satisfaction utilisateur après génération.

Les objectifs chiffrés seront définis après les tests du prototype et
les premiers essais avec de vrais utilisateurs.

------------------------------------------------------------------------

# PARTIE B --- TDR (Termes de Référence)

## 9. Objet de la mission

Concevoir, développer, tester et mettre en production la plateforme
CREATE AI, composée d'une application mobile React Native, d'une
application web Next.js, d'une API sécurisée, d'une base de données et
d'une intégration avec un ou plusieurs fournisseurs de génération IA.

## 10. Résultats attendus

1.  Un dossier de conception UX/UI et un prototype validé.
2.  Un dépôt de code structuré et documenté.
3.  Une application mobile Android et iOS.
4.  Une application web responsive.
5.  Une API documentée.
6.  Une base de données et des migrations.
7.  Un parcours Mode IA fonctionnel.
8.  Des parcours initiaux pour les quatre autres catégories.
9.  Un tableau de bord d'administration.
10. Une suite de tests automatisés.
11. Une documentation de déploiement, d'exploitation et de maintenance.

## 11. Architecture technique cible

### 11.1 Vue d'ensemble

``` text
                    UTILISATEURS
                         |
             +-----------+-----------+
             |                       |
       React Native               Next.js
        Expo mobile              Web / Admin
             |                       |
             +-----------+-----------+
                         |
                  API HTTPS sécurisée
                  Next.js Route Handlers
                         |
       +-----------------+------------------+
       |                 |                  |
  Authentification   Service métier    Service médias
       |                 |                  |
       +-----------------+------------------+
                         |
                 File de tâches / Queue
                         |
                 Worker de génération
                         |
                 Adaptateur fournisseur IA
                         |
                 API IA externe
                         |
                Stockage des résultats
                         |
                    PostgreSQL
```

### 11.2 Applications

**Mobile --- React Native + Expo** - TypeScript. - Expo Router pour la
navigation. - Expo Image Picker pour galerie **et** capture caméra
(photo et vidéo ≤ 60 s) à l'ajout d'article. - Expo Document Picker
pour l'import fichiers. - Expo Camera réservé aux parcours live / AR /
scan (pas le publish produit). - TanStack Query pour les appels et le
cache serveur. - React Hook Form et Zod pour les formulaires et
validations. - NativeWind ou StyleSheet avec tokens de design. -
SecureStore pour les jetons sensibles lorsque nécessaire.

**Web --- Next.js** - App Router. - TypeScript. - Tailwind CSS. -
shadcn/ui pour les composants web. - Route Handlers pour les endpoints
API. - Intake média web : import fichiers + capture
capture environment (photo / vidéo) lorsque le navigateur le permet. - Contrôle d'accès serveur pour les pages privées et
l'administration.

**Monorepo** - pnpm workspaces et Turborepo, ou une organisation
équivalente. - Packages partagés pour les types, validations,
configuration et tokens de design. - Ne pas partager directement les
composants natifs avec les composants web si leurs comportements
diffèrent.

### 11.3 Données et infrastructure

-   PostgreSQL pour les comptes, métadonnées, générations et paramètres.
-   Prisma pour le schéma et les migrations.
-   Stockage objet privé compatible S3 ou service équivalent pour les
    images.
-   CDN ou URLs signées pour la livraison contrôlée des médias.
-   Queue et worker pour les tâches longues de génération.
-   Redis peut être ajouté pour la queue, le cache et les limites de
    débit.
-   Hébergement Next.js sur une plateforme compatible.
-   Build et distribution mobile via EAS Build / EAS Submit, selon les
    comptes et environnements.

Le choix final des fournisseurs doit être confirmé après un test de
coût, de disponibilité, de confidentialité et de qualité.

## 12. Modules backend

1.  **AuthService** : inscription, connexion, sessions, rôles.
2.  **UserService** : profil, préférences, suppression de compte.
3.  **CategoryService** : catégories, sous-catégories et styles
    disponibles.
4.  **MediaService** : import, validation, stockage, URL signée et
    suppression.
5.  **GenerationService** : création, statut, relance et résultat.
6.  **AIProviderAdapter** : connecteur interchangeable vers le
    fournisseur IA.
7.  **ModerationService** : contrôle des demandes et résultats.
8.  **GalleryService** : historique, favoris et partage.
9.  **CreditService** : quotas, consommation et journal des opérations.
10. **AdminService** : gestion des paramètres et supervision.
11. **NotificationService** : notifications de fin de génération, si
    activées.

## 13. Modèle de données initial

Entités principales à prévoir :

-   `User` : identité, email, rôle, date de création.
-   `UserPreference` : préférences de langue et d'interface.
-   `Category` : Mode, Beauté, Tech, Coiffure, Alimentaire.
-   `StylePreset` : nom, catégorie, paramètres disponibles et statut.
-   `MediaAsset` : propriétaire, chemin de stockage, type MIME, taille
    et statut.
-   `Generation` : utilisateur, catégorie, style, paramètres, statut,
    fournisseur et dates.
-   `GenerationOutput` : génération, fichier résultat, dimensions et
    métadonnées.
-   `Favorite` : utilisateur et création ou style favori.
-   `CreditLedger` : mouvements de crédits et référence de génération.
-   `ModerationEvent` : type de contrôle, décision et date.
-   `AuditLog` : actions administratives importantes.

Les images binaires ne doivent pas être stockées directement dans
PostgreSQL : la base conserve les métadonnées et les références vers le
stockage objet.

## 14. API indicative

  Méthode   Route                               Rôle
  --------- ----------------------------------- ---------------------------------
  POST      `/api/v1/auth/register`             Créer un compte
  POST      `/api/v1/auth/login`                Ouvrir une session
  GET       `/api/v1/categories`                Lister les catégories
  GET       `/api/v1/categories/:slug/styles`   Lister les styles
  POST      `/api/v1/media/upload-url`          Obtenir une URL d'envoi signée
  POST      `/api/v1/generations`               Créer une demande de génération
  GET       `/api/v1/generations/:id`           Consulter son statut
  GET       `/api/v1/generations`               Lister son historique
  DELETE    `/api/v1/generations/:id`           Supprimer une création
  POST      `/api/v1/generations/:id/retry`     Relancer une génération
  GET       `/api/v1/me`                        Consulter son profil
  GET       `/api/v1/credits`                   Consulter son solde

Toutes les routes privées doivent vérifier l'identité, les droits, la
propriété de la ressource et les limites d'utilisation. Les routes
administrateur doivent vérifier un rôle dédié.

### Exemple de demande de génération

``` json
{
  "category": "fashion",
  "stylePreset": "urban-streetwear",
  "sourceMediaId": "media_123",
  "parameters": {
    "modelPresentation": "masculine",
    "ageRange": "young-adult",
    "skinTone": "deep",
    "bodyType": "average",
    "pose": "standing",
    "background": "urban"
  },
  "output": {
    "type": "image",
    "aspectRatio": "3:4"
  }
}
```

Les valeurs ci-dessus sont illustratives. Les paramètres acceptés
doivent être validés côté serveur selon la catégorie et les capacités du
fournisseur IA.

### Cycle de vie d'une génération

``` text
DRAFT
  |
  v
VALIDATING
  |
  v
QUEUED
  |
  v
PROCESSING
  |
  +------> SUCCEEDED
  |
  +------> FAILED
  |
  +------> MODERATION_REVIEW
  |
  +------> CANCELLED
```

Prévoir des identifiants de requête, une clé d'idempotence, des délais
d'expiration, un nombre maximal de tentatives et une gestion des tâches
abandonnées. Ne jamais facturer deux fois une même demande à cause d'une
répétition réseau.

## 15. Intégration IA

### 15.1 Principe

Le frontend ne doit jamais appeler directement une clé secrète de
fournisseur IA. Le serveur crée la demande, vérifie les droits et les
quotas, prépare les médias, appelle le fournisseur et enregistre le
résultat.

### 15.2 Interface interne

Définir une interface indépendante du fournisseur, par exemple :

``` ts
type GenerationInput = {
  category: string;
  sourceImageUrl: string;
  prompt: string;
  parameters: Record<string, unknown>;
  outputFormat: "png" | "jpeg";
};

type GenerationResult = {
  providerJobId?: string;
  outputUrl?: string;
  status: "queued" | "processing" | "succeeded" | "failed";
};

interface AIProvider {
  generate(input: GenerationInput): Promise<GenerationResult>;
  getStatus?(jobId: string): Promise<GenerationResult>;
}
```

### 15.3 Sélection du fournisseur

Avant le choix définitif, réaliser un benchmark sur des images tests
autorisées et anonymisées. Évaluer : - fidélité au produit source ; -
qualité et réalisme des personnes ; - gestion des différentes teintes de
peau et morphologies ; - qualité des cheveux, matières, logos et détails
; - latence ; - coût par génération ; - droits d'utilisation commerciale
; - politique de conservation des images ; - localisation et conditions
de traitement des données ; - stabilité et limites de débit.

### 15.4 Prompts et paramètres

-   Construire les prompts côté serveur à partir de modèles contrôlés.
-   Séparer les instructions de catégorie, le style et les paramètres
    utilisateur.
-   Éviter d'inclure des informations personnelles inutiles.
-   Versionner les modèles de prompts.
-   Enregistrer la version du prompt et du fournisseur pour faciliter le
    diagnostic.
-   Ne pas présenter un rendu généré comme une photographie fidèle
    garantie du produit.

## 16. Sécurité, confidentialité et modération

-   HTTPS partout.
-   Secrets et clés IA dans un gestionnaire de secrets.
-   Validation du type MIME, de la taille et du contenu des fichiers.
-   Protection contre les fichiers malveillants et les extensions
    trompeuses.
-   URLs de stockage privées et signées avec expiration.
-   Contrôle d'accès par propriétaire pour chaque média et génération.
-   Limitation de débit et protection contre les abus.
-   Journalisation sans conserver inutilement les prompts privés ou les
    images.
-   Politique de conservation et suppression documentée.
-   Consentement explicite pour l'utilisation d'une photo représentant
    une personne.
-   Parcours renforcé pour les images de mineurs : ne pas permettre les
    usages sexualisés, trompeurs ou préjudiciables ; appliquer des
    contrôles adaptés.
-   Interdire les transformations non consenties destinées à humilier,
    sexualiser ou tromper.
-   Mécanisme de signalement et procédure de traitement des abus.
-   Politique de confidentialité, conditions d'utilisation et règles de
    contenu avant lancement.

## 17. Direction artistique et design system

### 17.1 Identité visuelle recommandée

-   Nom : CREATE AI.
-   Ambiance : studio créatif premium, moderne et accessible.
-   Thème principal : sombre.
-   Couleur de fond : noir profond.
-   Couleur d'accent : violet lumineux.
-   Surfaces : gris anthracite.
-   Texte : blanc cassé et gris secondaire.
-   Cartes : coins arrondis, images dominantes, ombres discrètes.
-   Animations : transitions courtes et indicateurs de progression.

### 17.2 Tokens de design indicatifs

  Token               Valeur indicative
  ------------------- -------------------
  `background`        `#08080B`
  `surface`           `#17171D`
  `surfaceElevated`   `#22222B`
  `primary`           `#8B5CF6`
  `primaryLight`      `#A78BFA`
  `textPrimary`       `#F8FAFC`
  `textSecondary`     `#A1A1AA`
  `success`           `#22C55E`
  `error`             `#EF4444`
  `radiusCard`        `20px`
  `radiusButton`      `999px`

Ces valeurs sont une base à ajuster après le prototype et les tests de
contraste.

### 17.3 Composants communs

-   `CategoryCard`
-   `StyleCard`
-   `FilterChip`
-   `MediaIntake` (remplace `ImageUploader`) : trois actions ---
    caméra photo, caméra vidéo, import galerie/fichiers --- même
    pipeline d'upload
-   `ImagePreview`
-   `ModelSelector`
-   `ParameterSelector`
-   `GenerationProgress`
-   `GenerationResultCard`
-   `BeforeAfterCompare`
-   `CreditIndicator`
-   `EmptyState`
-   `ErrorState`

### 17.4 Présentation par catégorie

-   **Mode :** portraits et silhouettes en grand format, choix du
    modèle, pose et décor.
-   **Beauté :** portraits cadrés, zones du visage, palettes et
    intensité.
-   **Tech :** packshots, angles produit, arrière-plans et éclairages.
-   **Coiffure :** portraits, nuanciers, longueur, texture et coupe.
-   **Alimentaire :** photographie culinaire, dressage, angle, décor et
    lumière.

Ne pas utiliser un seul formulaire générique pour toutes les catégories.
Les contrôles doivent être adaptés au contenu.

## 18. Tests et critères de recette

### Tests fonctionnels

-   Création de compte, connexion et déconnexion.
-   Accès protégé aux ressources privées.
-   Importation d'images valides et rejet des fichiers invalides.
-   **Intake média publish :** photo caméra, vidéo caméra ≤ 60 s, et
    import fichiers/galerie sur Android, iOS et web mobile ; import
    fichiers seul sur desktop web.
-   Refus de permission caméra / micro : message compréhensible, pas de
    crash.
-   Plafond de 12 médias et même pipeline d'upload pour toutes les
    sources.
-   Sélection de chaque catégorie et de ses styles.
-   Génération réussie, échouée, relancée et annulée si supportée.
-   Historique, suppression, téléchargement et partage.
-   Vérification des crédits et de l'idempotence.

### Tests IA

-   Jeu de tests représentatif pour chaque catégorie.
-   Tests de fidélité des produits.
-   Tests de diversité des modèles et teintes de peau.
-   Contrôle des déformations, artefacts et textes incorrects.
-   Évaluation humaine des rendus.
-   Vérification des règles de modération.

### Tests techniques

-   Tests unitaires des règles métier.
-   Tests d'intégration API et base de données.
-   Tests end-to-end des parcours principaux.
-   Tests de charge sur les endpoints et la queue.
-   Tests de sécurité et contrôle des permissions.
-   Tests sur plusieurs tailles d'écran et appareils.

### Critères de recette MVP

-   Les cinq catégories sont consultables.
-   Le parcours Mode permet d'importer un vêtement, de choisir les
    paramètres et de demander une génération.
-   L'utilisateur ne peut consulter que ses propres médias et créations.
-   Les générations longues restent consultables après fermeture de
    l'application.
-   Les erreurs sont traçables et présentées clairement.
-   La suppression d'une création déclenche la suppression ou la mise en
    attente de suppression des fichiers associés conformément à la
    politique de conservation.
-   La documentation de déploiement et d'exploitation est livrée.

------------------------------------------------------------------------

# PARTIE C --- PLAN DE RÉALISATION

## 19. Phases du projet

Les durées sont indicatives et devront être confirmées après estimation
technique et disponibilité des intervenants.

  ------------------------------------------------------------------------
  Phase            Travaux               Durée indicative Livrable
  ---------------- ---------------- --------------------- ----------------
  0\. Cadrage      Besoins,                     1 semaine PRD/TDR validés
                   personas,                              
                   règles,                                
                   périmètre                              

  1\. UX/UI        Parcours,                1--2 semaines Prototype validé
                   wireframes,                            
                   design system,                         
                   prototype                              

  2\. Fondations   Monorepo, CI/CD,         1--2 semaines Socle technique
                   auth, DB,                              
                   stockage                               

  3\. Studio       Navigation,                 2 semaines Interfaces
  mobile/web       catégories,                            utilisables
                   import, galerie                        

  4\. IA Mode      Adaptateur IA,           2--3 semaines Mode IA MVP
                   queue,                                 
                   génération et                          
                   résultats                              

  5\. Autres       Beauté, Tech,            2--4 semaines Parcours par
  catégories       Coiffure,                              catégorie
                   Alimentaire                            

  6\. Admin et     Gestion styles,          1--2 semaines Administration
  quotas           suivi, crédits                         MVP
                   et modération                          

  7\. QA et        Tests,                   1--2 semaines Version
  lancement        corrections,                           candidate
                   sécurité,                              
                   publication                            
  ------------------------------------------------------------------------

Les phases peuvent se chevaucher. Une estimation ferme nécessite de
sélectionner le fournisseur IA et de tester ses capacités réelles.

## 20. Équipe et responsabilités

  -----------------------------------------------------------------------
  Rôle                                Responsabilités
  ----------------------------------- -----------------------------------
  Product Owner                       Priorités, validation métier et
                                      arbitrages

  UX/UI Designer                      Parcours, prototypes et design
                                      system

  Développeur React Native            Application mobile

  Développeur Next.js                 Web, API et administration

  Backend / IA Engineer               Queue, intégration IA, stockage et
                                      optimisation

  QA Engineer                         Tests et recette

  DevOps                              Déploiement, supervision et
                                      sécurité
  -----------------------------------------------------------------------

Une même personne peut couvrir plusieurs rôles dans une petite équipe, à
condition que les responsabilités soient clairement attribuées.

## 21. Livrables détaillés

-   PRD et TDR validés.
-   Cartographie des parcours utilisateurs.
-   Maquettes des écrans mobile et web.
-   Design system et bibliothèque de composants.
-   Dépôt Git et conventions de développement.
-   Schéma de base de données et migrations.
-   Spécification OpenAPI ou documentation équivalente.
-   Application mobile et web.
-   Module IA Mode et parcours des autres catégories.
-   Tableau de bord d'administration.
-   Plan et rapports de tests.
-   Guide d'installation et de déploiement.
-   Guide d'exploitation et de maintenance.
-   Politique de confidentialité et conditions d'utilisation à faire
    valider juridiquement.

## 22. Risques et mesures d'atténuation

  -----------------------------------------------------------------------
  Risque                              Mesure
  ----------------------------------- -----------------------------------
  Résultat IA peu fidèle au vêtement  Benchmark fournisseur, photos
                                      sources de qualité et comparaison
                                      avant/après

  Coût de génération élevé            Quotas, suivi du coût, tailles de
                                      sortie adaptées et cache lorsque
                                      pertinent

  Génération lente                    Queue asynchrone, statut persistant
                                      et notifications

  Fournisseur indisponible            Adaptateur indépendant et stratégie
                                      de reprise

  Fuite d'images privées              Stockage privé, URLs signées et
                                      contrôles d'accès

  Usage abusif d'images de personnes  Consentement, modération,
                                      signalement et règles d'usage

  Catégories trop différentes         Parcours et paramètres spécialisés
                                      par catégorie

  Qualité variable selon les profils  Jeux de tests diversifiés et
                                      évaluation régulière
  -----------------------------------------------------------------------

## 23. Décisions à valider avant le développement

1.  Nom définitif et identité de marque.
2.  Langues de lancement : français seul ou français et anglais.
3.  Public cible : grand public, vendeurs, marques ou combinaison.
4.  Pays de lancement et exigences légales applicables.
5.  Fournisseur IA et droits d'utilisation commerciale.
6.  Politique de crédits : gratuit, abonnement, paiement à la génération
    ou modèle hybride.
7.  Formats de sortie et résolutions.
8.  Durée de conservation des images.
9.  Règles concernant les photos de mineurs.
10. Fonctionnalités exactes du MVP et calendrier.

## 24. Recommandation de lancement

Ne pas lancer les cinq moteurs IA complexes simultanément. Construire
d'abord le socle commun et livrer un parcours Mode solide, car il valide
les éléments les plus structurants : importation, choix de paramètres,
traitement asynchrone, génération, stockage et galerie.

Ensuite, réutiliser ce socle pour les catégories Tech, Beauté, Coiffure
et Alimentaire, chacune avec ses propres paramètres, prompts, contrôles
de qualité et règles de modération.

**Ordre recommandé :** 1. Socle produit et design system. 2. Mode IA ---
MVP prioritaire. 3. Tech IA --- visuels produits. 4. Beauté IA ---
maquillage et présentation cosmétique. 5. Coiffure IA ---
prévisualisation capillaire. 6. Alimentaire IA --- photographie
culinaire. 7. Vidéo IA, fonctionnalités professionnelles et monétisation
avancée.

------------------------------------------------------------------------

## 25. Glossaire

-   **PRD :** Product Requirements Document, document qui décrit le
    produit, ses utilisateurs, ses fonctionnalités et ses critères de
    réussite.
-   **TDR :** Termes de Référence, document qui précise la mission, les
    travaux, les livrables, les responsabilités et les critères de
    recette.
-   **MVP :** Minimum Viable Product, première version apportant une
    valeur utilisable.
-   **IA :** Intelligence artificielle.
-   **Queue :** file d'attente de tâches longues.
-   **Worker :** processus qui exécute les tâches en arrière-plan.
-   **URL signée :** lien temporaire permettant un accès contrôlé à un
    fichier.
-   **Monorepo :** dépôt unique contenant plusieurs applications et
    packages partagés.

------------------------------------------------------------------------

**Fin du document --- CREATE AI PRD & TDR v1.1**
