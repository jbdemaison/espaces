# Installer Espaces sur un serveur

Cette configuration lance toute l'application sur **un seul serveur** avec
Docker Compose : l'application, la connexion (Keycloak), le stockage des
fichiers (MinIO), l'édition collaborative et le HTTPS automatique (Caddy).
La visio utilise **LiveKit Cloud** (compte gratuit pour démarrer).

Elle est prévue pour un test ou une petite instance. Pour une grande
installation, voir la documentation Kubernetes du projet.

## Ce qu'il faut avant de commencer

- Un serveur Linux (Ubuntu 24.04) avec **4 vCPU, 8 Go de RAM, 80 Go de disque**
  et une adresse IPv4 publique. Les ports **80 et 443** doivent être ouverts.
- Un nom de domaine, **ou** une adresse gratuite de test du type
  `1-2-3-4.sslip.io` (le script la propose à partir de l'IP du serveur).
- Un compte LiveKit Cloud (https://cloud.livekit.io) : une URL `wss://…`, une
  clé API et un secret.

## Installation

Tout se fait sur le serveur, connecté en `root`.

```bash
# 1. Installer Docker (une seule fois)
curl -fsSL https://get.docker.com | sh

# 2. Récupérer la configuration
git clone --branch espaces https://github.com/jbdemaison/espaces.git /opt/espaces
cd /opt/espaces/deploy/espaces

# 3. Générer les adresses, les mots de passe et les clés (UNE seule fois)
bash preparer.sh

# 4. Télécharger les images et démarrer les bases de données
docker compose pull
docker compose up -d postgresql redis yhub-valkey

# 5. Créer les tables (application, puis édition collaborative)
docker compose run --rm backend python manage.py migrate
docker compose run --rm yhub yarn init-db

# 6. Tout démarrer
docker compose up -d
```

Les certificats HTTPS sont obtenus tout seuls au premier accès (compter une
minute). Suivre le démarrage : `docker compose ps` et `docker compose logs -f backend`.

## Créer le premier utilisateur

1. Ouvrir `https://id.<votre domaine>` → **Administration Console**, se connecter
   avec `admin` et le mot de passe affiché par `preparer.sh` (aussi dans `env.d/keycloak`).
2. Choisir le domaine (*realm*) **docs** (menu en haut à gauche).
3. **Users → Create new user** : renseigner l'e-mail (cocher *Email verified*),
   puis, dans l'onglet **Credentials**, **Set password** (décocher *Temporary*).
4. Se connecter sur `https://docs.<votre domaine>` avec cet utilisateur.

## Visio : brancher le webhook de LiveKit

Dans la console LiveKit Cloud → **Settings → Webhooks**, ajouter
`https://docs.<votre domaine>/api/v1.0/livekit/webhook/`, signé avec la clé API
renseignée dans `preparer.sh`. C'est ce qui permet d'afficher qui est présent
dans chaque salon.

## Au quotidien

| Besoin | Commande |
|---|---|
| Voir l'état | `docker compose ps` |
| Lire les journaux d'un service | `docker compose logs -f --tail 100 backend` |
| Redémarrer un service | `docker compose restart backend` |
| Mettre à jour | `git pull && docker compose pull && docker compose up -d` puis les deux commandes de l'étape 5 |
| Arrêter | `docker compose down` (les données restent dans `data/`) |

## À sauvegarder

Le dossier `data/` (bases de données, fichiers), le dossier `keys/` et les
fichiers `.env`, `env.d/`. Sans eux, les données ne sont pas récupérables.
Aucun de ces éléments n'est dans Git.

## Installer sa propre copie

Les images sont publiées par GitHub dans le compte qui possède le dépôt. Pour
utiliser un fork, ajouter dans `.env` :

```
IMAGE_REPO=ghcr.io/<votre-identifiant>/<votre-depot>
```
