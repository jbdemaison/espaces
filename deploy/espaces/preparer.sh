#!/bin/bash
# Prépare la configuration d'Espaces sur le serveur : adresses, mots de passe,
# clés de signature. À lancer UNE SEULE FOIS, depuis le dossier qui contient ce fichier.
#   bash preparer.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v openssl >/dev/null || { echo "openssl est requis (apt install -y openssl)"; exit 1; }

if [ -f .env ]; then
  echo "Un fichier .env existe déjà : la configuration est déjà préparée."
  echo "Relancer ce script créerait de NOUVEAUX mots de passe et casserait les données existantes."
  echo "Pour repartir de zéro volontairement : supprimez .env, env.d/, keys/, realm.json et data/."
  exit 1
fi

umask 077
secret() { openssl rand -hex "${1:-24}"; }

echo "=== Adresses ==="
IP=$(curl -4 -fsS https://ifconfig.me 2>/dev/null || true)
DEFAULT_BASE=""
[ -n "$IP" ] && DEFAULT_BASE="$(echo "$IP" | tr . -).sslip.io"
read -r -p "Domaine de base [${DEFAULT_BASE:-exemple.fr}] : " BASE
BASE=${BASE:-$DEFAULT_BASE}
[ -n "$BASE" ] || { echo "Domaine requis."; exit 1; }
DOCS_HOST="docs.$BASE"
KEYCLOAK_HOST="id.$BASE"
S3_HOST="storage.$BASE"
read -r -p "Votre e-mail (pour les certificats HTTPS) : " ACME_EMAIL

echo
echo "=== Visio (LiveKit Cloud) — laissez vide pour la configurer plus tard ==="
read -r -p "URL LiveKit (wss://xxxx.livekit.cloud) : " LK_URL
LK_KEY=""; LK_SECRET=""
if [ -n "$LK_URL" ]; then
  read -r -p "LiveKit API key : " LK_KEY
  read -r -p "LiveKit API secret : " LK_SECRET
fi

DB_PASSWORD=$(secret); KC_DB_PASSWORD=$(secret); KC_ADMIN_PASSWORD=$(secret 12)
MINIO_PASSWORD=$(secret); DJANGO_SECRET_KEY=$(secret 40); CLIENT_SECRET=$(secret)
Y_PROVIDER_API_KEY=$(secret)

mkdir -p env.d keys data

cat > .env <<EOT
DOCS_HOST=$DOCS_HOST
KEYCLOAK_HOST=$KEYCLOAK_HOST
S3_HOST=$S3_HOST
ACME_EMAIL=$ACME_EMAIL
DOCKER_USER=1000
# Pour figer une version : IMAGE_TAG=sha-xxxxxxx
IMAGE_TAG=espaces
EOT

cat > env.d/common <<EOT
DOCS_HOST=$DOCS_HOST
KEYCLOAK_HOST=$KEYCLOAK_HOST
S3_HOST=$S3_HOST
BACKEND_HOST=backend
FRONTEND_HOST=frontend
YPROVIDER_HOST=y-provider
YHUB_HOST=yhub
BUCKET_NAME=espaces-media
REALM_NAME=docs
EOT

cat > env.d/postgresql <<EOT
POSTGRES_DB=docs
POSTGRES_USER=docs
POSTGRES_PASSWORD=$DB_PASSWORD
PGDATA=/var/lib/postgresql/data/pgdata
DB_HOST=postgresql
DB_NAME=docs
DB_USER=docs
DB_PASSWORD=$DB_PASSWORD
DB_PORT=5432
EOT

cat > env.d/kc_postgresql <<EOT
POSTGRES_DB=keycloak
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=$KC_DB_PASSWORD
PGDATA=/var/lib/postgresql/data/pgdata
KC_DB=postgres
KC_DB_SCHEMA=public
KC_DB_URL_HOST=kc_postgresql
KC_DB_URL_DATABASE=keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=$KC_DB_PASSWORD
EOT

cat > env.d/keycloak <<EOT
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=$KC_ADMIN_PASSWORD
KC_HOSTNAME=https://$KEYCLOAK_HOST
KC_PROXY_HEADERS=xforwarded
KC_HTTP_ENABLED=true
EOT

cat > env.d/minio <<EOT
MINIO_ROOT_USER=espaces
MINIO_ROOT_PASSWORD=$MINIO_PASSWORD
EOT

cat > env.d/yprovider <<EOT
Y_PROVIDER_API_BASE_URL=http://y-provider:4444/api/
Y_PROVIDER_API_KEY=$Y_PROVIDER_API_KEY
COLLABORATION_SERVER_ORIGIN=https://$DOCS_HOST
COLLABORATION_BACKEND_BASE_URL=https://$DOCS_HOST
COLLABORATION_LOGGING=true
EOT

cat > env.d/yhub <<EOT
PORT=3002
REDIS=redis://yhub-valkey:6379
REDIS_PREFIX=yhub
POSTGRES=postgres://docs:$DB_PASSWORD@postgresql:5432/yhub
COLLABORATION_BACKEND_BASE_URL=https://$DOCS_HOST
COLLABORATION_SERVER_ORIGIN=https://$DOCS_HOST
Y_PROVIDER_API_KEY=$Y_PROVIDER_API_KEY
YHUB_JWT_PRIVATE_KEY_FILE=/keys/yhub-private.pem
EOT

cat > env.d/backend <<EOT
DJANGO_ALLOWED_HOSTS=$DOCS_HOST
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DJANGO_SETTINGS_MODULE=impress.settings
DJANGO_CONFIGURATION=Production
DJANGO_CSRF_TRUSTED_ORIGINS=https://$DOCS_HOST
LOGGING_LEVEL_HANDLERS_CONSOLE=ERROR
LOGGING_LEVEL_LOGGERS_ROOT=INFO
LOGGING_LEVEL_LOGGERS_APP=INFO
PYTHONPATH=/app
JWT_PRIVATE_KEY_FILE=/keys/private.pem
REDIS_URL=redis://redis:6379/2
CELERY_BROKER_URL=redis://redis:6379/0
YHUB_API_BASE_URL=http://yhub:3002
COLLABORATION_API_URL=http://yhub:3002/collaboration
COLLABORATION_WS_URL=wss://$DOCS_HOST/collaboration/ws/v1/docs

# Fichiers
AWS_S3_ENDPOINT_URL=https://$S3_HOST
AWS_S3_ACCESS_KEY_ID=espaces
AWS_S3_SECRET_ACCESS_KEY=$MINIO_PASSWORD
AWS_STORAGE_BUCKET_NAME=espaces-media
MEDIA_BASE_URL=https://$DOCS_HOST

# Connexion (Keycloak)
OIDC_OP_JWKS_ENDPOINT=https://$KEYCLOAK_HOST/realms/docs/protocol/openid-connect/certs
OIDC_OP_AUTHORIZATION_ENDPOINT=https://$KEYCLOAK_HOST/realms/docs/protocol/openid-connect/auth
OIDC_OP_TOKEN_ENDPOINT=https://$KEYCLOAK_HOST/realms/docs/protocol/openid-connect/token
OIDC_OP_USER_ENDPOINT=https://$KEYCLOAK_HOST/realms/docs/protocol/openid-connect/userinfo
OIDC_OP_LOGOUT_ENDPOINT=https://$KEYCLOAK_HOST/realms/docs/protocol/openid-connect/logout
OIDC_RP_CLIENT_ID=docs
OIDC_RP_CLIENT_SECRET=$CLIENT_SECRET
OIDC_RP_SIGN_ALGO=RS256
OIDC_RP_SCOPES="openid email"
OIDC_REDIRECT_REQUIRE_HTTPS=True
OIDC_REDIRECT_ALLOWED_HOSTS=$DOCS_HOST,$KEYCLOAK_HOST
LOGIN_REDIRECT_URL=https://$DOCS_HOST
LOGIN_REDIRECT_URL_FAILURE=https://$DOCS_HOST
LOGOUT_REDIRECT_URL=https://$DOCS_HOST

# Courrier (invitations par e-mail) : à renseigner pour qu'elles partent
#DJANGO_EMAIL_HOST=
#DJANGO_EMAIL_PORT=587
#DJANGO_EMAIL_HOST_USER=
#DJANGO_EMAIL_HOST_PASSWORD=
#DJANGO_EMAIL_USE_TLS=true
#DJANGO_EMAIL_FROM=
DJANGO_EMAIL_BRAND_NAME="Espaces"
DJANGO_EMAIL_URL_APP="https://$DOCS_HOST"
EOT

if [ -n "$LK_URL" ]; then
  LK_INTERNAL=$(echo "$LK_URL" | sed 's#^wss://#https://#; s#^ws://#http://#')
  cat >> env.d/backend <<EOT

# Visio (LiveKit)
LIVEKIT_API_KEY=$LK_KEY
LIVEKIT_API_SECRET=$LK_SECRET
LIVEKIT_API_URL=$LK_URL
LIVEKIT_INTERNAL_URL=$LK_INTERNAL
EOT
fi

# Connexion : fichier d'import pour Keycloak
sed -e "s#@@DOCS_HOST@@#$DOCS_HOST#g" -e "s#@@CLIENT_SECRET@@#$CLIENT_SECRET#g" realm.json.modele > realm.json

# Clés de signature (une pour l'application, une pour l'édition collaborative)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/private.pem 2>/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/yhub-private.pem 2>/dev/null
chown 1000:1000 keys/*.pem 2>/dev/null || true
chmod 600 keys/*.pem
# Le dossier d'import doit être lisible par Keycloak
chmod 644 realm.json

echo
echo "================ TERMINÉ ================"
echo "Application : https://$DOCS_HOST"
echo "Connexion   : https://$KEYCLOAK_HOST   (admin)"
echo "Mot de passe administrateur Keycloak : $KC_ADMIN_PASSWORD"
echo "(copiez-le dans un gestionnaire de mots de passe : il est aussi dans env.d/keycloak)"
if [ -n "$LK_URL" ]; then
  echo "Adresse du webhook à saisir chez LiveKit : https://$DOCS_HOST/api/v1.0/livekit/webhook/"
fi
echo
echo "Étape suivante : docker compose pull && docker compose up -d postgresql"
