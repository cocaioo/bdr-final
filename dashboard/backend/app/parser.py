from __future__ import annotations

from dataclasses import dataclass
import csv
from pathlib import Path
import re
from typing import Any


SEPARATOR_RE = re.compile(r"^\s*-+(?:\+-+)+\s*$")
ROW_COUNT_RE = re.compile(r"^\(\d+\s+rows?\)\s*$")


@dataclass(slots=True)
class ParsedTable:
    title: str
    columns: list[str]
    rows: list[dict[str, Any]]


@dataclass(slots=True)
class ParsedDocument:
    title: str
    tables: list[ParsedTable]


def read_text_with_fallback(path: Path) -> str:
    for encoding in ("utf-8", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore")


def parse_psql_output(raw_text: str) -> ParsedDocument:
    lines = raw_text.splitlines()
    tables: list[ParsedTable] = []
    last_title = "Tabela"
    document_title = "Resposta"
    i = 0

    while i < len(lines):
        line = lines[i].rstrip("\n")
        stripped = line.strip()

        if stripped and "|" not in stripped and not SEPARATOR_RE.match(stripped):
            last_title = stripped
            if document_title == "Resposta" and stripped.lower().startswith("q"):
                document_title = stripped

        if _is_table_header(lines, i):
            header_line = lines[i]
            header = _split_row(header_line)
            i += 2
            rows: list[dict[str, Any]] = []

            while i < len(lines):
                current = lines[i].rstrip("\n")
                candidate = current.strip()
                if not candidate or ROW_COUNT_RE.match(candidate):
                    break
                if "|" not in current or SEPARATOR_RE.match(candidate):
                    break

                parts = _split_row(current)
                if len(parts) < len(header):
                    parts.extend([""] * (len(header) - len(parts)))
                if len(parts) > len(header):
                    parts = parts[: len(header)]

                rows.append(
                    {
                        header[idx]: _coerce_value(parts[idx])
                        for idx in range(len(header))
                    }
                )
                i += 1

            tables.append(ParsedTable(title=last_title, columns=header, rows=rows))
            continue

        i += 1

    return ParsedDocument(title=document_title, tables=tables)


def parse_psql_file(path: Path) -> ParsedDocument:
    return parse_psql_output(read_text_with_fallback(path))


def parse_data_file(path: Path) -> ParsedDocument:
    if path.suffix.lower() == ".csv":
        return parse_csv_file(path)
    return parse_psql_file(path)


def parse_csv_file(path: Path) -> ParsedDocument:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";", quotechar='"', doublequote=True)
        columns = list(reader.fieldnames or [])
        rows = [
            {column: _coerce_value(row.get(column, "")) for column in columns}
            for row in reader
        ]

    return ParsedDocument(
        title=path.stem,
        tables=[ParsedTable(title="Tabela principal", columns=columns, rows=rows)],
    )


def _is_table_header(lines: list[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    header = lines[index]
    separator = lines[index + 1].strip()
    return "|" in header and bool(SEPARATOR_RE.match(separator))


def _split_row(line: str) -> list[str]:
    parts = [part.strip() for part in line.split("|")]
    if parts and parts[0] == "":
        parts = parts[1:]
    if parts and parts[-1] == "":
        parts = parts[:-1]
    return parts


def _coerce_value(value: str) -> Any:
    cleaned = value.strip()
    if cleaned == "":
        return None

    normalized = cleaned.replace(",", ".")
    if re.fullmatch(r"-?\d+", normalized):
        try:
            return int(normalized)
        except ValueError:
            return cleaned
    if re.fullmatch(r"-?\d+\.\d+", normalized):
        try:
            return float(normalized)
        except ValueError:
            return cleaned
    return cleaned

