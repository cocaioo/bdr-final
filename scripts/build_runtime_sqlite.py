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
Q3_FILE_1 = REPO_ROOT / "JF" / "producao-legislativa-temas" / "q3" / "q3_votos_min.csv"
Q3_FILE_2 = REPO_ROOT / "JF" / "producao-legislativa-temas" / "q3" / "q3_classificacao_votacoes.csv"

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

        # Create Q3 tables
        cursor.execute("""
            CREATE TABLE q3_votos_min (
                ano_dados INTEGER,
                data_votacao TEXT,
                id_votacao TEXT,
                id_deputado INTEGER,
                nome TEXT,
                sigla_partido TEXT,
                sigla_uf TEXT,
                voto TEXT,
                voto_sim INTEGER,
                voto_nao INTEGER,
                voto_abstencao INTEGER,
                voto_outro INTEGER,
                eixo_principal TEXT,
                tem_classificacao_tematica TEXT
            )
        """)

        cursor.execute("""
            CREATE TABLE q3_classificacao_votacoes (
                ano_dados INTEGER,
                id_votacao TEXT,
                eixo_principal TEXT,
                eixos_secundarios TEXT,
                qtd_eixos_detectados INTEGER,
                tem_classificacao_tematica TEXT,
                confianca_classificacao TEXT,
                versao_eixos TEXT,
                versao_classificador TEXT,
                origem_classificacao TEXT,
                campos_textuais_utilizados TEXT,
                evidencias_eixo_principal TEXT,
                evidencias_eixos_secundarios TEXT,
                score_eixo_principal REAL,
                score_segundo_eixo REAL,
                margem_score REAL,
                score_por_eixo TEXT,
                texto_classificacao_hash TEXT,
                qtd_objetos_associados INTEGER,
                qtd_proposicoes_associadas INTEGER,
                materia_resumo TEXT,
                ementa_resumo TEXT,
                classificado_em TEXT
            )
        """)
        
        # Parse Q12 File 1
        print(f"Parsing {Q12_FILE_1.name}...")
        doc1 = parse_data_file(Q12_FILE_1)
        
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

        # Parse Q3 File 1 (votos_min)
        print(f"Parsing {Q3_FILE_1.name}...")
        doc3_votos = parse_data_file(Q3_FILE_1)
        q3_votos_table = doc3_votos.tables[0] if doc3_votos.tables else None
        if not q3_votos_table:
            raise ValueError(f"Could not find votes table in {Q3_FILE_1.name}")

        # Parse Q3 File 2 (classificacoes)
        print(f"Parsing {Q3_FILE_2.name}...")
        doc3_class = parse_data_file(Q3_FILE_2)
        q3_class_table = doc3_class.tables[0] if doc3_class.tables else None
        if not q3_class_table:
            raise ValueError(f"Could not find classification table in {Q3_FILE_2.name}")
            
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

        insert_rows("q3_votos_min", [
            "ano_dados", "data_votacao", "id_votacao", "id_deputado", "nome", "sigla_partido", "sigla_uf",
            "voto", "voto_sim", "voto_nao", "voto_abstencao", "voto_outro", "eixo_principal", "tem_classificacao_tematica"
        ], q3_votos_table.rows)

        insert_rows("q3_classificacao_votacoes", [
            "ano_dados", "id_votacao", "eixo_principal", "eixos_secundarios", "qtd_eixos_detectados",
            "tem_classificacao_tematica", "confianca_classificacao", "versao_eixos", "versao_classificador",
            "origem_classificacao", "campos_textuais_utilizados", "evidencias_eixo_principal",
            "evidencias_eixos_secundarios", "score_eixo_principal", "score_segundo_eixo", "margem_score",
            "score_por_eixo", "texto_classificacao_hash", "qtd_objetos_associados", "qtd_proposicoes_associadas",
            "materia_resumo", "ementa_resumo", "classificado_em"
        ], q3_class_table.rows)
        
        # Create Q12 indexes
        print("Creating Q12 indexes...")
        cursor.execute("CREATE INDEX idx_q12_principal_dep ON q12_principal (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_principal_ano ON q12_principal (ano_dados)")
        cursor.execute("CREATE INDEX idx_q12_principal_siglas ON q12_principal (sigla_partido, sigla_uf)")
        
        cursor.execute("CREATE INDEX idx_q12_ranking_dep ON q12_ranking_global (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_ranking_siglas ON q12_ranking_global (sigla_partido, sigla_uf)")
        
        cursor.execute("CREATE INDEX idx_q12_complemento_dep ON q12_complemento (id_deputado)")
        cursor.execute("CREATE INDEX idx_q12_complemento_ano ON q12_complemento (ano_dados)")

        # Create Q3 indexes
        print("Creating Q3 indexes...")
        cursor.execute("CREATE INDEX idx_q3_votos_dep ON q3_votos_min (id_deputado)")
        cursor.execute("CREATE INDEX idx_q3_votos_nome ON q3_votos_min (nome)")
        cursor.execute("CREATE INDEX idx_q3_votos_ano ON q3_votos_min (ano_dados)")
        cursor.execute("CREATE INDEX idx_q3_votos_eixo ON q3_votos_min (eixo_principal)")
        cursor.execute("CREATE INDEX idx_q3_votos_votacao ON q3_votos_min (id_votacao)")
        cursor.execute("CREATE INDEX idx_q3_classificacao_key ON q3_classificacao_votacoes (ano_dados, id_votacao)")
        
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
    required_files = [Q12_FILE_1, Q12_FILE_2, Q3_FILE_1, Q3_FILE_2]
    for rf in required_files:
        if not rf.exists():
            print(f"Error: Required file missing: {rf}")
            sys.exit(1)
        
    files_info = [
        {
            "path": rf,
            "rel_path": str(rf.relative_to(REPO_ROOT)),
            "size": rf.stat().st_size,
            "mtime": rf.stat().st_mtime,
            "hash": get_file_hash(rf)
        }
        for rf in required_files
    ]
    
    if check_idempotency(files_info):
        print("SQLite database is up-to-date. Skipping build.")
        sys.exit(0)
        
    build_database(files_info)

if __name__ == "__main__":
    main()
