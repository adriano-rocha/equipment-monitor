-- Executado automaticamente pela imagem oficial do Postgres na PRIMEIRA
-- inicialização do volume postgres_data (docker-entrypoint-initdb.d).
-- Se o volume já existir, este script NÃO roda de novo — para recriar o
-- database de teste em um ambiente já existente, rode manualmente:
--   docker compose exec postgres psql -U equipment_monitor -d equipment_monitor \
--     -c "CREATE DATABASE equipment_monitor_test;"
--
-- Objetivo: banco separado para os testes de integração (T12+), usando
-- PostgreSQL real (decisão da Fase 02 — sem Testcontainers).
CREATE DATABASE equipment_monitor_test;