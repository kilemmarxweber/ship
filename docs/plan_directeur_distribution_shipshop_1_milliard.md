# Plan directeur de distribution ShipShop — cible 1 milliard de lignes

**Version :** 1.0 — 15 novembre 2026  
**Décisions retenues :** déploiement initial managé · comparaison technologique avant choix définitif · priorité de trafic globale (social, commerce, messagerie, livraison, live).

> **Statut :** architecture cible et plan d'exécution. Ce document ne constitue pas une validation de capacité ni une autorisation de migration en production. Les volumes, coûts, régions, SLA et tailles de nœuds doivent être confirmés par un benchmark représentatif et les offres commerciales du fournisseur retenu.

---

## 1. Résumé exécutif

ShipShop doit évoluer vers une architecture distribuée sans transformer immédiatement toute l'application en microservices ni fragmenter toutes les tables. La stratégie recommandée est :

1. **Commencer managé** : PostgreSQL managé hautement disponible pour les données transactionnelles, Redis managé, stockage objet, CDN, et plateforme de streaming gérée.
2. **Séparer les domaines logiquement dans le code et les contrats**, puis physiquement uniquement lorsque les métriques et les besoins d'isolation le justifient.
3. **Garder l'identité et la finance fortement cohérentes** dans un domaine transactionnel central au départ.
4. **Déplacer les charges éphémères** (présence live, signaux RTC, compteurs, rate limits) hors de PostgreSQL.
5. **Traiter les événements volumineux** par files/broker, consommateurs idempotents, partitions temporelles et rétention.
6. **Construire des projections de lecture** pour les écrans et flux transverses plutôt que multiplier les jointures inter-bases.
7. **Ne choisir le sharding qu'après audit des requêtes, contraintes uniques, relations et volumes réels.**

La cible d'un milliard de lignes est une contrainte de conception, pas une raison de sharder dès le premier jour. Un milliard de lignes étalées sur plusieurs tables, avec une bonne stratégie d'index, de partitionnement, de rétention et de lecture, n'a pas le même profil qu'un milliard de lignes dans une seule table chaude.

## 2. Principes non négociables

- **Pas de big-bang** : migration progressive, réversible, mesurée.
- **Pas de base physique par modèle Prisma** : les frontières suivent les domaines et les transactions.
- **Pas de finance dans Redis** : soldes, transferts, cadeaux payants, remboursements et écritures comptables restent durables et transactionnels.
- **Pas de vidéo dans les routes Next.js** : média via WebRTC/SFU et diffusion HLS/LL-HLS avec CDN.
- **Pas de heartbeat live en écriture SQL** à chaque intervalle.
- **Pas de FK inter-clusters** : après séparation physique, l'intégrité inter-domaines est garantie par contrats, validations applicatives, outbox/inbox et réconciliation.
- **Pas de lecture de réplica pour une décision d'autorisation ou de paiement qui exige une donnée fraîche**, sauf mécanisme explicite de cohérence.
- **Toutes les commandes financières et événements consommateurs sont idempotents.**
- **Aucun changement de schéma ou basculement sans sauvegarde vérifiée, répétition en staging et plan de retour arrière.**

## 3. Topologie concrète proposée

### 3.1 Topologie logique initiale

```text
Clients Web / Expo
       |
       v
DNS + WAF + protection DDoS + CDN
       |
       v
Load Balancer / API Gateway
       |
       +--------------------> Next.js API / BFF (stateless, plusieurs instances)
       |                              |
       |                              +--> Auth & Identity (PostgreSQL Core)
       |                              +--> Commerce (PostgreSQL Commerce)
       |                              +--> Social/Catalogue (PostgreSQL Social)
       |                              +--> Messaging (PostgreSQL Messaging)
       |                              +--> Redis managé
       |                              +--> Broker d'événements
       |
       +--------------------> WebSocket Gateway (instances stateless)
       |                              +--> Redis Pub/Sub / présence
       |                              +--> Broker pour événements durables
       |
       +--------------------> Live control plane
                                      +--> fournisseur SFU/WebRTC
                                      +--> Ingest / transcodage
                                      +--> HLS/LL-HLS + CDN

Broker --> Workers (notifications, indexation, projections, analytics, livraison)
Media upload --> Object Storage --> CDN
Observabilité --> logs, métriques, traces, alertes
```

