diff --git a/README.fr.md b/README.fr.md
new file mode 100644
index 0000000..bbd7729
--- /dev/null
+++ b/README.fr.md
@@ -0,0 +1,170 @@
+<p align="center">
+  <a href="CONTRIBUTING.md">
+    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
+  </a>
+  <a href="LICENSE">
+    <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-blue.svg"/>
+  </a>
+</p>
+
+<p align="center">
+  <a href="README.md">English</a> •
+  <a href="deploy/espaces/README.md">Auto-hébergement</a> •
+  <a href="documentation/">Documentation</a> •
+  <a href="https://github.com/suitenumerique/docs">La Suite Docs (projet d'origine)</a>
+</p>
+
+# Espaces : un bureau virtuel pour les équipes à distance
+
+**Espaces offre aux équipes distribuées un lieu où se retrouver : des salons vidéo permanents, la présence de chacun et les documents de l'équipe, réunis dans un même espace.**
+
+Espaces est une contribution à [La Suite numérique](https://lasuite.numerique.gouv.fr/) : un nouvel outil pour faciliter la collaboration à distance au sein des équipes, dans l'esprit d'un *bureau virtuel*. Il s'appuie sur [La Suite Docs](https://github.com/suitenumerique/docs) et y ajoute des salons vidéo reposant sur [LiveKit](https://livekit.io/). Tout ce que fait Docs (édition en temps réel, partage, droits d'accès, sous-pages) reste disponible.
+
+## Qu'est-ce qu'Espaces ?
+
+La visioconférence convient aux réunions planifiées, beaucoup moins aux petits moments de la vie de bureau : « est-ce qu'elle est disponible ? », « je peux te poser une question ? », « on regarde ça ensemble dix minutes ». Espaces recrée ces moments pour les équipes à distance.
+
+- Un **espace** est le bureau virtuel de l'équipe. Il contient ses documents et ses salons.
+- Un **salon** est une salle vidéo permanente à l'intérieur d'un espace. Personne ne le planifie et il n'y a pas de lien à envoyer : on entre, on sort, et chacun voit qui s'y trouve.
+- La **présence** se lit d'un coup d'œil, comme les salons vocaux de Discord : sous le nom de chaque salon, les personnes qui y sont.
+
+***Conçu pour les organisations publiques, les entreprises et les communautés ouvertes, et auto-hébergeable.***
+
+## Fonctionnalités
+
+### Salons
+
+- Salons vidéo permanents dans un espace, avec caméra, micro et partage d'écran
+- Messagerie texte dans le salon
+- Les personnes présentes dans chaque salon sont listées sous son nom, avec leur avatar
+- Les propriétaires de l'espace créent, renomment et **réordonnent les salons par glisser-déposer**, avec la même arborescence que pour les documents
+- L'accès suit celui de l'espace : qui peut ouvrir l'espace peut rejoindre ses salons
+
+### Statut et disponibilité
+
+- Un **statut** indique la situation de chacun dans l'espace (par exemple *Disponible*, *Je reviens bientôt*, *Ne pas déranger*, ou un emoji et un court texte personnalisés). Il s'efface seul au bout de 12 heures : personne ne reste « ne pas déranger » par oubli.
+- **Joignable** est un réglage à part, indépendant du statut : il signifie « vous pouvez m'inviter à rejoindre un salon ». Il fonctionne d'un espace à l'autre, si bien qu'une personne déjà dans un salon peut être invitée dans un autre.
+- Les personnes joignables sont repérées par 👋, y compris lorsqu'elles sont dans un salon.
+
+### Invitations
+
+- Inviter un collègue joignable dans un salon en quelques clics, avec un court message facultatif
+- L'invitation lui parvient où qu'il soit dans Espaces, et expire au bout d'une minute
+- Des refus explicites quand la personne n'est pas joignable, occupée, hors ligne ou déjà dans le salon
+
+### Sons d'ambiance
+
+- De courts effets sonores ajoutés par les personnes qui peuvent modifier l'espace (à partir d'un fichier de 20 secondes au plus, les 5 meilleures secondes sont conservées)
+- Un clic joue le son pour tous les présents du salon : il passe par l'application, pas par le micro
+- Chacun règle son propre volume et peut couper le son
+
+### Documents (hérités de La Suite Docs)
+
+- Édition de texte riche et Markdown, collaboration en temps réel, commentaires et partage
+- Sous-pages et hiérarchie, contenu consultable, droits d'accès fins
+- Import et export (`.docx`, `.md`, `.odt`, `.pdf`), mode présentation, aides IA facultatives
+
+## Auto-hébergement
+
+Espaces fonctionne sur un seul serveur avec Docker Compose : l'application, la connexion (Keycloak), le stockage des fichiers (MinIO), l'édition en temps réel et le HTTPS automatique (Caddy). La visio utilise [LiveKit Cloud](https://livekit.io/cloud) ou votre propre serveur LiveKit.
+
+Pour commencer : [guide d'installation](deploy/espaces/README.md)
+
+Les images de conteneurs sont construites par GitHub Actions à partir de ce dépôt (workflow `Build and Push to GHCR`) :
+
+| Service | Image |
+|---|---|
+| Application (API) | `ghcr.io/jbdemaison/espaces/backend:espaces` |
+| Interface | `ghcr.io/jbdemaison/espaces/frontend:espaces` |
+| Édition en temps réel | `ghcr.io/jbdemaison/espaces/yhub:espaces` |
+| Conversion de documents | `ghcr.io/jbdemaison/espaces/y-provider:espaces` |
+
+Les autres méthodes d'installation de La Suite Docs (Kubernetes, autres configurations Docker Compose) sont décrites dans [documentation/installation](documentation/installation/README.md), pour la partie documents du produit.
+
+> [!WARNING]
+> Certaines fonctions avancées héritées de Docs (par exemple : `Exporter en PDF`) reposent sur des paquets XL de Blocknote.
+> Ces paquets sont sous licence GPL et **ne sont pas compatibles MIT**.
+>
+> Vous pouvez faire fonctionner Espaces **sans ces paquets** en construisant avec :
+>
+> ```bash
+> PUBLISH_AS_MIT=true
+> ```
+>
+> Plus de détails dans les [variables d'environnement](documentation/env.md).
+
+## Développement local (pour les contributeurs)
+
+> [!WARNING]
+> Cette configuration est destinée **au développement et aux tests uniquement**. Elle utilise des clés et des mots de passe de développement fixes.
+
+### Prérequis
+
+- Docker et Docker Compose
+- GNU Make
+
+```bash
+docker -v
+docker compose version
+```
+
+### Initialiser et lancer
+
+```bash
+make bootstrap FLUSH_ARGS='--no-input'
+make run
+```
+
+Ouvrir <http://localhost:3000>. Identifiants par défaut (développement uniquement) : `impress` / `impress`.
+
+`make run` démarre aussi un serveur LiveKit local pour les salons vidéo. Pour que d'autres navigateurs ou ordinateurs puissent s'y connecter, renseignez `LIVEKIT_NODE_IP` avec l'adresse de la machine qui exécute Docker (Firefox ignore `127.0.0.1`).
+
+### Interface seule
+
+```bash
+make frontend-development-install
+make run-frontend-development
+```
+
+### Tests et analyse du code
+
+```bash
+make frontend-test
+make frontend-lint
+make test-back
+```
+
+### Et aussi
+
+```bash
+make help        # toutes les cibles Make
+make demo        # contenu de démonstration
+make superuser   # administrateur Django, interface sur http://localhost:8071/admin
+```
+
+## Contribuer
+
+Ce projet est porté par la communauté et les contributions sont les bienvenues.
+
+- [Guide de contribution](CONTRIBUTING.md)
+- Tickets et propositions : <https://github.com/jbdemaison/espaces/issues>
+
+## Lien avec La Suite Docs
+
+Espaces est un fork de [La Suite Docs](https://github.com/suitenumerique/docs) (MIT). Les salons, statuts, invitations et sons d'ambiance sont ajoutés par-dessus, côté serveur (`core/services/livekit_*`) et côté interface (`features/rooms`). Autant que possible, ils réutilisent les composants et les conventions de La Suite (système de design, arbre des documents, droits d'accès) plutôt que d'en créer de parallèles, afin de pouvoir être proposés en retour au projet d'origine.
+
+## Licence 📝
+
+Cette œuvre est publiée sous licence MIT (voir [LICENSE](LICENSE)). Elle inclut le travail de La Suite Docs, © 2023 Direction Interministérielle du Numérique - Gouvernement Français, sous la même licence.
+
+## Crédits ❤️
+
+### Technologies
+
+Espaces repose sur [La Suite Docs](https://github.com/suitenumerique/docs), [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [LiveKit](https://livekit.io/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/) et [Yjs](https://yjs.dev/). Merci aux contributeurs de tous ces projets pour leur excellent travail !
+
+---
+
+### Gov ❤️ open source
+
+La Suite Docs est le fruit d'une initiative conjointe menée par le gouvernement français 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) et le gouvernement allemand 🇩🇪 ([ZenDiS](https://zendis.de/)). Espaces s'appuie sur ce travail.
diff --git a/README.md b/README.md
index 790bad8..38a0496 100644
--- a/README.md
+++ b/README.md
@@ -1,292 +1,170 @@
 <p align="center">
-  <a href="https://github.com/suitenumerique/docs">
-    <img alt="Docs" src="documentation/assets/banner-docs.png" width="100%" />
-  </a>
-</p>
-
-<p align="center">
-  <a href="https://github.com/suitenumerique/docs/stargazers/">
-    <img src="https://img.shields.io/github/stars/suitenumerique/docs" alt="">
-  </a>
-  <a href="https://github.com/suitenumerique/docs/blob/main/CONTRIBUTING.md">
+  <a href="https://github.com/jbdemaison/espaces/blob/espaces/CONTRIBUTING.md">
     <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
   </a>
-  <a href="https://github.com/suitenumerique/docs/blob/main/LICENSE">
-    <img alt="MIT License" src="https://img.shields.io/github/license/suitenumerique/docs"/>
-  </a>
-  <a href="https://snyk.io/test/github/suitenumerique/docs">
-    <img alt="MIT License" src="https://snyk.io/test/github/suitenumerique/docs/badge.svg"/>
-  </a>
-  <a href="https://digitalpublicgoods.net/r/docs-collaborative-text-editing">
-    <img src="https://img.shields.io/badge/Verified-DPG-3333AB?logo=data:image/svg%2bxml;base64,PHN2ZyB3aWR0aD0iMzEiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzMSAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0LjIwMDggMjEuMzY3OEwxMC4xNzM2IDE4LjAxMjRMMTEuNTIxOSAxNi40MDAzTDEzLjk5MjggMTguNDU5TDE5LjYyNjkgMTIuMjExMUwyMS4xOTA5IDEzLjYxNkwxNC4yMDA4IDIxLjM2NzhaTTI0LjYyNDEgOS4zNTEyN0wyNC44MDcxIDMuMDcyOTdMMTguODgxIDUuMTg2NjJMMTUuMzMxNCAtMi4zMzA4MmUtMDVMMTEuNzgyMSA1LjE4NjYyTDUuODU2MDEgMy4wNzI5N0w2LjAzOTA2IDkuMzUxMjdMMCAxMS4xMTc3TDMuODQ1MjEgMTYuMDg5NUwwIDIxLjA2MTJMNi4wMzkwNiAyMi44Mjc3TDUuODU2MDEgMjkuMTA2TDExLjc4MjEgMjYuOTkyM0wxNS4zMzE0IDMyLjE3OUwxOC44ODEgMjYuOTkyM0wyNC44MDcxIDI5LjEwNkwyNC42MjQxIDIyLjgyNzdMMzAuNjYzMSAyMS4wNjEyTDI2LjgxNzYgMTYuMDg5NUwzMC42NjMxIDExLjExNzdMMjQuNjI0MSA5LjM1MTI3WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==" alt="DPG Badge"/>
+  <a href="LICENSE">
+    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
   </a>
 </p>
 
 <p align="center">
-  <a href="https://matrix.to/#/#docs-official:matrix.org">Chat on Matrix</a> •
+  <a href="README.fr.md">Français</a> •
+  <a href="deploy/espaces/README.md">Self-hosting</a> •
   <a href="documentation/">Documentation</a> •
-  <a href="#try-docs">Try Docs</a> •
-  <a href="mailto:docs@numerique.gouv.fr">Contact us</a>
+  <a href="https://github.com/suitenumerique/docs">La Suite Docs (upstream)</a>
 </p>
 
-# La Suite Docs: Collaborative Text Editing
-
-**Docs, where your notes can become knowledge through live collaboration.**
-
-Docs is an open-source collaborative editor that helps teams write, organize, and share knowledge together - in real time.
-
-![Live collaboration demo](documentation/assets/mirabeau.png)
-
-
-## What is Docs?
-
-Docs is an open-source alternative to tools like Notion or Google Docs, focused on:
-
-- Real-time collaboration
-- Clean, structured documents
-- Knowledge organization
-- Data ownership & self-hosting
-
-***Built for public organizations, companies, and open communities.***
-
-## Why use Docs?
+# Espaces: a virtual office for remote teams
 
-### Writing
+**Espaces gives distributed teams a place to be together: persistent video rooms, who is around, and the team's documents, all in one space.**
 
-- Rich-text & Markdown editing
-- Slash commands & block system
-- Beautiful formatting
-- Offline editing
-- Optional AI writing helpers (rewrite, summarize, translate, fix typos)
+Espaces is a contribution to [La Suite numérique](https://lasuite.numerique.gouv.fr/): a new tool to make remote collaboration within teams easier, in the spirit of a *virtual office*. It is built on top of [La Suite Docs](https://github.com/suitenumerique/docs) and adds video rooms powered by [LiveKit](https://livekit.io/). Everything Docs does (real-time editing, sharing, access control, subpages) is still there.
 
-### Collaboration
+## What is Espaces?
 
-- Live cursors & presence
-- Comments & sharing
-- Granular access control
+Video calls are good at scheduled meetings and poor at the small moments of office life: "is she free?", "can I ask you something?", "let's pair on this for ten minutes". Espaces reproduces those moments for remote teams.
 
-### Knowledge management
+- A **space** is the team's virtual office. It holds its documents and its rooms.
+- A **room** is a permanent video room inside a space. Nobody schedules it and nobody needs a link: you join, you leave, and everyone can see who is inside.
+- **Presence** is visible at a glance, like the voice channels of Discord: under the name of each room, the people currently in it.
 
-- Subpages & hierarchy
-- Searchable content
+***Built for public organizations, companies and open communities, and self-hostable.***
 
-### Presentations
+## Features
 
-- Simple structure, based on delimiter (`---`)
-- Full screen option
-- PDF exports
-- Keyboard navigation
-- Start presention from a block
-- Presentation link
+### Rooms
 
-![demo of slide mode in Docs](https://upload.wikimedia.org/wikipedia/commons/6/64/Docs%27_slidemode.gif?_=20260722173451)
+- Permanent video rooms inside a space, with camera, microphone and screen sharing
+- Text chat in the room
+- The people in each room are listed under its name, with their avatar
+- Space owners create, rename and **reorder rooms by drag and drop**, with the same tree as for documents
+- Access follows the space: whoever can open the space can join its rooms
 
-### Export/Import
+### Status and availability
 
-- Import to `.docx` and `.md`
-- Export to `.docx`, `.odt`, `.pdf`
+- A **status** shows the situation of each person in the space (for example *Available*, *Back soon*, *Do not disturb*, or a custom emoji and short text). It clears itself after 12 hours, so nobody stays "do not disturb" by accident.
+- **Reachable** is a separate switch, independent of the status: it tells colleagues "you may invite me to join a room". It works across spaces, so people who are in a room can still be asked to join another.
+- Reachable people are marked with 👋, including when they are inside a room.
 
-### AI features
-Docs has optional AI features. 
-They're model agnostic and gateway agnostic.
-You can either run your own or just use your AI provider. 
-The config only requires an API key and a URL.
+### Invitations
 
-#### V1: You select, AI replaces 
-This version features a simple select and replace workflow. 
-Your selection is the context and the instruction for the model. 
-The AI feedback replaces your selection and is designed is optimized for Docs formatting.
+- Invite a reachable colleague to a room in a couple of clicks, with an optional short message
+- The invitation reaches them wherever they are in Espaces, and expires after a minute
+- Clear refusals when the person is not reachable, busy, offline or already in the room
 
-![Demo of Docs AI v1](documentation/assets/docs_ai_feature_v1.gif)
+### Soundboard
 
-#### V2: AI toolbar, AI cursor (beta)
-This version uses [BlockNote AI integration](https://www.blocknotejs.org/docs/features/ai). It features: 
-- an AI toolbar at selection in which you can prompt, accept, reject and iterate AI feedback
-- an AI cursor, which interacts with the document, just as another collaborator in your document
-- document context is used on top of the selection
+- Short sound effects added by the people who can edit the space (from a file of up to 20 seconds, the best 5 seconds are kept)
+- A click plays the sound for everyone in the room: it travels through the app, not the microphone
+- Each person has their own volume and mute
 
-![Demo of Docs AI v2](documentation/assets/docs_ai_feature_v2.gif)
+### Documents (inherited from La Suite Docs)
 
+- Rich-text and Markdown editing, real-time collaboration, comments and sharing
+- Subpages and hierarchy, searchable content, granular access control
+- Import and export (`.docx`, `.md`, `.odt`, `.pdf`), presentation mode, optional AI helpers
 
-### Interoperability
-Docs comes with a [resource server API](documentation/resource_server.md) and a [server to server API](https://github.com/suitenumerique/docs/blob/c647cb62f1cbf1af9841ae8cb3818e34bb566c9c/documentation/env.md#L76-L77) which allows for awesome integrations.
-
-#### A concrete example: [Meet](https://github.com/suitenumerique/meet/)'s transcriptions
-If you're running a Meet instance, with simple config (`DJANGO_SERVER_TO_SERVER_API_TOKENS`) you can push your meeting transcript to Docs and give access to the user who requested it.
-
-![transcript in Docs screenshot](documentation/assets/transcripts.png)
-
-## Try Docs
-
-Experience Docs instantly - no installation required.
+## Self-hosting
 
-- 🔗 [Open a live demo document][demo]
-- 🌍 [Browse public instances][instances]
+Espaces runs on a single server with Docker Compose: the application, sign-in (Keycloak), file storage (MinIO), real-time editing and automatic HTTPS (Caddy). Video uses [LiveKit Cloud](https://livekit.io/cloud) or your own LiveKit server.
 
-[demo]: https://demo.docs.la-suite.eu/docs/6d1b6f7f-db33-4673-9277-4bf47b9881ec/
-[instances]: documentation/instances.md
+Get started: [Installation guide](deploy/espaces/README.md)
 
-## Self-hosting
+Container images are built by GitHub Actions from this repository (workflow `Build and Push to GHCR`):
 
-Docs supports Kubernetes, Docker Compose, and community-provided methods such as Nix and YunoHost.
+| Service | Image |
+|---|---|
+| Application (API) | `ghcr.io/jbdemaison/espaces/backend:espaces` |
+| Interface | `ghcr.io/jbdemaison/espaces/frontend:espaces` |
+| Real-time editing | `ghcr.io/jbdemaison/espaces/yhub:espaces` |
+| Document conversion | `ghcr.io/jbdemaison/espaces/y-provider:espaces` |
 
-Get started with self-hosting: [Installation guide](documentation/installation/README.md)
+La Suite Docs installation methods (Kubernetes, other Docker Compose layouts) are documented in [documentation/installation](documentation/installation/README.md) for the document side of the product.
 
 > [!WARNING]
-> Some advanced features (for example: `Export as PDF`) rely on XL packages from Blocknote.
-> These packages are licensed under GPL and are **not MIT-compatible**
+> Some advanced features inherited from Docs (for example: `Export as PDF`) rely on XL packages from Blocknote.
+> These packages are licensed under GPL and are **not MIT-compatible**.
 >
-> You can run Docs **without these packages** by building with:
+> You can run Espaces **without these packages** by building with:
 >
 > ```bash
 > PUBLISH_AS_MIT=true
 > ```
 >
-> This builds an image of Docs without non-MIT features.
->
-> More details can be found in [environment variables](documentation/env.md)
-
-## Local Development (for contributors)
+> More details can be found in [environment variables](documentation/env.md).
 
-Run Docs locally for development and testing.
+## Local development (for contributors)
 
 > [!WARNING]
-> This setup is intended **for development and testing only**.
-> It uses Minio as an S3-compatible storage backend, but any S3-compatible service can be used.
+> This setup is intended **for development and testing only**. It uses fixed development keys and passwords.
 
 ### Prerequisites
 
-- Docker
-- Docker Compose
+- Docker and Docker Compose
 - GNU Make
 
-Verify installation:
-
 ```bash
 docker -v
 docker compose version
 ```
 
-> If you encounter permission errors, you may need to use `sudo`, or add your user to the `docker` group.
-
-### Bootstrap the project
-
-The easiest way to start is using GNU Make:
+### Bootstrap and run
 
 ```bash
 make bootstrap FLUSH_ARGS='--no-input'
-```
-
-This builds the `app-dev` and `frontend-dev` containers, installs dependencies, runs database migrations, and compiles translations.
-
-It is recommended to run this command after pulling new code.
-
-Start services:
-
-```bash
 make run
 ```
 
-Open <https://localhost:3000>
-
-Default credentials (development only):
-
-```md
-username: impress
-password: impress
-```
+Open <http://localhost:3000>. Default credentials (development only): `impress` / `impress`.
 
-### Frontend development mode
+`make run` also starts a local LiveKit server for the video rooms. For other browsers or computers to join, set `LIVEKIT_NODE_IP` to the address of the machine running Docker (Firefox ignores `127.0.0.1`).
 
-For frontend work, running outside Docker is often more convenient:
+### Frontend only
 
 ```bash
 make frontend-development-install
 make run-frontend-development
 ```
 
-### Backend only
-
-Starting all services except the frontend container:
-
-```bash
-make run-backend
-```
-
-### Tests & Linting
+### Tests and linting
 
 ```bash
 make frontend-test
 make frontend-lint
+make test-back
 ```
 
-Backend tests can be run without docker. This is useful to configure PyCharm or VSCode to do it. 
-Removing docker for testing requires to overwrite some URL and port values that are different in and out of 
-Docker. `env.d/development/common` contains all variables, some of them having to be overwritten by those in
-`env.d/development/common.test`.
-
-### Demo content
-
-Create a basic demo site:
-
-```bash
-make demo
-```
-
-### More Make targets
-
-To check all available Make rules:
-
-```bash
-make help
-```
-
-### Django admin
-
-Create a superuser:
+### More
 
 ```bash
-make superuser
+make help        # all the Make targets
+make demo        # demo content
+make superuser   # Django admin user, admin UI on http://localhost:8071/admin
 ```
 
-Admin UI: <http://localhost:8071/admin>
-
 ## Contributing
 
-This project is community-driven and PRs are welcome.
+This project is community-driven and contributions are welcome.
 
 - [Contribution guide](CONTRIBUTING.md)
-- [Translations](https://crowdin.com/project/lasuite-docs)
-- [Chat with us!](https://matrix.to/#/#docs-official:matrix.org)
+- Issues and proposals: <https://github.com/jbdemaison/espaces/issues>
 
-## Roadmap
+## Relationship with La Suite Docs
 
-Curious where Docs is headed?
-
-Explore upcoming features, priorities and long-term direction on our [public roadmap](https://docs.numerique.gouv.fr/docs/d1d3788e-c619-41ff-abe8-2d079da2f084/).
+Espaces is a fork of [La Suite Docs](https://github.com/suitenumerique/docs) (MIT). The rooms, status, invitations and soundboard are added on top of it, in the backend (`core/services/livekit_*`) and in the frontend (`features/rooms`). Where possible they reuse the components and conventions of La Suite (design system, document tree, accesses) rather than adding parallel ones, so that they can be proposed back upstream.
 
 ## License 📝
 
-This work is released under the MIT License (see [LICENSE](https://github.com/suitenumerique/docs/blob/main/LICENSE)).
-
-While Docs is a public-driven initiative, our license choice is an invitation for private sector actors to use, sell and contribute to the project.
+This work is released under the MIT License (see [LICENSE](LICENSE)). It includes the work of La Suite Docs, © 2023 Direction Interministérielle du Numérique - Gouvernement Français, under the same license.
 
 ## Credits ❤️
 
 ### Stack
 
-Docs is built on top of [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/), [HocusPocus](https://tiptap.dev/docs/hocuspocus/introduction), and [Yjs](https://yjs.dev/). We thank the contributors of all these projects for their awesome work!
-
-We are proud sponsors of [BlockNotejs](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/).
+Espaces is built on top of [La Suite Docs](https://github.com/suitenumerique/docs), [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [LiveKit](https://livekit.io/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/). We thank the contributors of all these projects for their awesome work!
 
 ---
 
 ### Gov ❤️ open source
 
-Docs is the result of a joint initiative led by the French 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) Government and German 🇩🇪 government ([ZenDiS](https://zendis.de/)).
-
-We are always looking for new public partners (we are currently onboarding the Netherlands 🇳🇱), feel free to [contact us](mailto:docs@numerique.gouv.fr) if you are interested in using or contributing to Docs.
-
-<p align="center">
-  <img src="documentation/assets/europe_opensource.png" width="50%"/ alt="Europe Opensource">
-</p>
+La Suite Docs is the result of a joint initiative led by the French 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) Government and German 🇩🇪 government ([ZenDiS](https://zendis.de/)). Espaces builds on that work.
