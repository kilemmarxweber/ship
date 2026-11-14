# SHIPSHOP — PLAN COMPLET UX/UI, DESIGN SYSTEM ET TESTS

**Projet :** ShipShop Mobile  
**Technologies :** Expo, React Native, TypeScript  
**IDE :** Cursor  
**Objectif :** obtenir une interface premium fidèle à l'identité visuelle actuelle de ShipShop, avec un workflow professionnel de conception, développement et validation.

---

# 1. OBJECTIF DE LA MISSION

Améliorer progressivement l'application mobile ShipShop en prenant comme référence la maquette visuelle fournie.

Il ne s'agit pas de créer une nouvelle application ni de remplacer l'identité existante.

Il faut moderniser et harmoniser les écrans existants tout en préservant :

- les fonctionnalités métier ;
- les appels API ;
- les composants déjà fonctionnels ;
- la navigation ;
- les hooks et la gestion d'état ;
- les permissions ;
- les données réelles ;
- les règles de sécurité.

L'approche doit être progressive : audit, design system, refonte écran par écran, tests et validation.

# 2. IDENTITÉ VISUELLE SHIPSHOP

La capture fournie par le propriétaire constitue la référence visuelle principale.

## 2.1 Palette de couleurs

Valeurs approximatives extraites visuellement de la capture. Elles doivent être comparées aux couleurs réelles du projet avant validation.

| Élément            | Couleur   |
| ------------------ | --------- |
| Fond principal     | `#05080D` |
| Surface principale | `#111722` |
| Surface secondaire | `#1A2230` |
| Orange principal   | `#FF5A1F` |
| Turquoise du logo  | `#00D6A5` |
| Texte principal    | `#F5F7FA` |
| Texte secondaire   | `#AAB4C8` |
| Bordure            | `#273142` |

## 2.2 Utilisation des couleurs

- Noir bleuté : arrière-plan général.
- Anthracite : cartes, menus et surfaces.
- Orange : boutons principaux, onglets actifs et actions importantes.
- Turquoise : identité de marque et accents de confiance.
- Blanc : titres et textes principaux.
- Gris bleuté : descriptions et informations secondaires.
- Couleurs vives : catégories, campagnes et contenus thématiques.

Ne pas utiliser le turquoise et l'orange simultanément sur tous les composants. Respecter une hiérarchie visuelle.

## 2.3 Style graphique

- Interface sombre et premium.
- Cartes visuelles aux coins arrondis.
- Bordures discrètes.
- Ombres légères.
- Photos et vidéos mises en valeur.
- Icônes cohérentes.
- Animations rapides et utiles.
- Typographie lisible.
- Navigation simple.
- Espacements réguliers.

Ne pas surcharger les écrans.

# 3. NAVIGATION À PRÉSERVER

La navigation principale existante doit être conservée :

1. Accueil
2. Découvrir
3. Publier
4. Messages
5. Panier

Les onglets du fil d'accueil restent :

- Abonnements
- Pour toi
- Je cherche

Ne pas créer quatre nouveaux onglets pour IA Chat, Wanted, A/B Lift et Rétention.

Intégration prévue :

| Fonctionnalité  | Emplacement                |
| --------------- | -------------------------- |
| IA Chat         | Accueil et Messages        |
| Wanted          | Onglet Je cherche          |
| A/B Lift        | Back-office administrateur |
| Purge Rétention | Back-office administrateur |

# 4. SKILLS ET OUTILS À UTILISER

Avant d'ajouter un skill, vérifier s'il existe déjà dans le projet.

Ne pas créer de doublons et ne pas écraser les conventions existantes.

## 4.1 UX/UI Design

Responsabilités :

- architecture de l'information ;
- parcours acheteur et vendeur ;
- hiérarchie visuelle ;
- ergonomie mobile ;
- états de chargement ;
- états vides ;
- erreurs ;
- confirmations ;
- interactions.

## 4.2 Frontend Design

Responsabilités :

