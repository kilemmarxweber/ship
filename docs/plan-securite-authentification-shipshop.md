# Plan de sécurité — Authentification ShipShop

**Chantier :** protection contre les attaques par force brute et sécurisation des connexions  
**Périmètre :** backend Next.js, Better Auth, PostgreSQL et notifications ShipShop  
**Statut :** implémenté (backend `shop`) — rate-limit Better Auth DB + `LoginSecurity` PostgreSQL + alertes e-mail/notice ; tests `npm run test:unit`

## 1. Objectifs

- Ralentir les tentatives répétées de mots de passe incorrects.
- Protéger les comptes sans permettre à un tiers de les verrouiller définitivement.
- Détecter les attaques visant plusieurs comptes ou provenant d'une même source.
- Informer le propriétaire lorsqu'une activité de connexion est suspecte.
- Conserver des mécanismes de récupération accessibles et sûrs.
- Éviter toute fuite d'information permettant de deviner si un compte existe.

## 2. Politique de limitation recommandée

Valeurs initiales proposées, à ajuster après tests de charge et de faux positifs :

| Situation                                   | Mesure                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1 à 4 mots de passe incorrects              | Enregistrer les échecs et afficher un message générique                               |
| 5 échecs consécutifs sur un compte          | Refuser temporairement les connexions par mot de passe pendant 15 minutes             |
| Nouveaux épisodes d'échecs après expiration | Appliquer une temporisation progressive, par exemple 30 puis 60 minutes, avec plafond |
| Tentatives pendant une période de blocage   | Refuser sans prolonger le délai à chaque requête                                      |
| Trop de tentatives depuis une même IP       | Appliquer une limitation IP distincte                                                 |
| Une IP vise plusieurs comptes               | Déclencher une limitation renforcée et une surveillance                               |
| Connexion réussie après activité suspecte   | Réinitialiser les compteurs appropriés et envoyer une alerte si nécessaire            |

**Règle essentielle :** ne jamais verrouiller définitivement un compte après cinq erreurs. Un attaquant pourrait provoquer un déni de service contre la victime en soumettant volontairement de mauvais mots de passe.

La limitation doit combiner plusieurs dimensions : compte, IP et, avec prudence, signaux d'appareil. Une IP partagée (réseau mobile, entreprise, Wi-Fi public) ne doit pas entraîner automatiquement le blocage de tous ses utilisateurs.

## 3. Détection et limitation des attaques

### 3.1 Limitation par compte

- Utiliser un identifiant de compte normalisé ou une empreinte protégée de l'identifiant soumis.
- Compter les échecs consécutifs de manière atomique.
- Appliquer une durée de blocage calculée côté serveur.
- Ne pas révéler si l'adresse e-mail ou le numéro de téléphone existe.
- Réinitialiser le compteur après une authentification réussie.
- Prévoir une expiration automatique des compteurs anciens.

### 3.2 Limitation par IP

- Compter les échecs par adresse IP sur une fenêtre de temps.
- Détecter les tentatives visant plusieurs comptes depuis la même IP.
- Utiliser une limitation distincte de celle du compte.
- Ne faire confiance aux en-têtes proxy (`X-Forwarded-For`, etc.) que si le proxy est connu et configuré explicitement.
- Éviter les blocages globaux trop agressifs sur les IP partagées.

### 3.3 Signaux de risque

Selon les données réellement disponibles, surveiller :

- une hausse soudaine des échecs ;
- plusieurs comptes ciblés par une même source ;
- une connexion réussie après une série d'échecs ;
- un changement inhabituel d'appareil ou de localisation approximative.

Ces signaux ne doivent pas, à eux seuls, provoquer une suspension permanente.

## 4. Notifications de sécurité

Lorsqu'un seuil significatif est atteint, envoyer une notification à l'adresse e-mail vérifiée du compte. Une notification dans l'application peut aussi être ajoutée si le système le permet.

### Exemple de notification

**Objet : Alerte de sécurité — tentative de connexion à votre compte ShipShop**

Nous avons détecté plusieurs tentatives de connexion avec un mot de passe incorrect sur votre compte.

