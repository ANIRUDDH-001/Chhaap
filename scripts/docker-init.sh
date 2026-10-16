#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE chhaap_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE DATABASE chhaap_test OWNER chhaap_admin;
SQL
