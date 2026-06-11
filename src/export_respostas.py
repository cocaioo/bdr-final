import subprocess
from pathlib import Path
import shutil
import sys

def main():
    print("Exporting answers from database and generating artifacts...")
    
    # 1. Clean up Banco/respostas/ directory
    banco_respostas_dir = Path("Banco/respostas")
    banco_respostas_dir.mkdir(parents=True, exist_ok=True)
    for ext in ("*.txt", "*.csv"):
        for file_path in banco_respostas_dir.glob(ext):
            try:
                file_path.unlink()
            except Exception as e:
                print(f"Error removing {file_path}: {e}")
        
    # 2. Run SQL queries in Postgres container
    queries = {
        "q1": Path("Caio/consultas/q1.sql"),
        "q3": Path("Cirilo/consultas/q3.sql"),
        "q4": Path("Caio/consultas/q4.sql"),
        "q5": Path("Cirilo/consultas/q5.sql"),
        "q13": Path("Cirilo/consultas/q13.sql"),
        "q9": Path("JF/consultas/q9.sql"),
        "q10": Path("JF/consultas/q10.sql"),
        "q11": Path("JF/consultas/q11.sql"),
    }
    
    for name, sql_path in queries.items():
        if not sql_path.exists():
            print(f"Warning: {sql_path} does not exist. Skipping.")
            continue
            
        print(f"Running database query {name} from {sql_path} in container...")
        try:
            sql_content = sql_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            sql_content = sql_path.read_text(encoding="latin-1")
        
        # Prepend schema and client encoding (latin1) to match expected formats
        config = "SET search_path TO grupo4; SET client_encoding TO 'UTF8';\n"
        full_sql = config + sql_content
        
        # Execute inside docker container
        try:
            subprocess.run(
                ["docker", "exec", "-i", "bdr-postgres", "psql", "-U", "admin", "-d", "dossie_grupo4", "-f", "-"],
                input=full_sql,
                text=True,
                check=True
            )
            print(f"Query {name} completed successfully.")
        except subprocess.CalledProcessError as exc:
            print(f"Error running query {name}: {exc}")
            sys.exit(1)
            
    # 3. Run Q2 python script locally
    q2_script = Path("dashboard/scripts/generate_q2_artifacts.py")
    if q2_script.exists():
        print("\nRunning Q2 python artifact generator locally...")
        try:
            subprocess.run(
                [sys.executable, str(q2_script), "--all"],
                check=True
            )
            print("Q2 python artifact generator completed successfully.")
        except subprocess.CalledProcessError as exc:
            print(f"Error running Q2 generator script: {exc}")
            sys.exit(1)
    else:
        print(f"\nWarning: Q2 script {q2_script} not found.")

    # 4. Copy Q1 and Q4 response files to destination folders
    # Note: Q2 files are already written to targets by the Q2 generator script
    targets = {
        "q1_gastos_deputados.txt": [
            Path("respostas/q1_gastos_deputados.txt"),
            Path("Caio/q1/q1_gastos_deputados.txt")
        ],
        "q3_voto_deputado_tema.txt": [
            Path("respostas/q3_voto_deputado_tema.txt"),
            Path("Cirilo/q3/q3_voto_deputado_tema.txt")
        ],        
        "q4_escolaridade.txt": [
            Path("respostas/q4_escolaridade.txt"),
            Path("Caio/q4/q4_escolaridade.txt")
        ],
        "q4_escolaridade_complementar.txt": [
            Path("respostas/q4_escolaridade_complementar.txt"),
            Path("Caio/q4/q4_escolaridade_complementar.txt")
        ],
        "q5_fornecedores.txt": [
            Path("respostas/q5_fornecedores.txt"),
            Path("Cirilo/q5/q5_fornecedores.txt")
        ],
        "q5_fornecedores_complemento.txt": [
            Path("respostas/q5_fornecedores_complemento.txt"),
            Path("Cirilo/q5/q5_fornecedores_complemento.txt")
        ],
        "q13_categorias_gasto_deputado.txt": [
            Path("respostas/q13_categorias_gasto_deputado.txt"),
            Path("Cirilo/q13/q13_categorias_gasto_deputado.txt")
        ],
        "q13_categorias_gasto_deputado_complemento.txt": [
            Path("respostas/q13_categorias_gasto_deputado_complemento.txt"),
            Path("Cirilo/q13/q13_categorias_gasto_deputado_complemento.txt")
        ],
        "q9_vies_deputado.txt": [
            Path("respostas/q9_vies_deputado.txt"),
            Path("JF/q9/q9_vies_deputado.txt")
        ],
        "q9_vies_deputado_detalhe.csv": [
            Path("respostas/q9_vies_deputado_detalhe.csv"),
            Path("JF/q9/q9_vies_deputado_detalhe.csv")
        ],
        "q10_alinhamento_partidos.txt": [
            Path("respostas/q10_alinhamento_partidos.txt"),
            Path("JF/q10/q10_alinhamento_partidos.txt")
        ],
        "q11_ranking_partidos.txt": [
            Path("respostas/q11_ranking_partidos.txt"),
            Path("JF/q11/q11_ranking_partidos.txt")
        ],
    }
    
    print("\nCopying response files to destination folders...")
    for filename, dest_paths in targets.items():
        src_file = banco_respostas_dir / filename
        if not src_file.exists():
            print(f"Warning: Expected output file {src_file} was not generated!")
            continue
            
        for dest_path in dest_paths:
            try:
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_file, dest_path)
                print(f"Copied {src_file.name} to {dest_path}")
            except Exception as exc:
                print(f"Error copying {src_file.name} to {dest_path}: {exc}")
            
    print("\nExport and generation completed successfully!")

if __name__ == "__main__":
    main()