### 3.2 Déploiement initial managé : composants et responsabilités

| Couche | Service cible | Responsabilité | Règle de placement |
|---|---|---|---|
| Edge | CDN + WAF + DDoS | assets, images, vidéos, cache HTTP, filtrage | proche des utilisateurs |
| API | conteneurs managés stateless | API Next.js, BFF, endpoints métier | plusieurs instances, autoscaling |
| Core DB | PostgreSQL managé HA | User, Session, Account, auth, organisations, finance | région primaire unique au début |
| Commerce DB | PostgreSQL managé HA ou schéma isolé au départ | commandes, paniers, paiements métier, stock | séparation logique initiale, cluster plus tard |
| Social DB | PostgreSQL managé | produits, interactions, follows, catalogue | candidat au partitionnement/sharding ultérieur |
| Messaging DB | PostgreSQL managé | messages durables, conversations, états de lecture | partitionnement par temps et/ou conversation |
| Cache | Redis managé HA | cache, sessions techniques si approprié, rate limits, présence, compteurs | données reconstructibles/éphémères |
| Broker | NATS JetStream, Kafka managé ou équivalent | événements durables, découplage, reprises | sélectionner après POC de débit/opérations |
| Media | object storage + CDN | images, clips, enregistrements, segments vidéo | jamais dans PostgreSQL |
| Live | SFU/WebRTC managé + HLS/LL-HLS/CDN | invités interactifs et spectateurs | WebRTC pour interaction, HLS/CDN pour audience |
| Search | moteur dédié si besoin mesuré | recherche texte, facettes, suggestions | index alimenté par événements |
| Analytics | entrepôt/OLAP séparé | reporting, agrégations lourdes | aucune requête analytique lourde sur OLTP |

**Important :** « plusieurs bases logiques » peut être le premier palier. Les bases physiques séparées ne sont créées que lorsque la charge, le risque de panne, les besoins de sécurité ou le cycle de déploiement le justifient. Ne pas provisionner quatre petits clusters indépendants uniquement pour donner l'impression d'être distribué.

### 3.3 Domaines de données

| Domaine | Modèles ShipShop concernés (liste indicative) | Source de vérité initiale | Cible de montée en charge |
|---|---|---|---|
| Identity/Core | User, Session, Account, Verification, Organization, Member, Invitation | Core PostgreSQL | HA + réplicas de lecture contrôlés |
| Finance | Wallet, WalletTransaction, MoneyMovement, PaymentAudit, IdempotentOperation, Withdrawal, PlatformTreasury, PlatformFee | Core PostgreSQL | cluster isolé, partitionnement ciblé, ledger auditable |
| Commerce | Shop, Product, CartItem, Order, OrderIssue, ShopDeliveryRate, ProductPromo | PostgreSQL Commerce/logical domain | sharding orienté shop ou tenant après étude |
| Social/CIS | ProductLike, ProductComment, ProductShare, UserFollow, CisEvent, CisRecommendation, UserActivityDay, missions | PostgreSQL Social | partitionnement temporel + sharding par clé métier |
| Messaging | Conversation, Message, ProductCommentRead, NotificationLog | PostgreSQL Messaging | partitionnement par temps/conversation, projection inbox |
| Delivery/Events | DeliveryEvent, PickupReceipt, Event, Ticket, TicketType | PostgreSQL domaine | partitionnement temporel, sharding par orderId/eventId selon accès |
| Live | CreatorLive, LiveGuest, CreatorGift, LiveChatMessage, LiveViewerPresence, LiveRtcSignal | PostgreSQL durable + Redis/SFU | chat partitionné, présence et signaux éphémères |

Les modèles exacts, les relations, les contraintes uniques et les requêtes doivent être relus dans le schéma Prisma complet et dans le code d'accès aux données avant d'affecter définitivement chaque table.

## 4. Comparaison technologique — décision à prendre par preuve

### 4.1 Options PostgreSQL et SQL distribué