- conception des écrans ;
- composition visuelle ;
- responsive design ;
- cartes produits ;
- cartes vidéo ;
- formulaires ;
- navigation ;
- composants interactifs.

## 4.3 Design System

Responsabilités :

- tokens de couleurs ;
- typographies ;
- espacements ;
- rayons ;
- bordures ;
- boutons ;
- champs ;
- cartes ;
- badges ;
- modales ;
- composants de navigation.

## 4.4 Context7

Utiliser Context7 pour consulter la documentation correspondant aux versions réellement installées.

Priorités :

- Expo ;
- React Native ;
- React ;
- navigation installée ;
- bibliothèques d'icônes ;
- bibliothèques d'animation ;
- Safe Area ;
- images et médias ;
- outils de test.

Ne pas inventer d'API, de propriétés ou de méthodes.

Documentation : https://context7.com/

## 4.5 React Native / Expo

Respecter les bonnes pratiques :

- composants natifs ;
- Safe Area ;
- clavier ;
- navigation ;
- performances ;
- images optimisées ;
- gestion des petits écrans ;
- compatibilité Android et iOS.

## 4.6 Playwright

Utiliser Playwright pour :

- tests API HTTP ;
- tests de la version web si Expo Web est utilisé ;
- parcours navigateur ;
- captures d'écran web ;
- tests de régression visuelle.

Documentation : https://playwright.dev/

Important : Playwright ne pilote pas directement les vues natives Android et iOS.

Pour les tests mobiles natifs, examiner les outils existants avant de choisir :

- Maestro : https://maestro.mobile.dev/
- Detox : https://wix.github.io/Detox/

Ne pas installer plusieurs outils E2E sans justification.

Le projet mobile possède déjà `@playwright/test`. Vérifier sa configuration avant d'ajouter des dépendances.

# 5. PHASE 0 — AUDIT DU PROJET

Répertoire mobile :

`C:\Users\kilemmarxweber\Desktop\ShipShop`

Avant toute modification :

1. Lire `package.json`.
2. Identifier les versions Expo, React Native et React.
3. Examiner la structure des dossiers.
4. Identifier les écrans.
5. Identifier les composants partagés.
6. Examiner les fichiers de thème.
7. Identifier les bibliothèques d'icônes.
8. Identifier les bibliothèques d'animation.
9. Examiner les tests existants.
10. Vérifier les configurations Playwright.
11. Inventorier les skills Cursor déjà présents.
12. Examiner les conventions `.cursor`, `.claude`, `.agents` et `.windsurf`.
13. Identifier les styles dupliqués.
14. Repérer les couleurs codées en dur.
15. Vérifier les assets et logos officiels.

Utiliser Context7 pour les documentations des versions détectées.

### Livrable de la phase 0

Un rapport comprenant :

- architecture actuelle ;
- liste des écrans ;
- composants réutilisables ;
- dépendances ;
- skills existants ;
- problèmes UX/UI ;
- problèmes techniques ;
- risques de régression ;
- proposition de travail par lots.

**Ne modifier aucun fichier avant d'avoir présenté cet audit.**

# 6. PHASE 1 — DESIGN SYSTEM SHIPSHOP

Créer ou consolider le Design System en fonction de l'architecture existante.

## 6.1 Tokens

Définir :

- couleurs ;
- typographies ;
- espacements ;
- rayons ;
- bordures ;
- tailles d'icônes ;
- élévations ;
- dimensions tactiles.

Éviter de disperser les valeurs dans tous les écrans.

## 6.2 Composants communs

Créer ou réutiliser :

- bouton principal orange ;
- bouton secondaire ;
- bouton icône ;
- champ de recherche ;
- champ de formulaire ;
- carte produit ;
- carte vidéo ;
- carte boutique ;
- avatar ;
- badge ;
- barre d'onglets ;
- bottom navigation ;
- bottom sheet ;
- modale ;
- skeleton ;
- état vide ;
- état erreur ;
- état succès.

Chaque composant doit avoir une API cohérente et des états documentés.

## 6.3 Critères de validation

