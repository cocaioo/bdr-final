import sys
from pathlib import Path

# Add backend to sys.path
sys.path.append(str(Path("dashboard/backend").resolve()))

from app.service import DashboardService
from app.filter_engine import FilterState

service = DashboardService()
q1_def = service.registry.by_id("q1")
bundle = service._load_question_bundle(q1_def)

print(f"Number of documents loaded for Q1: {len(bundle.documents)}")
for i, doc in enumerate(bundle.documents):
    print(f"\nDocument {i}:")
    print(f"  Number of tables: {len(doc.tables)}")
    for j, table in enumerate(doc.tables):
        print(f"    Table {j}:")
        print(f"      Title: {table.title}")
        print(f"      Columns: {table.columns}")
        print(f"      Number of rows: {len(table.rows)}")
        if len(table.rows) > 0:
            print(f"      First row: {table.rows[0]}")