| Option | Avantages | Limites / risques pour ShipShop | Position |
|---|---|---|---|
| PostgreSQL managé classique + read replicas + partitions natives | compatibilité PostgreSQL/Prisma élevée, migration progressive, opérations familières | les réplicas ne répartissent pas les écritures; le partitionnement seul ne distribue pas le cluster sur plusieurs nœuds | **Socle initial recommandé** |
| PostgreSQL managé avec Citus / clusters élastiques | sharding par clé, co-localisation, SQL PostgreSQL, ajout de workers et rééquilibrage | contraintes uniques et FK liées à la clé de distribution; requêtes cross-shard plus coûteuses; compatibilité des migrations/ORM à valider | **Premier candidat pour les domaines distribuables** |
| Sharding applicatif sur plusieurs PostgreSQL managés | contrôle explicite du routage et des domaines; indépendance fournisseur | complexité élevée : routing, migrations multi-shards, transactions distribuées, rebalancing, opérations et cohérence | **Option de repli/évolution si Citus ne convient pas** |
| CockroachDB managé / SQL distribué | réplication et distribution natives, transactions distribuées, tolérance aux pannes | dialecte et compatibilité PostgreSQL non identiques dans tous les détails; Prisma, extensions, requêtes et latence multi-région à tester; coût à benchmarker | **POC comparatif, pas de migration directe** |
| NoSQL distribué | très grande échelle sur des accès clé-valeur/document prévisibles | moins adapté aux relations et transactions multi-entités existantes; duplication et cohérence à concevoir | **Pour des sous-domaines ciblés seulement** |

### 4.2 Fournisseurs managés à mettre en concurrence

1. **Azure Database for PostgreSQL — Elastic Clusters (Citus)** : candidat prioritaire si le POC confirme les contraintes Prisma, les FK/uniques et les performances des requêtes distribuées. Microsoft présente Elastic Clusters comme la voie actuelle pour les charges PostgreSQL horizontales avec Citus. L'ancien Azure Cosmos DB for PostgreSQL est sur une trajectoire de retrait et ne doit pas être retenu pour un nouveau projet. Voir [documentation Microsoft sur la migration vers Elastic Clusters](https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/concepts-benefits-database-postgresql).
2. **AWS RDS for PostgreSQL / Aurora PostgreSQL** : candidat pour le socle PostgreSQL managé classique, HA et réplicas. Le sharding horizontal serait alors géré au niveau applicatif ou par une technologie complémentaire; ne pas confondre read replicas et sharding.
3. **CockroachDB Cloud** : candidat de comparaison pour les domaines nécessitant une distribution SQL native. Le POC doit vérifier les requêtes, transactions, index, compatibilité Prisma et latence réelle.
4. **Autres PostgreSQL managés** : à comparer selon régions disponibles, SLA, sauvegardes, PITR, réseau privé, limites de connexions, support des extensions, réplication et coût total.

La disponibilité régionale, les tarifs, les quotas et les SLA évoluent : ils doivent être vérifiés dans les offres contractuelles au moment du choix. Le choix fournisseur final ne peut pas être fait sans région de déploiement, budget, profil de charge et objectifs RPO/RTO.

### 4.3 Matrice de décision du POC

Noter chaque option sur 5, avec pondération :

| Critère | Poids |
|---|---:|
| Compatibilité PostgreSQL / Prisma / migrations existantes | 20 % |
| Transactions et intégrité des données métier | 20 % |
| Débit d'écriture et latence p95/p99 sur charge représentative | 15 % |
| Scalabilité horizontale et rééquilibrage | 15 % |
| HA, sauvegardes, PITR, RPO/RTO | 10 % |
| Coût total à 12 et 36 mois | 10 % |
| Exploitabilité, observabilité, compétences disponibles | 5 % |
| Disponibilité réseau/région et conformité | 5 % |

**Seuil de décision :** aucun choix ne passe en production sur la seule base d'une fiche marketing. Il faut un POC reproduisant les requêtes et transactions ShipShop.

## 5. Stratégie de distribution des données

### 5.1 Ordre recommandé

**Étape A — optimiser avant de distribuer**
- inventorier les requêtes réelles et leur fréquence;
- ajouter les index justifiés par les plans `EXPLAIN (ANALYZE, BUFFERS)`;
- éliminer N+1, surchargement de colonnes et pagination OFFSET profonde;
- utiliser pagination par curseur;
- corriger les requêtes non bornées;
- établir la politique de rétention et d'archivage;
- utiliser des pools de connexions et limiter les connexions par instance.

