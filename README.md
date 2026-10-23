<p align="center">
  <a href="https://github.com/jbdemaison/espaces/blob/espaces/CONTRIBUTING.md">
    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
  </a>
  <a href="LICENSE">
    <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

<p align="center">
  <a href="README.fr.md">Français</a> •
  <a href="deploy/espaces/README.md">Self-hosting</a> •
  <a href="documentation/">Documentation</a> •
  <a href="https://github.com/suitenumerique/docs">La Suite Docs (upstream)</a>
</p>

# Espaces: a virtual office for remote teams

**Espaces gives distributed teams a place to be together: persistent video rooms, who is around, and the team's documents, all in one space.**

Espaces is a contribution to [La Suite numérique](https://lasuite.numerique.gouv.fr/): a new tool to make remote collaboration within teams easier, in the spirit of a *virtual office*. It is built on top of [La Suite Docs](https://github.com/suitenumerique/docs) and adds video rooms powered by [LiveKit](https://livekit.io/). Everything Docs does (real-time editing, sharing, access control, subpages) is still there.

## What is Espaces?

Video calls are good at scheduled meetings and poor at the small moments of office life: "is she free?", "can I ask you something?", "let's pair on this for ten minutes". Espaces reproduces those moments for remote teams.

- A **space** is the team's virtual office. It holds its documents and its rooms.
- A **room** is a permanent video room inside a space. Nobody schedules it and nobody needs a link: you join, you leave, and everyone can see who is inside.
- **Presence** is visible at a glance, like the voice channels of Discord: under the name of each room, the people currently in it.

***Built for public organizations, companies and open communities, and self-hostable.***

## Features

### Rooms

- Permanent video rooms inside a space, with camera, microphone and screen sharing
- Text chat in the room
- The people in each room are listed under its name, with their avatar
- Space owners create, rename and **reorder rooms by drag and drop**, with the same tree as for documents
- Access follows the space: whoever can open the space can join its rooms

### Status and availability

- A **status** shows the situation of each person in the space (for example *Available*, *Back soon*, *Do not disturb*, or a custom emoji and short text). It clears itself after 12 hours, so nobody stays "do not disturb" by accident.
- **Reachable** is a separate switch, independent of the status: it tells colleagues "you may invite me to join a room". It works across spaces, so people who are in a room can still be asked to join another.
- Reachable people are marked with 👋, including when they are inside a room.

### Invitations

- Invite a reachable colleague to a room in a couple of clicks, with an optional short message
- The invitation reaches them wherever they are in Espaces, and expires after a minute
- Clear refusals when the person is not reachable, busy, offline or already in the room

### Soundboard

- Short sound effects added by the people who can edit the space (from a file of up to 20 seconds, the best 5 seconds are kept)
- A click plays the sound for everyone in the room: it travels through the app, not the microphone
- Each person has their own volume and mute

### Documents (inherited from La Suite Docs)

- Rich-text and Markdown editing, real-time collaboration, comments and sharing
- Subpages and hierarchy, searchable content, granular access control
- Import and export (`.docx`, `.md`, `.odt`, `.pdf`), presentation mode, optional AI helpers

## Self-hosting

Espaces runs on a single server with Docker Compose: the application, sign-in (Keycloak), file storage (MinIO), real-time editing and automatic HTTPS (Caddy). Video uses [LiveKit Cloud](https://livekit.io/cloud) or your own LiveKit server.

Get started: [Installation guide](deploy/espaces/README.md)

Container images are built by GitHub Actions from this repository (workflow `Build and Push to GHCR`):

| Service | Image |
|---|---|
| Application (API) | `ghcr.io/jbdemaison/espaces/backend:espaces` |
| Interface | `ghcr.io/jbdemaison/espaces/frontend:espaces` |
| Real-time editing | `ghcr.io/jbdemaison/espaces/yhub:espaces` |
| Document conversion | `ghcr.io/jbdemaison/espaces/y-provider:espaces` |

La Suite Docs installation methods (Kubernetes, other Docker Compose layouts) are documented in [documentation/installation](documentation/installation/README.md) for the document side of the product.

> [!WARNING]
> Some advanced features inherited from Docs (for example: `Export as PDF`) rely on XL packages from Blocknote.
> These packages are licensed under GPL and are **not MIT-compatible**.
>
> You can run Espaces **without these packages** by building with:
>
> ```bash
> PUBLISH_AS_MIT=true
> ```
>
> More details can be found in [environment variables](documentation/env.md).

## Local development (for contributors)

> [!WARNING]
> This setup is intended **for development and testing only**. It uses fixed development keys and passwords.

### Prerequisites

- Docker and Docker Compose
- GNU Make

```bash
docker -v
docker compose version
```

### Bootstrap and run

```bash
make bootstrap FLUSH_ARGS='--no-input'
make run
```

Open <http://localhost:3000>. Default credentials (development only): `impress` / `impress`.

`make run` also starts a local LiveKit server for the video rooms. For other browsers or computers to join, set `LIVEKIT_NODE_IP` to the address of the machine running Docker (Firefox ignores `127.0.0.1`).

### Frontend only

```bash
make frontend-development-install
make run-frontend-development
```

### Tests and linting

```bash
make frontend-test
make frontend-lint
make test-back
```

### More

```bash
make help        # all the Make targets
make demo        # demo content
make superuser   # Django admin user, admin UI on http://localhost:8071/admin
```

## Contributing

This project is community-driven and contributions are welcome.

- [Contribution guide](CONTRIBUTING.md)
- Issues and proposals: <https://github.com/jbdemaison/espaces/issues>

## Relationship with La Suite Docs

Espaces is a fork of [La Suite Docs](https://github.com/suitenumerique/docs) (MIT). The rooms, status, invitations and soundboard are added on top of it, in the backend (`core/services/livekit_*`) and in the frontend (`features/rooms`). Where possible they reuse the components and conventions of La Suite (design system, document tree, accesses) rather than adding parallel ones, so that they can be proposed back upstream.

## License 📝

This work is released under the MIT License (see [LICENSE](LICENSE)). It includes the work of La Suite Docs, © 2023 Direction Interministérielle du Numérique - Gouvernement Français, under the same license.

## Credits ❤️

### Stack

Espaces is built on top of [La Suite Docs](https://github.com/suitenumerique/docs), [Django Rest Framework](https://www.django-rest-framework.org/), [Next.js](https://nextjs.org/), [LiveKit](https://livekit.io/), [ProseMirror](https://prosemirror.net/), [BlockNote.js](https://www.blocknotejs.org/) and [Yjs](https://yjs.dev/). We thank the contributors of all these projects for their awesome work!

---

### Gov ❤️ open source

La Suite Docs is the result of a joint initiative led by the French 🇫🇷 ([DINUM](https://www.numerique.gouv.fr/dinum/)) Government and German 🇩🇪 government ([ZenDiS](https://zendis.de/)). Espaces builds on that work.
