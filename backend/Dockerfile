FROM php:8.3-cli

# System deps + PHP extensions (pdo_mysql for the eventual MySQL; pdo_sqlite ships enabled)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libzip-dev zip unzip git poppler-utils \
 && docker-php-ext-install pdo pdo_mysql zip \
 && rm -rf /var/lib/apt/lists/*

# PHP defaults to 2M uploads, which silently rejects real customer PDFs (the "max 25 MB" is moot otherwise)
RUN { echo 'upload_max_filesize=30M'; echo 'post_max_size=30M'; } > /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .
# Runtime dirs MUST exist before composer install — package:discover writes bootstrap/cache,
# and .gitignore/.dockerignore strip these (empty) dirs from the build context.
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
            storage/logs storage/app/public bootstrap/cache \
 && chmod -R 775 storage bootstrap/cache

# Retry composer install — GitHub's zipball API occasionally returns transient 504s mid-build
RUN composer install --no-dev --optimize-autoloader --no-interaction \
 || (sleep 10 && composer install --no-dev --optimize-autoloader --no-interaction) \
 || (sleep 20 && composer install --no-dev --optimize-autoloader --no-interaction)

ENV APP_ENV=production
ENV APP_DEBUG=false

EXPOSE 8000

# On boot: ensure the sqlite file exists (fresh persistent disk), migrate, seed, link storage, then
# serve on Render's $PORT.
#
# `db:seed` runs on EVERY boot, so every seeder it calls must leave an existing install alone or the
# deploy silently reverts real work. That is a property of the SEEDERS, not of this line:
#   • UserSeeder    — populates an EMPTY users table only (deletes, roles and passwords now stick).
#   • SettingsSeeder — firstOrCreate; never touches the live counters.
#   • SignCatalogSeeder — truncate+reload, correct: that table is reference data from a JSON file,
#     not user data. The team's own sign types live in user_catalog_items and are untouched.
# companies:import likewise only BACKFILLS a blank address, so an address edited in the app survives.
#
# The DB_DATABASE default below is /var/data/…, NOT /app/database/… — and that is the whole
# point. /app lives in the container image: it is rebuilt from scratch on every deploy, so a
# sqlite file there is destroyed each time and the boot line above then "helpfully" re-seeds a
# virgin database. That is exactly what a wiped-logins deploy looks like from the outside, and
# an /app default meant one unset env var was enough to cause it, silently. /var/data is the
# persistent disk; if it is somehow not mounted the data is lost either way, but nothing about
# a plain deploy can lose it. (the vanished-logins deploys, 2026-07)
# On MySQL, DB_DATABASE is a schema NAME, not a path — none of this applies and it is left alone.
CMD if [ "${DB_CONNECTION:-sqlite}" = sqlite ]; then \
      DB_DATABASE="${DB_DATABASE:-/var/data/database.sqlite}"; export DB_DATABASE; \
      case "$DB_DATABASE" in /var/data/*) : ;; *) \
        echo "!! WARNING: sqlite DB is at $DB_DATABASE, OUTSIDE the persistent disk (/var/data)." >&2; \
        echo "!! Every deploy destroys it and re-seeds a blank install (all logins lost)." >&2; \
        echo "!! Fix: set DB_DATABASE=/var/data/database.sqlite in the Render dashboard." >&2 ;; \
      esac; \
      mkdir -p "$(dirname "$DB_DATABASE")" && touch "$DB_DATABASE"; \
    fi \
 && mkdir -p "${PUBLIC_DISK_ROOT:-/app/storage/app/public}" \
 && (cp -rn /app/storage/app/public/. "${PUBLIC_DISK_ROOT:-/app/storage/app/public}"/ 2>/dev/null || true) \
 && php artisan migrate --force \
 && php artisan db:seed --force \
 && (php artisan companies:import database/data/companies_import.csv || true) \
 && php artisan serve --host 0.0.0.0 --port "${PORT:-8000}"