- Les composants utilisent les tokens communs.
- Les couleurs ne sont pas recopiées arbitrairement.
- Les boutons ont des états normal, pressé, désactivé et chargement.
- Les cartes restent cohérentes entre les écrans.
- Les composants sont accessibles.

# 7. PHASE 2 — REFONTE DES ÉCRANS MOBILES

Travailler écran par écran.

Ordre recommandé :

1. Navigation générale.
2. Accueil / Pour toi.
3. Découvrir.
4. Catégories.
5. Tendances.
6. Cartes vidéo.
7. Cartes produits.
8. Fiche produit.
9. Profil public.
10. Boutique.
11. Messages.
12. Panier.
13. Checkout.
14. Publier.
15. Je cherche / Wanted.
16. IA Chat.
17. Paramètres et sécurité.

Pour chaque écran :

1. Examiner l'écran actuel.
2. Identifier les composants existants.
3. Définir le parcours utilisateur.
4. Définir les états de l'écran.
5. Proposer la composition visuelle.
6. Vérifier les API et données utilisées.
7. Implémenter les changements.
8. Exécuter les tests.
9. Examiner les captures.
10. Corriger les différences.

Ne pas remplacer les données réelles par des données fictives.

# 8. PHASE 3 — WANTED

Wanted doit enrichir l'onglet « Je cherche ».

Le schéma Prisma possède déjà les modèles `WantedRequest` et `WantedOffer`. Examiner leur état réel avant d'ajouter des modèles ou des routes.

## Parcours acheteur

1. Ouvrir Je cherche.
2. Publier une demande.
3. Ajouter un titre.
4. Ajouter une description.
5. Choisir une catégorie.
6. Définir un budget.
7. Choisir l'état souhaité.
8. Ajouter une image facultative.
9. Définir une zone de livraison ou de retrait.
10. Publier.
11. Recevoir des offres.
12. Comparer les offres.
13. Ouvrir une conversation.
14. Conclure ou fermer la demande.

## Parcours vendeur

1. Consulter les demandes.
2. Filtrer les demandes.
3. Ouvrir une demande.
4. Envoyer une offre.
5. Associer un produit existant si possible.
6. Définir prix et disponibilité.
7. Discuter avec l'acheteur.
8. Retirer ou mettre à jour son offre.

## Sécurité

- Seul l'auteur peut modifier sa demande.
- Chaque vendeur ne modifie que ses propres offres.
- Vérifier les permissions côté backend.
- Vérifier l'expiration des demandes.
- Empêcher les offres non autorisées.
- Protéger les conversations.
- Éviter les fuites de coordonnées personnelles.
- Limiter le spam.

# 9. PHASE 4 — IA CHAT

L'assistant doit être accessible depuis Accueil et Messages.

## Fonctionnalités

- Recherche guidée.
- Recommandations issues du catalogue réel.
- Comparaison de produits.
- Aide à la rédaction pour les vendeurs.
- FAQ.
- Aide sur les commandes.
- Orientation vers le support humain.

## UX

- Interface de chat sombre.
- Bulles de conversation lisibles.
- Suggestions de questions.
- Cartes produits avec photos et prix réels.
- Indicateur de génération.
- Possibilité d'arrêter une génération.
- Gestion des erreurs.
- Transfert vers le support.

## Sécurité IA

- Vérifier les autorisations avant toute lecture de données privées.
- Ne jamais exposer les jetons ou secrets au modèle.
- Ne pas inventer les prix, stocks ou disponibilités.
- Ne pas effectuer une action financière sans confirmation explicite.
- Ne pas annuler ou rembourser une commande automatiquement.
- Prévoir des quotas et limites de coûts.
- Protéger contre les injections de prompt.
- Minimiser les données personnelles envoyées au fournisseur IA.

# 10. PHASE 5 — A/B LIFT

A/B Lift est un outil d'administration, pas un onglet client.

## Fonctionnalités

- Créer une expérience.
- Définir une hypothèse.
- Définir les variantes A et B.
- Définir une métrique principale.
- Définir des métriques de garde-fou.
- Répartir les utilisateurs de manière stable.
- Collecter les événements.
- Comparer les résultats.
- Arrêter une expérience.
- Consulter l'historique.

