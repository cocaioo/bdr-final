"""
Módulo de banco de dados — conexão PostgreSQL e operações COPY.

Usa psycopg2 puro, sem SQLAlchemy.
"""

import os
import logging

import psycopg2
from psycopg2 import sql

logger = logging.getLogger(__name__)


def get_connection():
    """Cria conexão com o PostgreSQL usando variáveis do .env."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "dossie_grupo4"),
        user=os.getenv("DB_USER", "admin"),
        password=os.getenv("DB_PASSWORD", "admin"),
    )


def set_search_path(conn, schema):
    """Define o search_path para o schema."""
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("SET search_path TO {}").format(sql.Identifier(schema))
        )
    conn.commit()


def truncate_all(conn, schema, tables):
    """Trunca múltiplas tabelas em um único comando.

    Ao truncar todas as tabelas juntas, evita erros de FK
    sem precisar de CASCADE.
    """
    if not tables:
        return
    table_refs = sql.SQL(", ").join(
        sql.SQL("{}.{}").format(sql.Identifier(schema), sql.Identifier(t))
        for t in tables
    )
    stmt = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY").format(table_refs)
    with conn.cursor() as cur:
        cur.execute(stmt)
    conn.commit()
    logger.info(f"  TRUNCATE OK ({len(tables)} tabelas)")


def copy_csv(conn, schema, table, columns, csv_path, delimiter=";"):
    """Carrega CSV limpo no PostgreSQL usando COPY FROM STDIN.

    Args:
        conn: conexão psycopg2
        schema: nome do schema
        table: nome da tabela
        columns: lista de colunas a importar
        csv_path: caminho do CSV limpo
        delimiter: delimitador do CSV
    """
    col_idents = [sql.Identifier(c) for c in columns]
    copy_sql = sql.SQL(
        "COPY {}.{} ({}) FROM STDIN WITH (FORMAT csv, HEADER true, DELIMITER {}, NULL '')"
    ).format(
        sql.Identifier(schema),
        sql.Identifier(table),
        sql.SQL(", ").join(col_idents),
        sql.Literal(delimiter),
    )

    with conn.cursor() as cur:
        with open(csv_path, "r", encoding="utf-8") as f:
            cur.copy_expert(copy_sql.as_string(conn), f)
    conn.commit()


def backfill_missing_deputados_from_gastos(conn, schema):
    """Insere deputados ausentes encontrados em gastos_2026.

    A fonte de deputados do projeto não cobre todos os ids usados nos gastos,
    então reconstruimos os registros faltantes com base no identificador,
    nome parlamentar e CPF disponíveis no próprio faturamento.
    """
    stmt = sql.SQL(
        """
        WITH missing AS (
            SELECT
                g.nudeputadoid AS id_dep,
                'https://dadosabertos.camara.leg.br/api/v2/deputados/' || g.nudeputadoid::text AS uri_dep,
                COALESCE(MAX(g.txnomeparlamentar), 'Deputado ' || g.nudeputadoid::text) AS nome,
                MAX(g.cpf) AS cpf
            FROM {}.gastos_2026 g
            LEFT JOIN {}.deputados d ON d.id_dep = g.nudeputadoid
            WHERE g.nudeputadoid IS NOT NULL
              AND d.id_dep IS NULL
            GROUP BY g.nudeputadoid
        )
        INSERT INTO {}.deputados (id_dep, uri_dep, nome, nomecivil, cpf)
        SELECT
            id_dep,
            uri_dep,
            nome,
            NULL::varchar(200) AS nomecivil,
            cpf
        FROM missing
        ORDER BY id_dep
        """
    ).format(
        sql.Identifier(schema),
        sql.Identifier(schema),
        sql.Identifier(schema),
    )

    with conn.cursor() as cur:
        cur.execute(stmt)
        inserted = cur.rowcount if cur.rowcount != -1 else 0
    conn.commit()
    logger.info(f"  Deputados ausentes inseridos a partir de gastos: {inserted}")
    return inserted


def disable_fk(conn):
    """Desabilita verificação de FK (para carga bulk)."""
    with conn.cursor() as cur:
        cur.execute("SET session_replication_role = 'replica'")
    conn.commit()
    logger.info("  FK constraints desabilitadas")


def enable_fk(conn):
    """Reabilita verificação de FK."""
    with conn.cursor() as cur:
        cur.execute("SET session_replication_role = 'origin'")
    conn.commit()
    logger.info("  FK constraints reabilitadas")
