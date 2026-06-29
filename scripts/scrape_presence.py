#!/usr/bin/env python
import os
import re
import time
import datetime
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import requests

# Try to import tqdm, otherwise use a fallback
try:
    from tqdm import tqdm
except ImportError:
    class tqdm:
        def __init__(self, total=None, desc=""):
            self.total = total
            self.desc = desc
            self.n = 0
            self.start_time = time.time()
        def update(self, n=1):
            self.n += n
            elapsed = time.time() - self.start_time
            pct = (self.n / self.total * 100) if self.total else 0
            print(f"\r{self.desc}: {self.n}/{self.total} ({pct:.1f}%) - Elapsed: {elapsed:.1f}s", end="", flush=True)
        def close(self):
            print()

# Configurations
PRIMARY_DEPUTIES_CSV = Path("dados_padronizados/deputados.csv")
FALLBACK_DEPUTIES_CSV = Path("dashboard/frontend/public/deputados.csv")
OUTPUT_CSV = Path("generated/presenca_deputados.csv")
YEARS = [2023, 2024, 2025, 2026]
MAX_WORKERS = 20
TIMEOUT = 10
MAX_RETRIES = 3
BACKOFF_FACTOR = 2  # Exponential backoff factor

# User-Agent for requests
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'

def get_session():
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})
    return session

def parse_num(pattern, text):
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        num_match = re.search(r"\d+", match.group(1))
        return int(num_match.group(0)) if num_match else 0
    return 0

def fetch_deputy_presence_year(session, deputy_id, deputy_name, year):
    url = f"https://www.camara.leg.br/deputados/{deputy_id}?ano={year}"
    scraped_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Initialize response dict with default/failed schema
    result = {
        "ano_dados": year,
        "id_deputado": deputy_id,
        "plenario_presencas": 0,
        "plenario_ausencias_justificadas": 0,
        "plenario_ausencias_nao_justificadas": 0,
        "comissoes_presencas": 0,
        "comissoes_ausencias_justificadas": 0,
        "comissoes_ausencias_nao_justificadas": 0,
        "source_url": url,
        "scraped_at": scraped_at,
        "extraction_status": "failed",
        "extraction_error": ""
    }
    
    retry_delay = 1.0
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, timeout=TIMEOUT)
            if response.status_code == 404:
                result["extraction_status"] = "404_not_found"
                result["extraction_error"] = "Deputy page returned 404 for this year (likely not in office)"
                return result
                
            response.raise_for_status()
            html = response.text
            
            # Extract Plenary and Committee sections using accent-agnostic regex
            plenario_section = re.search(r"Presen.a </span>em Plen.rio.*?</section>", html, re.DOTALL | re.IGNORECASE)
            comissoes_section = re.search(r"Presen.a </span>em Comiss.es.*?</section>", html, re.DOTALL | re.IGNORECASE)
            
            if plenario_section:
                p_text = plenario_section.group(0)
                result["plenario_presencas"] = parse_num(r"Presen.as.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", p_text)
                result["plenario_ausencias_justificadas"] = parse_num(r"Aus.ncias justificadas.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", p_text)
                result["plenario_ausencias_nao_justificadas"] = parse_num(r"Aus.ncias n.o justificadas.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", p_text)
                
            if comissoes_section:
                c_text = comissoes_section.group(0)
                result["comissoes_presencas"] = parse_num(r"Presen.as.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", c_text)
                result["comissoes_ausencias_justificadas"] = parse_num(r"Aus.ncias justificadas.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", c_text)
                result["comissoes_ausencias_nao_justificadas"] = parse_num(r"Aus.ncias n.o justificadas.*?class=\"presencas__qtd\">\s*(.*?)\s*</span>", c_text)
            
            result["extraction_status"] = "success"
            return result
            
        except requests.exceptions.HTTPError as e:
            result["extraction_error"] = f"HTTPError: {e}"
            if response.status_code != 429 and response.status_code < 500:
                break
        except requests.exceptions.RequestException as e:
            result["extraction_error"] = f"RequestException: {e}"
            
        # Exponential backoff before retry
        if attempt < MAX_RETRIES:
            time.sleep(retry_delay)
            retry_delay *= BACKOFF_FACTOR
            
    return result