## Exemples

- Comparer deux boutons.
- Comparer deux présentations de cartes.
- Comparer deux parcours Wanted.
- Comparer deux dispositions de l'accueil.

## Métriques

- clics ;
- ajouts au panier ;
- checkout terminé ;
- achats ;
- demandes Wanted ;
- offres vendeurs ;
- rétention.

Ne pas déclarer un gagnant avec trop peu de données.

Définir la taille d'échantillon, la durée et les métriques avant le lancement.

# 11. PHASE 6 — PURGE ET RÉTENTION AUTOMATIQUE

Créer une politique de conservation par catégorie de données.

## Données à inventorier

- logs techniques ;
- événements de sécurité ;
- notifications temporaires ;
- sessions expirées ;
- fichiers temporaires ;
- uploads abandonnés ;
- conversations ;
- commandes ;
- paiements ;
- remboursements ;
- données analytiques ;
- demandes Wanted expirées.

## Règles

- Définir une durée de conservation.
- Distinguer suppression, archivage et anonymisation.
- Respecter les obligations légales.
- Prévoir les litiges et enquêtes de fraude.
- Ne pas supprimer les preuves de paiement.
- Ne pas supprimer les données comptables requises.
- Exécuter les purges par lots.
- Journaliser les opérations.
- Prévoir reprise sur erreur.
- Tester en mode simulation avant toute suppression.

## Back-office

Afficher :

- catégories de données ;
- durée de conservation ;
- éléments éligibles ;
- prochaine exécution ;
- mode simulation ;
- historique ;
- erreurs ;
- statut des opérations.

Commencer par les fichiers temporaires, logs expirés et sessions expirées.

# 12. PHASE 7 — TESTS ET VALIDATION

## Playwright

Tester :

- API HTTP ;
- parcours web compatibles ;
- recherche ;
- navigation ;
- fiches produits ;
- panier ;
- Wanted ;
- conversations ;
- captures d'écran ;
- régressions visuelles.

## Tests natifs

Après audit, utiliser Maestro ou Detox pour les parcours Android et iOS.

Tester :

- petits écrans ;
- grands écrans ;
- Safe Area ;
- clavier ouvert ;
- navigation retour ;
- réseau lent ;
- chargement des images ;
- interactions tactiles ;
- taille de texte ;
- accessibilité.

## Revue visuelle

Pour chaque écran :

- comparer la capture avec la référence ;
- vérifier la palette ;
- vérifier les espacements ;
- vérifier la hiérarchie ;
- vérifier les dimensions ;
- vérifier les états ;
- vérifier les interactions.

Ne pas accepter un écran uniquement parce que le test fonctionnel passe.

# 13. CRITÈRES DE QUALITÉ

Chaque écran doit respecter :

- identité visuelle ShipShop ;
- navigation cohérente ;
- action principale identifiable ;
- texte non tronqué ;
- composants réutilisables ;
- états vides et erreurs ;
- données réelles ;
- permissions conservées ;
- performances correctes ;
- accessibilité ;
- absence de régression.

# 14. WORKFLOW OBLIGATOIRE DANS CURSOR

Utiliser les compétences dans cet ordre :

1. Audit du projet.
2. Context7 pour la documentation.
3. UX/UI Design pour le parcours.
4. Frontend Design pour la composition visuelle.
5. Design System pour les composants.
6. React Native / Expo pour l'implémentation.
7. Playwright pour les tests compatibles.
8. Maestro ou Detox pour les tests natifs si nécessaire.
9. Visual Review pour les captures.
10. Code Review pour les régressions.

Travailler par petits lots.

Ne pas lancer une refonte complète en une seule tâche.

Chaque lot doit être testable et réversible.

# 15. PROMPT PRINCIPAL POUR CURSOR

Tu es un ingénieur frontend senior spécialisé en UX/UI mobile, React Native et Expo.