**Étape B — partitionner les tables volumineuses**
- partitionnement temporel mensuel ou hebdomadaire selon le débit et la taille;
- index locaux adaptés aux filtres dominants;
- rétention et archivage par partition;
- vérifier les requêtes qui filtrent sur la clé de partition afin de permettre l'élagage des partitions.

**Étape C — sharder les domaines qui en bénéficient**
- choisir la clé à partir des accès dominants et de la co-localisation;
- conserver les relations fortement transactionnelles sur le même shard lorsque possible;
- documenter les requêtes cross-shard et les accepter uniquement lorsqu'elles sont rares;
- prévoir la répartition des tenants très actifs (« hot tenants »);
- automatiser la réconciliation et le rebalancing.

### 5.2 Candidats à étudier — pas des décisions de migration

| Tables / famille | Clé candidate | Traitement initial |
|---|---|---|
| CisEvent | userId | partition temps; sharding par userId si volume le justifie |
| UserActivityDay, UserMissionProgress | userId | index/partition selon volume; uniques alignées à vérifier |
| LiveChatMessage | liveId | partition temps + distribution liveId |
| DeliveryEvent | orderId ou temps | choisir selon recherches par commande vs reporting temporel |
| NotificationLog | temps / userId | partition temps; projection des notifications non lues |
| ProductPriceHistory | productId | partition temps; co-localiser avec catalogue si utile |
| ProductLike, ProductComment, ProductShare | productId | tester les lectures centrées produit et les vues centrées utilisateur |
| Product, Shop | shopId | candidat pour lectures vendeur; prévoir projection pour flux acheteur |
| Order | shopId ou buyerId | ne pas choisir avant mesure des parcours vendeur/acheteur |
| UserFollow | followerId ou followedId | nécessite potentiellement deux projections/indexations pour les deux sens |
| Ticket | eventId | contrainte de code global à résoudre avant sharding |
| CreatorGift | liveId | garder l'écriture financière durable; clé d'idempotence globale à concevoir |
| ShipPointLedger | orderId ou shopId | arbitrer avec l'unicité (orderId, reason) et les accès de rapprochement |

### 5.3 Contraintes uniques à traiter avant Citus

