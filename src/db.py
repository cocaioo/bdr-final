"""PostgreSQL helpers used by the ETL."""

import os

import psycopg2
from psycopg2 import sql


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5433")),
        dbname=os.getenv("DB_NAME", "dossie_grupo4"),
        user=os.getenv("DB_USER", "admin"),
        password=os.getenv("DB_PASSWORD", "admin"),
    )


def set_search_path(conn, schema):
    with conn.cursor() as cur:
        cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    conn.commit()


def truncate_all(conn, schema, tables):
    if not tables:
        return
    table_refs = sql.SQL(", ").join(
        sql.SQL("{}.{}").format(sql.Identifier(schema), sql.Identifier(table))
        for table in tables
    )
    stmt = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(table_refs)
    with conn.cursor() as cur:
        cur.execute(stmt)
    conn.commit()


def copy_csv(conn, schema, table, columns, csv_path, delimiter=";"):
    copy_sql = sql.SQL(
        "COPY {}.{} ({}) FROM STDIN WITH (FORMAT csv, HEADER true, DELIMITER {}, NULL '')"
    ).format(
        sql.Identifier(schema),
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(column) for column in columns),
        sql.Literal(delimiter),
    )

    with conn.cursor() as cur:
        with open(csv_path, "r", encoding="utf-8") as file:
            cur.copy_expert(copy_sql.as_string(conn), file)
    conn.commit()
