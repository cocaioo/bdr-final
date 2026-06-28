#!/usr/bin/env python
import sys
import os
import sqlite3
import hashlib
import time
from datetime import datetime
from pathlib import Path

# Resolve repo root and add backend to python path
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(REPO_ROOT / "dashboard" / "backend"))

try:
    from app.parser import parse_data_file
except ImportError as e:
    print(f"Error importing app.parser: {e}")
    sys.exit(1)

# Paths relative to REPO_ROOT
Q12_FILE_1 = REPO_ROOT / "Caio" / "gastos-fornecedores" / "q12" / "q12_deputado_fornecedor.txt"
Q12_FILE_2 = REPO_ROOT / "Caio" / "gastos-fornecedores" / "q12" / "q12_deputado_fornecedor_complemento.txt"
DB_PATH = REPO_ROOT / "runtime" / "bdr_runtime.sqlite"

def get_file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def check_idempotency(files_info: list[dict]) -> bool:
    if not DB_PATH.exists():
        return False
    try:
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='file_metadata'")
        if not cursor.fetchone():
            conn.close()
            return False
            
        # Verify metadata
        for info in files_info:
            cursor.execute(
                "SELECT file_size, file_mtime, file_hash FROM file_metadata WHERE file_path = ?",
                (info["rel_path"],)
            )
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False
            db_size, db_mtime, db_hash = row
            if db_size != info["size"] or db_hash != info["hash"]:
                conn.close()
                return False
        conn.close()
        return True
    except Exception as e:
        print(f"Error checking idempotency: {e}")
        return False