Tu travailles sur le projet ShipShop existant.

La capture fournie par le propriétaire est la référence visuelle principale.

Ton objectif est de moderniser l'application tout en conservant son identité :

- fond noir bleuté ;
- surfaces anthracite ;
- orange vif ;
- turquoise de marque ;
- catégories colorées ;
- cartes visuelles ;
- navigation existante.

Tu dois respecter les règles suivantes :

1. Auditer le projet avant de modifier les fichiers.
2. Examiner les versions exactes des dépendances.
3. Vérifier les skills et conventions déjà présents.
4. Utiliser Context7 pour la documentation.
5. Ne pas inventer d'API ou de dépendance.
6. Ne pas écraser les configurations existantes.
7. Ne pas créer de doublons de composants.
8. Préserver les appels API et la logique métier.
9. Préserver les permissions et la sécurité.
10. Ne pas remplacer les données réelles par des données fictives.
11. Utiliser Playwright pour les tests web et API compatibles.
12. Ne pas prétendre que Playwright pilote les vues natives.
13. Prévoir des tests natifs adaptés si nécessaire.
14. Travailler écran par écran.
15. Examiner les captures avant validation.

Pour chaque lot, présenter :

- objectif ;
- fichiers concernés ;
- composants réutilisés ;
- composants créés ;
- changements UX ;
- risques ;
- tests exécutés ;
- résultats ;
- problèmes restants.

Commence par l'audit uniquement.

Ne modifie aucun fichier avant d'avoir présenté les constats et le premier lot proposé.

# 16. PREMIÈRE TÂCHE À EXÉCUTER

Commence par :

**LOT 0 — AUDIT UX/UI SHIPSHOP**

Livrer :

1. Architecture du projet.
2. Liste des écrans.
3. Liste des composants.
4. Liste des thèmes et styles.
5. Dépendances UI installées.
6. Skills existants.
7. Configuration Playwright.
8. Bibliothèques de navigation.
9. Problèmes UX/UI observés.
10. Proposition de Design System.
11. Plan de refonte par écran.
12. Liste des tests nécessaires.

Aucune modification du code pendant ce premier lot.

# 17. STRATÉGIE FINALE

Ordre de réalisation :

1. Audit.
2. Design System.
3. Accueil / Pour toi.
4. Découvrir.
5. Cartes vidéo et produits.
6. Fiche produit.
7. Profil et boutique.
8. Messages.
9. Panier et checkout.
10. Publier.
11. Wanted.
12. IA Chat.
13. A/B Lift.
14. Rétention automatique.
15. Tests complets et validation.

**Objectif final :** obtenir une application ShipShop cohérente, premium, rapide, accessible et fidèle à son identité visuelle, sans régression fonctionnelle ou de sécurité.

---

## 18. STATUT D’EXÉCUTION (13 nov. 2026)

Pages manquantes livrées **sans** modifier la tab bar ni le ranking Pour toi :

| Lot                            | Statut       | Emplacement                                                                                |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------ |
| Wanted / Je cherche (maquette) | Fait         | `WantedHomePane` dans onglet Accueil « Je cherche »                                        |
| IA Chat                        | Fait         | `app/ai-chat.tsx` + `/api/ai/chat` (catalogue réel) ; entrée Accueil (sparkles) + Messages |
| A/B Lift + Rétention           | Fait (admin) | `/shops/admin/analytics` + `/api/admin/analytics` (purge = simulation)                     |

### Phase 2 mobile Wanted

La refonte mobile couvre l’accueil « Je cherche », la publication guidée en
trois étapes, le détail avec galerie, le tri des offres, la conversation et
l’acceptation via checkout.

Blocages backend hors de ce dépôt Expo : création, modification et retrait
d’une offre vendeur, clôture/expiration d’une demande, permissions serveur,
redaction des coordonnées et limitation du spam. Ces fonctions nécessitent le
dépôt backend `shop` et ne sont pas simulées dans le client.

Hors scope immédiat : LLM externe, purge destructive réelle, instrumentation A/B utilisateur.