def main():
    print("--- Starting Offline Attendance Scraper ---")
    
    # 1. Resolve Deputies Source (Primary vs Fallback)
    deputies_csv = None
    if PRIMARY_DEPUTIES_CSV.exists():
        deputies_csv = PRIMARY_DEPUTIES_CSV
        print(f"Using primary deputies source: {PRIMARY_DEPUTIES_CSV}")
    elif FALLBACK_DEPUTIES_CSV.exists():
        deputies_csv = FALLBACK_DEPUTIES_CSV
        print(f"Primary source missing. Using fallback source: {FALLBACK_DEPUTIES_CSV}")
    else:
        print(f"Error: Neither primary ({PRIMARY_DEPUTIES_CSV}) nor fallback ({FALLBACK_DEPUTIES_CSV}) exist.")
        return
        
    deputies_df = pd.read_csv(deputies_csv, sep=";")
    
    # Identify deputy ID column (could be id_deputado or id)
    id_col = "id_deputado" if "id_deputado" in deputies_df.columns else "id"
    name_col = "nome" if "nome" in deputies_df.columns else "nome_parlamentar"
    
    deputy_list = deputies_df.to_dict(orient="records")
    total_deputies = len(deputy_list)
    print(f"Loaded {total_deputies} deputies from {deputies_csv.name}.")
    
    tasks = []
    # Build list of all (deputy, year) tasks
    for dep in deputy_list:
        deputy_id = dep[id_col]
        deputy_name = dep[name_col]
        for year in YEARS:
            tasks.append((deputy_id, deputy_name, year))
            
    total_tasks = len(tasks)
    print(f"Total scraping tasks (Deputies x Years): {total_tasks}")
    
    results = []
    
    def run_task(task_info):
        deputy_id, deputy_name, year = task_info
        session = get_session()
        res = fetch_deputy_presence_year(session, deputy_id, deputy_name, year)
        session.close()
        return res
        
    pbar = tqdm(total=total_tasks, desc="Scraping pages")
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(run_task, task): task for task in tasks}
        for fut in as_completed(futures):
            results.append(fut.result())
            pbar.update(1)
            
    pbar.close()
    
    # Save the generated dataset
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    results_df = pd.DataFrame(results)
    
    # Reorder columns as requested in the plan
    columns_order = [
        "ano_dados",
        "id_deputado",
        "plenario_presencas",
        "plenario_ausencias_justificadas",
        "plenario_ausencias_nao_justificadas",
        "comissoes_presencas",
        "comissoes_ausencias_justificadas",
        "comissoes_ausencias_nao_justificadas",
        "source_url",
        "scraped_at",
        "extraction_status",
        "extraction_error"
    ]
    results_df = results_df[columns_order]
    
    # Print summary statistics
    success_count = (results_df["extraction_status"] == "success").sum()
    not_found_count = (results_df["extraction_status"] == "404_not_found").sum()
    failed_count = (results_df["extraction_status"] == "failed").sum()
    
    print("\n--- Scraping Finished ---")
    print(f"Total processed: {total_tasks}")
    print(f"Success: {success_count} ({success_count/total_tasks*100:.1f}%)")
    print(f"Not in office (404): {not_found_count} ({not_found_count/total_tasks*100:.1f}%)")
    print(f"Failed: {failed_count} ({failed_count/total_tasks*100:.1f}%)")
    
    results_df.to_csv(OUTPUT_CSV, sep=";", index=False, encoding="utf-8")
    print(f"Saved generated dataset to {OUTPUT_CSV} (Size: {OUTPUT_CSV.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