- Date et heure : date et heure de l'événement, avec fuseau horaire.
- Appareil : informations disponibles sur le navigateur ou l'appareil.
- Adresse IP : affichage prudent, si utile.
- Localisation : estimation approximative uniquement, si disponible.

Par mesure de sécurité, les connexions par mot de passe ont été temporairement limitées.

Si vous n'êtes pas à l'origine de ces tentatives, utilisez l'application ou le site officiel ShipShop pour changer votre mot de passe et vérifier la sécurité de votre compte. Ne communiquez jamais votre mot de passe ni vos codes de vérification.

### Règles d'envoi

- Envoyer une alerte au seuil de cinq échecs.
- Éviter d'envoyer un e-mail à chaque tentative.
- Dédupliquer les alertes pour un même épisode.
- Envoyer une nouvelle alerte seulement lors d'un nouvel épisode ou d'un événement de gravité supérieure.
- Ne jamais envoyer de mot de passe, de jeton de session ou de code secret dans une notification.
- Ne notifier que les coordonnées vérifiées du propriétaire du compte.

## 5. Architecture technique envisagée

### 5.1 Examiner d'abord l'existant

Avant toute modification, inventorier :

- `src/lib/auth.ts` et sa configuration Better Auth ;
- les routes et méthodes réellement utilisées pour la connexion ;
- le mécanisme de limitation de débit Better Auth déjà configuré ;
- le système d'e-mail et les notifications existantes ;
- `NotifyOutbox` et ses consommateurs, si adaptés ;
- les modèles Prisma disponibles ;
- l'infrastructure de déploiement et la présence éventuelle de plusieurs instances backend.

Ne pas supposer qu'un hook Better Auth particulier est déclenché pour chaque échec de mot de passe sans vérifier la documentation correspondant à la version installée et le comportement réel du projet.

### 5.2 Compteurs et stockage

Choisir le stockage après avoir vérifié l'infrastructure :

- Redis partagé avec opérations atomiques, si Redis est déjà disponible et exploité de manière fiable ; ou
- PostgreSQL avec mises à jour atomiques et transactions adaptées.

Ne pas utiliser un simple compteur en mémoire du processus : il serait perdu au redémarrage et incohérent entre plusieurs instances.

Un modèle dédié de sécurité des connexions peut être envisagé si les structures existantes ne conviennent pas. Les champs à étudier comprennent :

- identifiant de compte ou empreinte de l'identifiant soumis ;
- empreinte de l'adresse IP ;
- nombre d'échecs ;
- début de la fenêtre de comptage ;
- date de fin du blocage ;
- date de dernière tentative ;
- statut ou motif de l'événement.

Éviter de conserver inutilement des données personnelles brutes. Définir une durée de conservation et une politique de purge.

### 5.3 Traitement d'une tentative

1. Recevoir la demande de connexion.
2. Appliquer la limitation IP avant le traitement coûteux du mot de passe.
3. Appliquer la limitation du compte sans révéler son existence.
4. Si une limite est atteinte, refuser avec une réponse générique et une durée de réessai appropriée.
5. Sinon, laisser Better Auth effectuer la vérification du mot de passe.
6. Enregistrer l'échec ou le succès de façon atomique.
7. Déclencher une notification dédupliquée si le seuil est atteint.
8. Journaliser les événements de sécurité sans enregistrer de secret.

Le compteur doit être mis à jour même lorsque l'identifiant soumis ne correspond à aucun compte, afin de réduire les possibilités d'énumération. Le comportement exact doit être validé avec le flux Better Auth réellement utilisé.

## 6. Protection du compte et récupération

- Ne pas désactiver le compte de façon permanente sur la seule base d'échecs de connexion.
- Maintenir un parcours de réinitialisation du mot de passe sécurisé.
- Protéger également les demandes de réinitialisation contre l'abus et l'énumération de comptes.
- Invalider les sessions existantes après une réinitialisation ou un changement de mot de passe lorsque le niveau de risque le justifie.
- Proposer ou renforcer l'authentification à deux facteurs (2FA), notamment pour les comptes sensibles.
- Ne jamais demander le mot de passe actuel par e-mail ou dans une notification.
- Prévoir une procédure de récupération qui ne dépend pas uniquement de l'IP bloquée.

