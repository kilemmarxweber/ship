# Plan de correction --- Rejeu des transferts ShipShop

**Statut :** implémenté (backend `shop`) — comparaison centralisée, rejeu/`P2002` → 409, soldes contrepartie masqués ; tests unitaires inclus.

## 1. Objectif

Sécuriser le mécanisme d'idempotence des transferts P2P dans
`transferFromBalance`, afin qu'une clé d'idempotence déjà utilisée ne
puisse pas être rejouée avec des paramètres différents et provoquer une
divulgation d'informations sur le portefeuille d'un tiers.

La correction doit préserver le comportement normal des transferts et
empêcher tout double débit lors des répétitions ou des requêtes
concurrentes.

## 2. Constat issu de l'audit

Dans `src/lib/payments/mobile-money.ts`, le code examiné recherche un
mouvement existant à partir de `clientIdempotencyKey`.

Les branches de rejeu semblent vérifier principalement que
`existing.payerUserId` correspond au payeur courant. Elles ne comparent
pas systématiquement le bénéficiaire, le montant et la devise aux
paramètres du mouvement initial.

Dans ces branches, le code peut ensuite rechercher le portefeuille du
bénéficiaire indiqué dans la nouvelle requête. Si cette valeur a été
modifiée, la réponse peut exposer le solde d'un autre utilisateur.

Un autre risque de confidentialité a été identifié dans
`getMovementForUser` : la réponse semble inclure le solde du payeur et
celui du bénéficiaire, y compris lorsque le demandeur n'est que l'autre
partie du transfert.

Ces constats proviennent de l'inspection du code fourni. Ils doivent
être confirmés par les tests avant de considérer la vulnérabilité comme
reproduite en conditions d'exécution.

## 3. Comportement de sécurité attendu

Pour une clé d'idempotence donnée, l'opération initiale doit rester
immuable.

Les paramètres à comparer sont :

- `payerUserId`
- `beneficiaryUserId`
- `amountCents`
- `currency` après normalisation avec les règles existantes
- `kind` (attendu : `P2P_BALANCE`)

Résultat attendu :

---

Cas Comportement

---

Même clé et mêmes paramètres Retourner le résultat du transfert
initial, sans nouveau débit

Même clé et bénéficiaire différent Refuser avec `409 Conflict`

Même clé et montant différent Refuser avec `409 Conflict`

Même clé et devise différente Refuser avec `409 Conflict`

Même clé utilisée par un autre Refuser sans révéler le mouvement
payeur

Deux requêtes identiques Un seul transfert comptabilisé ;
concurrentes les autres reçoivent le résultat du
même mouvement

Clé absente Conserver le comportement actuel
prévu par l'API

---

Ne pas révéler dans le message d'erreur les paramètres privés du
mouvement existant.

## 4. Étapes de mise en œuvre

### Étape 1 --- Vérifier le contrat actuel

Fichiers à examiner :

- `src/lib/payments/mobile-money.ts`
- `src/app/api/wallet/transfer/route.ts`
- `src/app/api/wallet/movements/route.ts`

Lire notamment :

- `transferFromBalance`
- `publicMovement`
- `postedResult`
- `getMovementForUser`
- le schéma Zod et la gestion des erreurs HTTP dans la route de
  transfert

Avant modification, relever le format JSON actuel des réponses et les
statuts HTTP utilisés. Ne pas inventer de nouveaux champs API.

### Étape 2 --- Centraliser la comparaison d'idempotence

Créer une petite fonction privée, typée, qui compare les paramètres de
la requête avec le mouvement existant.

La comparaison doit utiliser les valeurs normalisées réellement
utilisées par le transfert, notamment la devise et l'identifiant du
bénéficiaire.

La fonction doit refuser le rejeu si l'un des paramètres diffère. Elle
doit également vérifier que le mouvement existant est bien du type
attendu.

Éviter de dupliquer des conditions légèrement différentes entre le
chemin de rejeu normal et le traitement de l'erreur Prisma `P2002`.

### Étape 3 --- Corriger le rejeu normal

Lorsqu'un mouvement correspondant à la clé existe déjà :

1.  Vérifier que le demandeur est bien le payeur autorisé.
2.  Comparer tous les paramètres immuables.
3.  En cas de différence, produire une erreur de conflit (`409` au
    niveau HTTP).
4.  En cas de correspondance, retourner le mouvement existant.
5.  Ne jamais utiliser le bénéficiaire fourni dans la nouvelle requête
    pour rechercher un portefeuille ou construire la réponse.

Le rejeu ne doit jamais exécuter une nouvelle opération de débit ou de
crédit.

### Étape 4 --- Corriger la branche Prisma `P2002`

La contrainte unique sur `clientIdempotencyKey` peut être déclenchée
lorsque deux requêtes concurrentes tentent de créer le même mouvement.

Dans cette branche :

1.  Relire le mouvement associé à la clé.
2.  Vérifier l'identité du payeur et tous les paramètres du transfert.
3.  Retourner `409 Conflict` en cas de divergence.
4.  Retourner le résultat du mouvement existant en cas de
    correspondance.
5.  Ne pas consulter le portefeuille d'un bénéficiaire provenant de la
    requête concurrente.

La branche `P2002` doit appliquer exactement les mêmes règles que le
rejeu normal.

### Étape 5 --- Limiter les données de solde exposées

Examiner les objets retournés par `publicMovement`, `postedResult` et
`getMovementForUser`.

Principe cible :

- Une réponse ne doit exposer que le solde de l'utilisateur
  authentifié.
