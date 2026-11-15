# ShipShop LIVE HD — PDR & TDR
## Product Design Requirements & Technical Design Requirements

**Projet :** Intégration d'une fonctionnalité LIVE inspirée de TikTok LIVE dans ShipShop  
**Application mobile :** React Native CLI (Bare Workflow) — Android  
**Backend :** Node.js / Express  
**Fonctionnalités principales :** Streaming vidéo HD, audio, interactions en direct, produits, cadeaux virtuels et filtres AR avec suivi du visage et de la tête.

---

# 1. Présentation du projet

## 1.1 Objectif

Intégrer dans ShipShop un système de diffusion LIVE permettant à un utilisateur de diffuser une vidéo en direct, tandis que d'autres utilisateurs peuvent regarder, commenter, envoyer des likes, interagir avec le présentateur et consulter ou acheter les produits présentés.

L'expérience doit être proche de TikTok LIVE, avec une attention particulière portée à :

- La qualité vidéo HD adaptative.
- La stabilité du streaming.
- La continuité audio lors du branchement ou débranchement d'un casque.
- Les filtres AR en temps réel.
- Le suivi naturel des accessoires sur le visage et la tête.
- L'intégration du commerce et des produits ShipShop.

## 1.2 Périmètre fonctionnel

Le système comprend :

1. Création et démarrage d'un LIVE.
2. Prévisualisation caméra avant diffusion.
3. Diffusion vidéo et audio en temps réel.
4. Affichage des spectateurs.
5. Commentaires et réactions en direct.
6. Likes et cadeaux virtuels.
7. Présentation de produits pendant le LIVE.
8. Filtres AR et accessoires virtuels.
9. Gestion du micro, de la caméra et des périphériques audio.
10. Fin du LIVE et statistiques.
11. Gestion des reconnexions et des interruptions réseau.
12. Modération et sécurité.

---

# 2. PDR — Product Design Requirements

## 2.1 Profils utilisateurs

### Présentateur

Le présentateur doit pouvoir :

- Démarrer et terminer un LIVE.
- Activer ou désactiver son microphone.
- Basculer entre caméra avant et arrière.
- Choisir la qualité vidéo.
- Activer des filtres AR.
- Afficher des produits pendant la diffusion.
- Lire les commentaires.
- Voir le nombre de spectateurs.
- Recevoir des likes et des cadeaux.
- Continuer le LIVE lorsqu'un périphérique audio est connecté ou déconnecté, dans les limites imposées par Android et le périphérique.

### Spectateur

Le spectateur doit pouvoir :

- Rejoindre un LIVE.
- Regarder la vidéo.
- Écouter le présentateur.
- Envoyer des commentaires.
- Envoyer des likes.
- Envoyer des cadeaux virtuels.
- Consulter les produits présentés.
- Accéder à la fiche d'un produit.
- Quitter le LIVE.

### Administrateur et modérateur

L'administration doit permettre :

- De surveiller les LIVE actifs.
- De supprimer des commentaires.
- De bloquer ou exclure un utilisateur.
- De terminer un LIVE si nécessaire.
- De traiter les signalements.
- De consulter les statistiques et événements de modération.

## 2.2 Écrans à prévoir

| Écran | Fonction |
|---|---|
| Préparation du LIVE | Prévisualisation, titre, caméra et filtres |
| Diffusion LIVE | Vidéo, commentaires, likes, spectateurs et produits |
| Visionnage LIVE | Lecture vidéo et interactions |
| Sélection des filtres | Choix des effets AR |
| Catalogue de cadeaux | Envoi de cadeaux virtuels |
| Produits du LIVE | Affichage et consultation des produits |
| Résumé du LIVE | Durée, vues et statistiques |
| Modération | Signalements et gestion des utilisateurs |

## 2.3 Interface du présentateur

L'écran de diffusion doit afficher :

- La vidéo caméra en plein écran.
- Un bouton de démarrage ou de fin.
- Le contrôle du microphone.
- Le changement de caméra.
- Le choix des filtres.
- Le choix de la qualité vidéo.
- Le nombre de spectateurs.
- Les commentaires.
- Les réactions.
- L'accès aux produits.
- L'état de la connexion réseau.

Les commandes doivent rester accessibles sans masquer inutilement le visage du présentateur.

## 2.4 Qualité vidéo

Le système doit adapter automatiquement la qualité selon les capacités de l'appareil et le réseau.

| Profil | Résolution | Fréquence cible |
|---|---:|---:|
| Économie | 360p | 24–30 FPS |
| Standard | 480p | 24–30 FPS |
| HD | 720p | 24–30 FPS |
| Full HD | 1080p | 24–30 FPS |

La résolution 1080p ne doit être activée que si le téléphone, le réseau et les capacités d'encodage le permettent.

La priorité est de maintenir une diffusion fluide plutôt que de conserver une résolution élevée au prix de coupures.

## 2.5 Fonctionnalités AR

Les accessoires virtuels doivent suivre les mouvements de la personne de façon naturelle.