## 7. Tests de sécurité obligatoires

À exécuter uniquement en local ou en staging isolé, avec des comptes de test.

| Test                                   | Résultat attendu                                         |
| -------------------------------------- | -------------------------------------------------------- |
| 1 à 4 échecs                           | Pas de blocage du compte                                 |
| 5e échec consécutif                    | Blocage temporaire de 15 minutes                         |
| Tentative pendant le blocage           | Refus sans prolongation répétitive du délai              |
| Après expiration, bon mot de passe     | Connexion possible                                       |
| Connexion réussie                      | Compteur d'échecs réinitialisé                           |
| Même compte ciblé depuis plusieurs IP  | La limitation par compte continue de fonctionner         |
| Plusieurs comptes ciblés depuis une IP | La limitation IP intervient                              |
| Deux requêtes concurrentes au seuil    | Compteur cohérent, sans contournement                    |
| Identifiant inexistant                 | Réponse ne révélant pas l'existence d'un compte          |
| Alerte de sécurité                     | Envoyée uniquement à une adresse vérifiée et dédupliquée |
| Réinitialisation du mot de passe       | Parcours sûr et sessions traitées selon la politique     |
| Plusieurs instances backend            | Compteurs cohérents grâce au stockage partagé            |

Ajouter des tests de non-régression pour les connexions par e-mail, téléphone, mot de passe, bearer token et les autres flux réellement pris en charge par le projet.

## 8. Journalisation et confidentialité

Enregistrer les événements utiles à l'investigation :

- horodatage ;
- résultat de la tentative ;
- identifiant interne du compte lorsqu'il est connu ;
- empreinte IP ou donnée minimisée ;
- User-Agent ou catégorie d'appareil, si nécessaire ;
- raison de la limitation ;
- identifiant de corrélation.

Ne jamais journaliser :

- mot de passe soumis ;
- cookies de session ;
- jetons bearer ;
- codes de réinitialisation ;
- secrets d'authentification.

Restreindre l'accès aux journaux, définir une durée de conservation et limiter les informations exposées à l'interface utilisateur.

## 9. Ordre d'implémentation

1. **Audit de l'authentification actuelle** : identifier les flux, hooks et limites Better Auth réellement utilisés.
2. **Conception des compteurs** : choisir PostgreSQL ou Redis selon l'infrastructure existante.
3. **Limitation par compte** : seuil de cinq échecs et délai initial de quinze minutes.
4. **Limitation par IP** : règles distinctes et protection contre les attaques multi-comptes.
5. **Notifications** : e-mail vérifié, déduplication et journalisation.
6. **Récupération et 2FA** : vérifier les flux existants et définir les améliorations.
7. **Tests automatisés** : seuils, concurrence, expiration, confidentialité et non-régression.
8. **Déploiement progressif** : staging, observation des faux positifs, puis production avec surveillance.

## 10. Critères d'acceptation

Le chantier est terminé lorsque :

- cinq échecs consécutifs déclenchent la temporisation prévue ;
- le blocage est temporaire et ne peut pas être prolongé indéfiniment par un attaquant ;
- les limites par compte et par IP fonctionnent ensemble ;
- les compteurs restent cohérents entre instances backend ;
- les alertes sont envoyées au propriétaire vérifié sans spam ;
- aucun secret n'est écrit dans les journaux ;
- les réponses ne permettent pas d'énumérer les comptes ;
- les parcours de connexion et de récupération légitimes restent fonctionnels ;
- les tests automatisés passent en local ou en staging.

## 11. Consignes de sécurité pour les travaux

- Ne pas effectuer de tests de force brute sur des comptes réels.
- Ne pas tester en production sans autorisation et plan de déploiement explicites.
- Ne pas modifier Better Auth à l'aveugle.
- Ne pas créer de modèle Prisma ou de route avant l'inventaire du code existant.
- Ne jamais afficher ni partager le contenu du fichier `.env`.
- Ne pas supprimer les mécanismes existants sans avoir vérifié leurs dépendances.

---

**Prochaine étape :** inspecter `src/lib/auth.ts`, les flux de notification et les mécanismes de limitation déjà présents, puis rédiger un correctif adapté au code réel de ShipShop.