- Ne pas renvoyer le solde actuel de la contrepartie.
- Ne pas supposer que `payerBalanceAfter` ou `beneficiaryBalanceAfter`
  est visible uniquement par son propriétaire.
- Si l'API a besoin d'un solde après opération, le calculer ou le
  sélectionner à partir de l'identité authentifiée, jamais à partir
  d'un identifiant arbitraire fourni par le client.
- Préserver les champs publics nécessaires à l'application mobile,
  après vérification de leurs usages.

Vérifier également que `publicMovement` ne divulgue pas de métadonnées
internes, de données de paiement sensibles ou d'informations non
nécessaires.

### Étape 6 --- Gérer les erreurs proprement

La couche API doit transformer une divergence d'idempotence en réponse
HTTP `409 Conflict`.

Le message doit rester générique, par exemple : « Cette clé
d'idempotence a déjà été utilisée pour une autre opération. »

Ne pas retourner de stack trace, de solde tiers, ni les détails privés
du mouvement existant.

Conserver les statuts et messages des autres erreurs métier, sauf
nécessité démontrée.

## 5. Plan de tests

Les tests doivent utiliser un environnement local ou de staging isolé,
avec deux comptes de test A et B et des portefeuilles contenant des
soldes connus.

Ne pas exécuter de tests de transfert destructifs sur la production.

### Tests fonctionnels

- A effectue un transfert vers B avec une nouvelle clé : le transfert
  est comptabilisé une seule fois.
- A répète exactement la même requête avec la même clé : le mouvement
  initial est retourné, sans second débit ni second crédit.
- Le mouvement retourné correspond toujours au transfert initial.

### Tests de rejeu malveillant

Après un transfert initial A vers B, réutiliser la même clé :

- avec un bénéficiaire C ;
- avec un montant différent ;
- avec une devise différente ;
- avec un autre payeur.

Les requêtes modifiées doivent être refusées. Aucun portefeuille
supplémentaire ne doit être consulté ou modifié à partir des paramètres
modifiés.

### Tests de concurrence

Envoyer plusieurs requêtes identiques simultanément avec la même clé.

Vérifier :

- un seul mouvement comptabilisé ;
- un seul débit du payeur ;
- un seul crédit du bénéficiaire ;
- des réponses cohérentes ;
- aucun solde de contrepartie divulgué.

Répéter le scénario avec des paramètres différents partageant la même
clé : une seule opération initiale doit être conservée et les requêtes
divergentes doivent être refusées.

### Tests de confidentialité

Pour les réponses de transfert et de consultation de mouvement :

- le payeur ne reçoit pas le solde du bénéficiaire ;
- le bénéficiaire ne reçoit pas le solde du payeur ;
- un utilisateur tiers ne peut pas consulter le mouvement ;
- les champs sensibles de `metadata` ne sont pas exposés inutilement.

### Tests de non-régression

Vérifier également :

- transfert normal avec une nouvelle clé ;
- montant inférieur au minimum autorisé ;
- solde insuffisant ;
- bénéficiaire inexistant ;
- transfert vers soi-même ;
- devise invalide ;
- consultation d'un mouvement par son payeur ;
- consultation d'un mouvement par son bénéficiaire ;
- consultation d'un mouvement par un tiers.

## 6. Critères d'acceptation

La correction est acceptable lorsque :

- [ ] Le rejeu avec paramètres identiques ne crée aucun mouvement
      supplémentaire.
- [ ] Toute réutilisation de clé avec des paramètres différents
      renvoie `409 Conflict`.
- [ ] Le contrôle est identique dans le chemin normal et dans la
      branche `P2002`.
- [ ] Aucun identifiant de bénéficiaire fourni lors d'un rejeu
      divergent ne sert à charger son portefeuille.
- [ ] Les réponses ne divulguent jamais le solde de la contrepartie.
- [ ] Les contrôles d'accès aux mouvements restent limités au payeur
      et au bénéficiaire.
- [ ] Les tests de concurrence passent.
- [ ] Les tests de non-régression passent.
- [ ] Le format public de l'API reste compatible avec les usages
      confirmés de l'application mobile.

## 7. Ordre de travail recommandé

1.  Lire les fonctions et routes concernées sans modifier le code.
2.  Identifier précisément le format de réponse utilisé par
    l'application mobile.
3.  Ajouter les tests qui reproduisent les divergences de rejeu et la
    fuite de soldes.
4.  Implémenter la comparaison centralisée des paramètres.
5.  Corriger le rejeu normal et la branche `P2002`.
6.  Réduire les soldes exposés dans les réponses.
7.  Exécuter les tests ciblés puis les tests de non-régression.
8.  Relire le diff et vérifier qu'aucun secret ni changement de schéma
    non nécessaire n'a été ajouté.
9.  Déployer d'abord en staging et observer les erreurs `409` avant
    toute mise en production.

## 8. Hors périmètre

Cette intervention ne doit pas :

- modifier les soldes ou les mouvements existants ;
- supprimer des clés d'idempotence ;
- modifier le schéma Prisma sans justification ;
- changer le fournisseur de paiement ;
- changer les règles métier de transfert ;
- lancer des transferts réels en production ;
- refondre les autres fonctionnalités du portefeuille.

---

**Prochaine action :** examiner `publicMovement`, `postedResult`, la
route `/api/wallet/transfer` et la route `/api/wallet/movements`, puis
écrire les tests correspondant au comportement actuel avant d'appliquer
le correctif.