def build_database(files_info: list[dict]):
    print(f"Building SQLite database at {DB_PATH}...")
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # Use temporary file first for atomic write
    temp_db_path = DB_PATH.with_suffix(".tmp.sqlite")
    if temp_db_path.exists():
        temp_db_path.unlink()
        
    conn = sqlite3.connect(str(temp_db_path))
    cursor = conn.cursor()
    
    try:
        # Enable WAL mode for performance
        conn.execute("PRAGMA journal_mode=WAL")
        
        # Create metadata table
        cursor.execute("""
            CREATE TABLE file_metadata (
                file_path TEXT PRIMARY KEY,
                file_size INTEGER,
                file_mtime REAL,
                file_hash TEXT,
                generated_at TEXT
            )
        """)
        
        # Create Q12 tables
        cursor.execute("""
            CREATE TABLE q12_resumo (
                ano_dados TEXT,
                pares_deputado_fornecedor INTEGER,
                deputados INTEGER,
                fornecedores INTEGER,
                lancamentos INTEGER,
                total_pago REAL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE q12_principal (
                ano_dados TEXT,
                id_deputado INTEGER,
                nome TEXT,
                sigla_uf TEXT,
                sigla_partido TEXT,
                fornecedor TEXT,
                qtd_lancamentos INTEGER,
                total_pago REAL,
                pct_total REAL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE q12_ranking_global (
                ano_dados TEXT,
                id_deputado INTEGER,
                nome TEXT,
                sigla_uf TEXT,
                sigla_partido TEXT,
                fornecedor TEXT,
                qtd_lancamentos INTEGER,
                total_pago REAL,
                pct_total REAL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE q12_complemento (
                ano_dados TEXT,
                id_deputado INTEGER,
                nome TEXT,
                fornecedor TEXT,
                qtd_lancamentos INTEGER,
                total_pago REAL
            )
        """)
        
        # Parse Q12 File 1
        print(f"Parsing {Q12_FILE_1.name}...")
        doc1 = parse_data_file(Q12_FILE_1)
        
        # Match tables by title
        summary_table = None
        main_table = None
        global_table = None
        
        for table in doc1.tables:
            title = table.title.lower()
            if "resumo executivo" in title:
                summary_table = table
            elif "tabela principal" in title:
                main_table = table
            elif "ranking global" in title:
                global_table = table
                
        if not summary_table or not main_table or not global_table:
            raise ValueError(f"Could not find all expected tables in {Q12_FILE_1.name}")
            
        # Parse Q12 File 2
        print(f"Parsing {Q12_FILE_2.name}...")
        doc2 = parse_data_file(Q12_FILE_2)
        complement_table = doc2.tables[0] if doc2.tables else None
        if not complement_table:
            raise ValueError(f"Could not find complement table in {Q12_FILE_2.name}")
            
        # Helper to insert rows
        def insert_rows(table_name, columns, rows):
            cols_str = ", ".join(columns)
            placeholders = ", ".join("?" for _ in columns)
            sql = f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})"
            data = [tuple(row.get(col) for col in columns) for row in rows]
            cursor.executemany(sql, data)
            print(f"  Inserted {len(rows)} rows into {table_name}")

        insert_rows("q12_resumo", ["ano_dados", "pares_deputado_fornecedor", "deputados", "fornecedores", "lancamentos", "total_pago"], summary_table.rows)
        insert_rows("q12_principal", ["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido", "fornecedor", "qtd_lancamentos", "total_pago", "pct_total"], main_table.rows)
        insert_rows("q12_ranking_global", ["ano_dados", "id_deputado", "nome", "sigla_uf", "sigla_partido", "fornecedor", "qtd_lancamentos", "total_pago", "pct_total"], global_table.rows)
        insert_rows("q12_complemento", ["ano_dados", "id_deputado", "nome", "fornecedor", "qtd_lancamentos", "total_pago"], complement_table.rows)
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("CREATE INDEX idx_q12_principal_dep ON q12_principal (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_principal_ano ON q12_principal (ano_dados)")
        cursor.execute("CREATE INDEX idx_q12_principal_siglas ON q12_principal (sigla_partido, sigla_uf)")
        
        cursor.execute("CREATE INDEX idx_q12_ranking_dep ON q12_ranking_global (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_ranking_siglas ON q12_ranking_global (sigla_partido, sigla_uf)")
        
        cursor.execute("CREATE INDEX idx_q12_complemento_dep ON q12_complemento (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_complemento_ano ON q12_complemento (ano_dados)")
        
        # Write metadata
        now_str = datetime.now().isoformat()
        for info in files_info:
            cursor.execute(
                "INSERT INTO file_metadata VALUES (?, ?, ?, ?, ?)",
                (info["rel_path"], info["size"], info["mtime"], info["hash"], now_str)
            )
            
        conn.commit()
        conn.close()
        
        # Swap temporary file to final path
        if DB_PATH.exists():
            DB_PATH.unlink()
        temp_db_path.rename(DB_PATH)
        print("Database successfully built!")
        
    except Exception as e:
        conn.rollback()
        conn.close()
        if temp_db_path.exists():
            temp_db_path.unlink()
        raise e

def main():
    if not Q12_FILE_1.exists():
        print(f"Error: Required file missing: {Q12_FILE_1}")
        sys.exit(1)
    if not Q12_FILE_2.exists():
        print(f"Error: Required file missing: {Q12_FILE_2}")
        sys.exit(1)
        
    files_info = [
        {
            "path": Q12_FILE_1,
            "rel_path": str(Q12_FILE_1.relative_to(REPO_ROOT)),
            "size": Q12_FILE_1.stat().st_size,
            "mtime": Q12_FILE_1.stat().st_mtime,
            "hash": get_file_hash(Q12_FILE_1)
        },
        {
            "path": Q12_FILE_2,
            "rel_path": str(Q12_FILE_2.relative_to(REPO_ROOT)),
            "size": Q12_FILE_2.stat().st_size,
            "mtime": Q12_FILE_2.stat().st_mtime,
            "hash": get_file_hash(Q12_FILE_2)
        }
    ]
    
    if check_idempotency(files_info):
        print("SQLite database is up-to-date. Skipping build.")
        sys.exit(0)
        
    build_database(files_info)

if __name__ == "__main__":
    main()
