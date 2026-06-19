import shutil
import subprocess
import sys
from pathlib import Path


STAGING_DIR = Path("scratch/query-staging")

QUERY_FILES = [
    Path("Caio/gastos-fornecedores/q1/q1.sql"),
    Path("JF/producao-legislativa-temas/q3/q3.sql"),
    Path("Caio/escolaridade-perfil/q4/q4.sql"),
    Path("Caio/gastos-fornecedores/q5/q5.sql"),
    Path("Caio/escolaridade-perfil/q6/q6.sql"),
    Path("Caio/escolaridade-perfil/q6/q6_complementar.sql"),
    Path("Caio/gastos-fornecedores/q7/q7.sql"),
    Path("JF/producao-legislativa-temas/q8/q8.sql"),
    Path("JF/producao-legislativa-temas/q8/q8_complementar.sql"),
    Path("Caio/gastos-fornecedores/q12/q12.sql"),
    Path("Caio/gastos-fornecedores/q13/q13.sql"),
    Path("JF/partidos-ideologia-votacao/q9/q9.sql"),
    Path("JF/partidos-ideologia-votacao/q10/q10.sql"),
    Path("JF/partidos-ideologia-votacao/q11/q11.sql"),
]

OUTPUT_TARGETS = {
    "q1_gastos_deputados.txt": Path("Caio/gastos-fornecedores/q1/q1_gastos_deputados.txt"),
    "q3_voto_deputado_tema.txt": Path("JF/producao-legislativa-temas/q3/q3_voto_deputado_tema.txt"),
    "q4_escolaridade.txt": Path("Caio/escolaridade-perfil/q4/q4_escolaridade.txt"),
    "q4_escolaridade_complementar.txt": Path("Caio/escolaridade-perfil/q4/q4_escolaridade_complementar.txt"),
    "q5_fornecedores.txt": Path("Caio/gastos-fornecedores/q5/q5_fornecedores.txt"),
    "q5_fornecedores_complemento.txt": Path("Caio/gastos-fornecedores/q5/q5_fornecedores_complemento.txt"),
    "q6_escolaridade_correlacoes.txt": Path("Caio/escolaridade-perfil/q6/q6_escolaridade_correlacoes.txt"),
    "q6a_escolaridade_gastos.txt": Path("Caio/escolaridade-perfil/q6/q6a_escolaridade_gastos.txt"),
    "q6b_escolaridade_fidelidade.txt": Path("Caio/escolaridade-perfil/q6/q6b_escolaridade_fidelidade.txt"),
    "q6c_escolaridade_proposicoes.txt": Path("Caio/escolaridade-perfil/q6/q6c_escolaridade_proposicoes.txt"),
    "q6d_escolaridade_presenca_eventos.txt": Path("Caio/escolaridade-perfil/q6/q6d_escolaridade_presenca_eventos.txt"),
    "q6e_escolaridade_presenca_plenario.txt": Path("Caio/escolaridade-perfil/q6/q6e_escolaridade_presenca_plenario.txt"),
    "q6_eta_complementar.txt": Path("Caio/escolaridade-perfil/q6/q6_eta_complementar.txt"),
    "q7_custo_beneficio.txt": Path("Caio/gastos-fornecedores/q7/q7_custo_beneficio.txt"),
    "q7_custo_beneficio_complemento.txt": Path("Caio/gastos-fornecedores/q7/q7_custo_beneficio_complemento.txt"),
    "q8_influencia.txt": Path("JF/producao-legislativa-temas/q8/q8_influencia.txt"),
    "q8_influencia_complemento.txt": Path("JF/producao-legislativa-temas/q8/q8_influencia_complemento.txt"),
    "q8_influencia_por_voto_extra.txt": Path("JF/producao-legislativa-temas/q8/q8_influencia_por_voto_extra.txt"),
    "q9_vies_deputado.txt": Path("JF/partidos-ideologia-votacao/q9/q9_vies_deputado.txt"),
    "q9_vies_deputado_detalhe.csv": Path("JF/partidos-ideologia-votacao/q9/q9_vies_deputado_detalhe.csv"),
    "q10_alinhamento_partidos.txt": Path("JF/partidos-ideologia-votacao/q10/q10_alinhamento_partidos.txt"),
    "q11_ranking_partidos.txt": Path("JF/partidos-ideologia-votacao/q11/q11_ranking_partidos.txt"),
    "q12_deputado_fornecedor.txt": Path("Caio/gastos-fornecedores/q12/q12_deputado_fornecedor.txt"),
    "q12_deputado_fornecedor_complemento.txt": Path("Caio/gastos-fornecedores/q12/q12_deputado_fornecedor_complemento.txt"),
    "q13_categorias_gasto_deputado.txt": Path("Caio/gastos-fornecedores/q13/q13_categorias_gasto_deputado.txt"),
    "q13_categorias_gasto_deputado_complemento.txt": Path(
        "Caio/gastos-fornecedores/q13/q13_categorias_gasto_deputado_complemento.txt"
    ),
}


def main() -> None:
    print("Exporting answers from database to canonical question folders...")
    reset_staging_dir()

    for sql_path in QUERY_FILES:
        if not sql_path.exists():
            print(f"Warning: {sql_path} does not exist. Skipping.")
            continue
        run_sql(sql_path)

    q2_script = Path("dashboard/scripts/generate_q2_artifacts.py")
    if q2_script.exists():
        print("\nRunning Q2 artifact generator locally...")
        run_command([sys.executable, str(q2_script), "--all"], "Q2 artifact generator")
    else:
        print(f"\nWarning: Q2 script {q2_script} not found.")

    copy_staged_outputs()
    print("\nExport and generation completed successfully.")


def reset_staging_dir() -> None:
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    for pattern in ("*.txt", "*.csv"):
        for file_path in STAGING_DIR.glob(pattern):
            file_path.unlink()


def run_sql(sql_path: Path) -> None:
    print(f"Running database query from {sql_path}...")
    sql_content = read_text_with_fallback(sql_path)
    full_sql = "SET search_path TO grupo4; SET client_encoding TO 'UTF8';\n" + sql_content
    run_command(
        [
            "docker",
            "exec",
            "-i",
            "bdr-postgres",
            "psql",
            "-U",
            "admin",
            "-d",
            "dossie_grupo4",
            "-f",
            "-",
        ],
        f"query {sql_path}",
        input_text=full_sql,
    )


def copy_staged_outputs() -> None:
    print("\nCopying staged response files to canonical folders...")
    for filename, target_path in OUTPUT_TARGETS.items():
        source_path = STAGING_DIR / filename
        if not source_path.exists():
            print(f"Warning: expected staged output {source_path} was not generated.")
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
        print(f"Copied {source_path.name} to {target_path}")


def run_command(command: list[str], label: str, input_text: str | None = None) -> None:
    try:
        subprocess.run(command, input=input_text, text=True, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"Error running {label}: {exc}")
        sys.exit(1)


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore")


if __name__ == "__main__":
    main()