### Casquette et chapeau

Le système doit :

- Détecter la tête.
- Estimer son orientation.
- Positionner l'accessoire sur le sommet du crâne.
- Ajuster sa rotation lorsque la tête tourne.
- Adapter sa taille lorsque la personne se rapproche ou s'éloigne.
- Conserver une position stable pendant les mouvements.
- Gérer autant que possible l'occlusion par les cheveux et la tête.

### Lunettes

Le système doit :

- Détecter les yeux.
- Estimer les coins des yeux.
- Détecter ou estimer l'arête du nez.
- Positionner les lunettes correctement.
- Ajuster leur taille et leur rotation.
- Suivre les mouvements de la tête.
- Gérer les rotations et inclinaisons du visage.

### Boucles d'oreilles

Le système doit :

- Détecter les oreilles gauche et droite.
- Positionner chaque boucle sur l'oreille correspondante.
- Suivre la rotation de la tête.
- Adapter la visibilité selon l'orientation.
- Masquer ou réduire la visibilité de la boucle éloignée lorsqu'elle est naturellement cachée.

Si l'oreille n'est pas directement détectable, sa position peut être estimée à partir du maillage facial et de la pose de la tête. Cette estimation doit avoir un niveau de confiance inférieur à celui d'un point d'ancrage directement détecté.

### Exigences générales AR

- Suivi stable, sans tremblement excessif.
- Réaction rapide aux mouvements.
- Repositionnement après perte temporaire du visage.
- Réinitialisation propre lorsque le visage revient dans le champ.
- Gestion de plusieurs orientations du visage.
- Traitement des images dans un ordre temporel cohérent.
- Rendu GPU lorsque possible.

---

# 3. Critères d'acceptation produit

| ID | Exigence | Critère d'acceptation |
|---|---|---|
| PDR-001 | Démarrage LIVE | Le présentateur peut démarrer une diffusion |
| PDR-002 | Fin LIVE | Le présentateur peut arrêter la diffusion |
| PDR-003 | Visionnage | Un spectateur peut rejoindre et regarder |
| PDR-004 | Commentaires | Les commentaires sont transmis en temps réel |
| PDR-005 | Likes | Les réactions sont visibles pendant le LIVE |
| PDR-006 | Produits | Les produits peuvent être affichés pendant la diffusion |
| PDR-007 | Casquette AR | La casquette reste ancrée à la tête |
| PDR-008 | Lunettes AR | Les lunettes suivent les yeux et le nez |
| PDR-009 | Boucles AR | Les boucles suivent les oreilles |
| PDR-010 | Rotation | Les accessoires suivent les rotations de la tête |
| PDR-011 | Casque audio | Le LIVE reste dans le canal RTC lors d'un changement de périphérique |
| PDR-012 | Reconnexion | L'utilisateur peut récupérer sa session après une coupure réseau |
| PDR-013 | Qualité adaptative | La qualité vidéo s'adapte au réseau |
| PDR-014 | Sécurité | Les jetons RTC ne sont pas générés côté client |

---

# 4. TDR — Technical Design Requirements

## 4.1 Architecture générale

L'architecture recommandée repose sur quatre composants principaux :

1. Application React Native.
2. SDK de streaming RTC.
3. SDK de traitement AR.
4. Backend Node.js / Express.

### Technologies recommandées

| Composant | Technologie |
|---|---|
| Application mobile | React Native CLI |
| Langage mobile | TypeScript |
| Couche Android | Kotlin |
| Streaming audio/vidéo | Agora RTC |
| Backend | Node.js |
| API | Express |
| Temps réel applicatif | Socket.IO |
| Authentification | JWT ou système existant |
| Génération des jetons RTC | Agora AccessToken2 |
| Traitement AR | Banuba, DeepAR ou MediaPipe |
| Rendu AR | Pipeline GPU compatible Android |
| Base de données | Base existante de ShipShop |
| Stockage média | Solution de stockage existante ou compatible S3 |

Le choix définitif du SDK AR doit être validé par un prototype sur les appareils Android ciblés.

## 4.2 Architecture logique

```text
                 APPLICATION SHIPSHOP
                         |
                 React Native / TS
                         |
          +--------------+--------------+
          |              |              |
       Interface       Agora RTC       AR Engine
          |              |              |
          |         Audio / Vidéo    Face Tracking
          |              |          Head Tracking
          |              |          3D Anchors
          |              |          GPU Rendering
          |              |              |
          +--------------+--------------+
                         |
                    LIVE Pipeline
                         |
                  Encodage vidéo
                         |
                    Agora Cloud
                         |
                Spectateurs LIVE


                   BACKEND SHIPSHOP
                         |
                   Node.js / Express
                         |
          +--------------+--------------+
          |              |              |
       Authentification  LIVE API     Produits
          |              |              |
          |           Tokens RTC     Catalogue
          |              |              |
          +--------------+--------------+
                         |
                     Socket.IO
                         |
                Événements applicatifs