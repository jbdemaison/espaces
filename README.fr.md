<p align="center">
  <a href="CONTRIBUTING.md">
    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  </a>
  <a href="LICENSE">
    <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg"/>
  </a>
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="deploy/espaces/README.md">Auto-hébergement</a> •
  <a href="documentation/">Documentation</a> •
  <a href="https://github.com/suitenumerique/docs">La Suite Docs (projet d'origine)</a>
</p>

# Espaces : un bureau virtuel pour les équipes à distance

**Espaces offre aux équipes distribuées un lieu où se retrouver : des salons vidéo permanents, la présence de chacun et les documents de l'équipe, réunis dans un même espace.**

Espaces est une contribution à [La Suite numérique](https://lasuite.numerique.gouv.fr/) : un nouvel outil pour faciliter la collaboration à distance au sein des équipes, dans l'esprit d'un *bureau virtuel*. Il s'appuie sur [La Suite Docs](https://github.com/suitenumerique/docs) et y ajoute des salons vidéo reposant sur [LiveKit](https://livekit.io/). Tout ce que fait Docs (édition en temps réel, partage, droits d'accès, sous-pages) reste disponible.

## Qu'est-ce qu'Espaces ?

La visioconférence convient aux réunions planifiées, beaucoup moins aux petits moments de la vie de bureau : « est-ce qu'elle est disponible ? », « je peux te poser une question ? », « on regarde ça ensemble dix minutes ». Espaces recrée ces moments pour les équipes à distance.

- Un **espace** est le bureau virtuel de l'équipe. Il contient ses documents et ses salons.
- Un **salon** est une salle vidéo permanente à l'intérieur d'un espace. Personne ne le planifie et il n'y a pas de lien à envoyer : on entre, on sort, et chacun voit qui s'y trouve.
- La **présence** se lit d'un coup d'œil, comme les salons vocaux de Discord : sous le nom de chaque salon, les personnes qui y sont.

***Conçu pour les organisations publiques, les entreprises et les communautés ouvertes, et auto-hébergeable.***

## Fonctionnalités

### Salons

- Salons vidéo permanents dans un espace, avec caméra, micro et partage d'écran
- Messagerie texte dans le salon
- Les personnes présentes dans chaque salon sont listées sous son nom, avec leur avatar
- Les propriétaires de l'espace créent, renomment et **réordonnent les salons par glisser-déposer**, avec la même arborescence que pour les documents
- L'accès suit celui de l'espace : qui peut ouvrir l'espace peut rejoindre ses salons

### Statut et disponibilité

- Un **statut** indique la situation de chacun dans l'espace (par exemple *Disponible*, *Je reviens bientôt*, *Ne pas déranger*, ou un emoji et un court texte personnalisés). Il s'efface seul au bout de 12 heures : personne ne reste « ne pas déranger » par oubli.
- **Joignable** est un réglage à part, indépendant du statut : il signifie « vous pouvez m'inviter à rejoindre un salon ». Il fonctionne d'un espace à l'autre, si bien qu'une personne déjà dans un salon peut être invitée dans un autre.
- Les personnes joignables sont repérées par 👋, y compris lorsqu'elles sont dans un salon.

### Invitations

- Inviter un collègue joignable dans un salon en quelques clics, avec un court message facultatif
- L'invitation lui parvient où qu'il soit dans Espaces, et expire au bout d'une minute
- Des refus explicites quand la personne n'est pas joignable, occupée, hors ligne ou déjà dans le salon

### Sons d'ambiance

- De courts effets sonores ajoutés par les personnes qui peuvent modifier l'espace (à partir d'un fichier de 20 secondes au plus, les 5 meilleures secondes sont conservées)
- Un clic joue le son pour tous les présents du salon : il passe par l'application, pas par le micro
- Chacun règle son propre volume et peut couper le son

### Documents (hérités de La Suite Docs)

- Édition de texte riche et Markdown, collaboration en temps réel, commentaires et partage
- Sous-pages et hiérarchie, contenu consultable, droits d'accès fins
- Import et export (`.docx`, `.md`, `.odt`, `.pdf`), mode présentation, aides IA facultatives

## Auto-hébergement

Espaces fonctionne sur un seul serveur avec Docker Compose : l'application, la connexion (Keycloak), le stockage des fichiers (MinIO), l'édition en temps réel et le HTTPS automatique (Caddy). La visio utilise [LiveKit Cloud](https://livekit.io/cloud) ou votre propre serveur LiveKit.

Pour commencer : [guide d'installation](deploy/espaces/README.md)

Les images de conteneurs sont construites par GitHub Actions à partir de ce dépôt (workflow `Build and Push to GHCR`) :

| Service | Image |
|---|---|
| Application (API) | `ghcr.io/jbdemaison/espaces/backend:espaces` |
| Interface | `ghcr.io/jbdemaison/espaces/frontend:espaces` |
| Édition en temps réel | `ghcr.io/jbdemaison/espaces/yhub:espaces` |
| Conversion de documents | `ghcr.io/jbdemaison/espaces/y-provider:espaces` |

Les autres méthodes d'installation de La Suite Docs (Kubernetes, autres configurations Docker Compose) sont décrites dans [documentation/installation](documentation/installation/README.md), pour la partie documents du produit.

> [!WARNING]
> Certaines fonctions avancées héritées de Docs (par exemple : `Exporter en PDF`) reposent sur des paquets XL de Blocknote.
> Ces paquets sont sous licence GPL et **ne sont pas compatibles MIT**.
>
> Vous pouvez faire fonctionner Espaces **sans ces paquets** en construisant avec :
>
> ```bash
> PUBLISH_AS_MIT=true
> ```
>
> Plus de détails dans les [variables d'environnement](documentation/env.md).

## Développement local (pour les contributeurs)

> [!WARNING]
> Cette configuration est destinée **au développement et aux tests uniquement**. Elle utilise des clés et des mots de passe de développement fixes.

### Prérequis

- Docker et Docker Compose
- GNU Make

```bash
docker -v
docker compose version
```

### Initialiser et lancer

```bash
make bootstrap FLUSH_ARGS='--no-input'
make run
```

Ouvrir <http://localhost:3000>. Identifiants par défaut (développement uniquement) : `impress` / `impress`.

`make run` démarre aussi un serveur LiveKit local pour les salons vidéo. Pour que d'autres navigateurs ou ordinateurs puissent s'y connecter, renseignez `LIVEKIT_NODE_IP` avec l'adresse de la machine qui exécute Docker (Firefox ignore `127.0.0.1`).

### Interface seule

```bash
make frontend-development-install
make run-frontend-development
```

### Tests et analyse du code

```bash
make frontend-test
make frontend-lint
make test-back
```

### Et aussi

```bash
make help        # toutes les cibles Make
make demo        # contenu de démonstration
make superuser   # administrateur Django, interface sur http://localhost:8071/admin
```

## Contribuer

Ce projet est porté par la communauté et les contributions sont les bienvenues.

- [Guide de contribution](CONTRIBUTING.md)
- Tickets et propositions : <https://github.com/jbdemaison/espaces/issues>

## Lien avec La Suite Docs

Espaces est un fork de [La Suite Docs](https://github.com/suitenumerique/docs) (MIT). Les salons, statuts, invitations et sons d'ambiance sont ajoutés par-dessus, côté serveur (`core/services/livekit_*`) et côté interface (`features/rooms`). Autant que possible, ils réutilisent les composants et les conventions de La Suite (système de design, arbre des documents, droits d'accès) plutôt que d'en créer de parallèles, afin de pouvoir être proposés en retour au projet d'origine.

## Licence 📝

Cette œuvre est publiée sous licence MIT (voir [LICENSE](LICENSE)). Elle inclut le travail de La Suite Docs, © 2023 Direction Interministérielle du Numérique - Gouvernement Français, sous la même licence.

## Crédits ❤️

### Technologies

Espaces repose sur [La Suite Docs](https://github.com/suitenumerique/docs), [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [LiveKit](https://livekit.io/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/) et [Yjs](https://yjs.dev/). Merci aux contributeurs de tous ces projets pour leur excellent travail !

---

### Gov ❤️ open source

La Suite Docs est le fruit d'une initiative conjointe menée par le gouvernement français 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) et le gouvernement allemand 🇩🇪 ([ZenDiS](https://zendis.de/)). Espaces s'appuie sur ce travail.