Citus impose des règles de distribution : les clés primaires et contraintes d'unicité des tables distribuées doivent inclure la colonne de distribution; les FK entre tables distribuées exigent notamment une co-localisation compatible et l'inclusion de la clé de distribution. Voir [documentation Citus sur DDL et co-localisation](https://citus-doc.readthedocs.io/en/latest/develop/reference_ddl.html).

Points déjà identifiés dans le schéma ShipShop à revalider :
- `CreatorGift.clientIdempotencyKey` : unicité globale incompatible avec un simple shard par `liveId` si la contrainte doit rester globale.
- `Ticket.code` : unicité globale à préserver même si `Ticket` est distribué par `eventId`.
- `ShipPointLedger(orderId, reason)` : ne pas choisir `shopId` sans examiner l'unicité et les opérations de ledger.
- les FK entre domaines ne pourront pas être maintenues comme FK SQL après séparation physique.

**Règle :** ne jamais supprimer une contrainte d'unicité uniquement pour rendre une table distribuable. Concevoir plutôt un registre global d'idempotence/code, une clé composée, ou un domaine propriétaire de l'identifiant.

## 6. Cache, lectures et projections

### 6.1 Redis

Utiliser Redis pour :
- présence des viewers et des invités live avec TTL;
- compteurs approximatifs de viewers, likes et réactions;
- rate limiting;
- cache de catalogue et de configuration;
- sessions de connexion WebSocket et routage de présence;
- verrous courts uniquement si leur sémantique est formellement définie.

Ne pas utiliser Redis comme source de vérité des soldes, paiements, cadeaux, commandes ou droits d'accès persistants.

### 6.2 Cache applicatif

- cache-aside avec TTL et invalidation par événements;
- clés versionnées par entité et tenant;
- TTL courts pour les données changeantes;
- éviter les invalidations globales;
- protéger contre le cache stampede (single-flight, jitter, stale-while-revalidate);
- ne jamais mettre en cache une réponse autorisée sans inclure le contexte de sécurité pertinent dans la clé.

### 6.3 Read replicas et read models

- réplicas pour les lectures qui tolèrent un léger retard;
- primaire pour les écritures et lectures read-after-write critiques;
- mesurer le lag et router dynamiquement selon le niveau de cohérence requis;
- créer des projections pour `seller dashboard`, `buyer order history`, `product feed`, `conversation inbox` et `live summary`;
- alimenter les projections via outbox + broker, avec consommateurs idempotents et possibilité de reconstruire.

## 7. Architecture live pour des milliers de spectateurs

```text
Créateur / invités -- WebRTC --> SFU managé
                                  |
                                  +--> transcodage / packaging
                                             |
                                             v
Spectateurs <-- CDN <-- HLS / LL-HLS

Clients --> WebSocket Gateway --> Redis (présence, compteurs, fanout)
                         |
                         +--> Broker --> PostgreSQL (chat durable, événements)
                                      --> Workers (modération, notifications, analytics)
```

- WebRTC/SFU pour le créateur et les invités interactifs.
- HLS/LL-HLS via CDN pour la majorité des spectateurs.
- présence `LiveViewerPresence` dans Redis avec TTL; ne pas écrire chaque heartbeat en SQL.
- `LiveRtcSignal` dans la couche de signalisation/transport, avec expiration; pas comme historique SQL durable par défaut.
- `LiveChatMessage` durable dans PostgreSQL, partitionné par temps et organisé par `liveId` si le volume le justifie.
- `CreatorGift` enregistré en transaction durable avec idempotence; publier l'événement seulement après commit.
- `CreatorLive` et `LiveGuest` gardent les états métier durables nécessaires.
- le compteur de spectateurs est une estimation opérationnelle, jamais une preuve financière.

Le fournisseur SFU, la qualité vidéo, les régions et le coût egress doivent être benchmarkés. La facture de diffusion peut dépasser celle de la base de données.

## 8. Messagerie, événements et cohérence

### 8.1 Pattern outbox/inbox

Pour toute opération qui modifie la base et déclenche un événement :
1. écrire l'état métier et une ligne outbox dans la même transaction;
2. publier l'outbox vers le broker;
3. consommer avec un identifiant d'événement unique;
4. enregistrer l'idempotence côté consommateur;
5. réessayer avec backoff;
6. envoyer en dead-letter après seuil et fournir un outil de replay contrôlé.

Ne pas tenter une transaction atomique PostgreSQL + Redis + broker dans le code applicatif.

### 8.2 Garanties par domaine

| Opération | Garantie attendue |
|---|---|
| transfert portefeuille / paiement / cadeau payant | transaction SQL atomique, idempotence stricte, audit durable |
| commande / remboursement | état métier durable, transitions explicites, outbox |
| présence live / compteur | éphémère, TTL, estimation |
| chat | livraison temps réel best-effort + persistance durable selon politique produit |
| notification | asynchrone, retry, déduplication |
| feed / recommandations | cohérence éventuelle, projection reconstruisible |

## 9. Topologie cible par paliers

### Palier 0 — stabiliser le monolithe modulaire
- un PostgreSQL managé HA;
- schémas/domaines logiques et repositories distincts;
- Redis managé;
- broker managé;
- stockage objet + CDN;
- workers séparés de l'API;
- services live managés;
- observabilité complète.

### Palier 1 — isoler les charges
- Core/Finance reste sur son cluster;
- Commerce, Social et Messaging migrent vers des clusters distincts seulement si la charge ou le risque le justifie;
- read replicas pour lectures tolérantes au lag;
- partitions temporelles pour tables append-only;
- projections pour les vues transverses.

### Palier 2 — distribution horizontale ciblée
- POC Citus/Elastic Clusters sur Social ou Live Chat;
- tester sharding par `userId`, `productId` ou `liveId`;
- valider contraintes, transactions, migrations Prisma et requêtes cross-shard;
- rebalancing en environnement de test.

### Palier 3 — multi-région et capacité mondiale
- réplication régionale pour lecture et disponibilité selon besoins;
- données résidentes dans une région propriétaire;
- stratégie explicite de failover et de conflit;
- ne pas faire d'écritures multi-région actives sur les mêmes agrégats financiers sans protocole de cohérence adapté.

## 10. Premières étapes d'implémentation

### Phase 1 — inventaire et mesures (semaine 1–2)

**Livrables**
- carte des routes API et services;
- inventaire des requêtes Prisma/SQL les plus fréquentes;
- volumes actuels par table, taille des index, taux d'écriture;
- top 50 requêtes par durée et fréquence;
- cartographie des relations et contraintes uniques;
- profil des connexions, CPU, RAM, IOPS, stockage et réseau;
- objectifs provisoires RPO/RTO et SLO.

**Actions**
1. extraire les métriques `pg_stat_statements`;
2. collecter les plans `EXPLAIN (ANALYZE, BUFFERS)` sur staging;
3. mesurer la taille totale et la croissance des tables;
4. mesurer le nombre de connexions simultanées et le pool Prisma;
5. tracer les requêtes lentes par route;
6. identifier les écritures inutiles de présence, analytics et notifications.

Ne pas lancer `EXPLAIN ANALYZE` sur une requête coûteuse en production sans évaluation du risque; privilégier staging ou lecture contrôlée.

### Phase 2 — fondations managées (semaine 2–4)

1. choisir une région primaire proche des utilisateurs et des dépendances réseau, après mesure de latence;
2. créer PostgreSQL managé HA avec sauvegardes automatiques et PITR;
3. définir réseau privé, règles d'accès minimales et gestion des secrets;
4. activer pooler de connexions;
5. déployer Redis managé;
6. déployer broker managé;
7. créer stockage objet et CDN;
8. déployer workers séparés;
9. mettre en place dashboards et alertes;
10. tester restauration complète et bascule HA.

### Phase 3 — architecture logicielle (semaine 3–6)

- créer des modules de domaine (`identity`, `finance`, `commerce`, `social`, `messaging`, `delivery`, `live`);
- isoler les accès Prisma derrière des repositories;
- interdire les imports directs de modèles d'un autre domaine hors contrat;
- créer les contrats d'événements versionnés;
- implémenter outbox/inbox;
- introduire un identifiant de corrélation et un identifiant d'idempotence;
- établir les règles de cohérence primaire/réplica/cache;
- préparer un registre des migrations et une stratégie expand/contract.

### Phase 4 — gains immédiats (semaine 5–8)

- corriger N+1 et requêtes non bornées;
- indexer selon plans et filtres réels;
- remplacer OFFSET profond par pagination curseur;
- ajouter cache sur les lectures fréquentes et stables;
- déplacer présence live et compteurs dans Redis;
- déplacer les traitements asynchrones vers workers;
- introduire projections feed/inbox/tableaux de bord si les mesures le justifient.

### Phase 5 — POC distribution (semaine 7–10)

Créer un jeu de données synthétique représentatif, sans données personnelles réelles :
- profils de charge réalistes;
- distribution uniforme et distribution très déséquilibrée;
- gros tenants et lives « chauds »;
- opérations multi-lignes et contraintes uniques;
- requêtes par utilisateur, boutique, produit, commande et conversation.

Comparer PostgreSQL managé classique, Citus/Elastic Clusters et CockroachDB sur :
- latence p50/p95/p99;
- débit lecture/écriture;
- coût par million d'opérations;
- temps de rebalancing;
- impact d'un nœud indisponible;
- lag des réplicas;
- compatibilité Prisma/migrations;
- complexité opérationnelle.

### Phase 6 — migration pilote

- choisir une seule famille de tables à faible risque financier;
- backfill initial;
- réplication CDC ou double écriture contrôlée (préférer CDC si adapté);
- comparer les résultats source/cible;
- shadow reads;
- bascule progressive par pourcentage de trafic;
- surveiller erreurs, latence et divergence;
- garder un plan de retour arrière;
- arrêter la double écriture après validation.

## 11. Tests de capacité et objectifs à définir

Scénarios à exécuter :
- API : charge nominale, pic x3, pic x10;
- catalogue : lectures concentrées sur quelques produits;
- commerce : pics simultanés de commandes et mises à jour de stock;
- messagerie : rafales de messages et reconnexions;
- live : 100, 1 000, 5 000 puis 10 000 spectateurs par live, plusieurs lives simultanés;
- cadeaux : répétition de requêtes, timeouts, retries, même clé d'idempotence;
- panne : perte d'une instance API, worker, broker, réplica et nœud DB;
- restauration : PITR et reconstruction de projections.

À fixer avant le test : RPO, RTO, SLO de disponibilité, p95/p99 par parcours, débit d'événements, durée de rétention, budget et coût d'egress. Les chiffres de spectateurs sont des paliers de test, pas une capacité actuellement garantie.

## 12. Sécurité et exploitation

- réseau privé entre services et bases;
- TLS en transit et chiffrement au repos;
- secrets dans un gestionnaire de secrets, rotation et droits minimaux;
- séparation des rôles lecture/écriture/administration;
- audit des accès financiers et opérations privilégiées;
- sauvegardes chiffrées, tests de restauration réguliers;
- migrations automatisées en CI, avec approbation et garde-fous;
- alertes sur saturation CPU, mémoire, stockage, IOPS, connexions, réplication, deadlocks, queue lag et erreurs;
- logs structurés sans secrets ni données personnelles inutiles;
- tests de reprise et runbooks documentés.

## 13. Ce qu'il ne faut pas faire maintenant

- ne pas shard toutes les tables simultanément;
- ne pas migrer la finance vers une base distribuée avant un besoin démontré;
- ne pas installer plusieurs bases sur un seul VPS en pensant obtenir une haute disponibilité;
- ne pas utiliser Redis Pub/Sub comme journal durable;
- ne pas envoyer toutes les vidéos et tous les spectateurs via WebRTC;
- ne pas créer de microservice par table;
- ne pas conserver de FK inter-bases fictives;
- ne pas créer d'index sans mesurer le coût en écriture et stockage;
- ne pas fixer une clé de sharding sans analyser les requêtes dominantes;
- ne pas basculer sans répétition de migration et restauration.

## 14. Décisions encore nécessaires

Ces éléments conditionnent le dimensionnement final et le fournisseur :
1. région primaire et régions de présence des utilisateurs;
2. budget mensuel de départ et budget cible à 12 mois;
3. volumes actuels et croissance mensuelle par table;
4. trafic API actuel et cible (requêtes/s);
5. objectifs RPO/RTO et disponibilité;
6. fournisseur cloud préféré ou contraintes contractuelles;
7. niveau de latence attendu pour le live et le chat;
8. rétention légale/produit des messages, événements et logs.

## 15. Sources techniques consultées

- Microsoft Learn — [Migrer vers Azure Database for PostgreSQL avec Elastic Clusters](https://learn.microsoft.com/en-us/azure/cosmos-db/postgresql/concepts-benefits-database-postgresql). La documentation décrit Elastic Clusters comme l'option actuelle basée sur Citus pour l'échelle horizontale PostgreSQL et indique que l'ancien Azure Cosmos DB for PostgreSQL est sur une trajectoire de retrait.
- Citus — [Creating and Modifying Distributed Tables (DDL)](https://citus-doc.readthedocs.io/en/latest/develop/reference_ddl.html). Référence sur co-localisation, clés de distribution, contraintes uniques et clés étrangères.
- CockroachDB — [Architecture](https://www.cockroachlabs.com/docs/stable/architecture/overview.html). Référence de comparaison pour SQL distribué et réplication.

---

## Annexe A — premières commandes d'observation PostgreSQL

À exécuter sur une base de **staging** ou en lecture contrôlée. Adapter les droits et vérifier que `pg_stat_statements` est activé.

```sql
-- Top tables par taille totale (données + index + TOAST)
SELECT
  schemaname,
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 50;

-- Tables avec activité estimée
SELECT
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  seq_scan,
  idx_scan,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 50;

-- Requêtes les plus coûteuses (si pg_stat_statements est activé)
SELECT
  calls,
  round(total_exec_time::numeric, 1) AS total_ms,
  round(mean_exec_time::numeric, 1) AS mean_ms,
  rows,
  left(query, 500) AS query_sample
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 50;
```

`n_live_tup` et les statistiques d'activité sont des estimations. Ne pas publier les textes SQL contenant des données sensibles.

## Annexe B — critères d'acceptation avant toute migration

- [ ] schéma source et contraintes uniques audités;
- [ ] requêtes critiques et plans enregistrés;
- [ ] volume et croissance mesurés;
- [ ] clé de distribution justifiée par les accès;
- [ ] compatibilité Prisma et migrations démontrée;
- [ ] contraintes d'intégrité préservées;
- [ ] backfill répétable et contrôlé;
- [ ] stratégie CDC/double écriture validée;
- [ ] tests de divergence et réconciliation automatisés;
- [ ] restauration et rollback répétés;
- [ ] alertes et runbooks prêts;
- [ ] validation explicite avant production.
