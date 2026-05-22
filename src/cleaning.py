"""
Funções de limpeza de dados para o ETL da Câmara dos Deputados.

Todas as funções:
- Aceitam None sem quebrar
- Retornam None para valores inválidos/vazios
- São puras (sem efeitos colaterais)
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation

import pandas as pd

# ============================================================
# Valores considerados nulos
# ============================================================

_NULL_VALUES = {"", "null", "none", "nan", "nat", "n/a", "na"}

# ============================================================
# Limpeza base
# ============================================================

def clean_null(val):
    """Converte valores nulos para None."""
    if val is None:
        return None
    if isinstance(val, float) and pd.isna(val):
        return None
    text = str(val).strip()
    if text.lower() in _NULL_VALUES:
        return None
    return text


def clean_text(val):
    """Limpa texto: strip + colapsa espaços múltiplos."""
    text = clean_null(val)
    if text is None:
        return None
    return " ".join(text.split())


def clean_upper(val):
    """Limpa e converte para maiúsculo (UF, siglas)."""
    text = clean_text(val)
    if text is None:
        return None
    return text.upper()


def remove_accents(val):
    """Remove acentos preservando o restante do texto."""
    text = clean_text(val)
    if text is None:
        return None
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def clean_party(val):
    """Padroniza siglas de partidos e bancadas."""
    text = remove_accents(val)
    if text is None:
        return None
    text = re.sub(r"\s+", "", text.upper())
    aliases = {
        "PCDOB.": "PCDOB",
        "REPUBLIC": "REPUBLICANOS",
        "REPUBLICANO": "REPUBLICANOS",
        "SOLIDARI": "SOLIDARIEDADE",
        "MISSAO": "MISSAO",
        "UNIAO": "UNIAO",
    }
    return aliases.get(text, text)


def clean_vote(val):
    """Padroniza votos e orientacoes para comparacoes simples."""
    text = remove_accents(val)
    if text is None:
        return None
    normalized = " ".join(text.split()).title()
    aliases = {
        "Nao": "Nao",
        "Sim": "Sim",
        "Abstencao": "Abstencao",
        "Obstrucao": "Obstrucao",
        "Artigo 17": "Artigo 17",
        "Liberado": "Liberado",
    }
    return aliases.get(normalized, normalized)


def clip_text(val, max_len):
    """Limpa texto e trunca no tamanho máximo."""
    text = clean_text(val)
    if text is None:
        return None
    return text[:max_len] if len(text) > max_len else text


# ============================================================
# Tipos numéricos
# ============================================================

def clean_int(val):
    """Converte para inteiro. Trata floats como '220593.0'."""
    text = clean_null(val)
    if text is None:
        return None
    text = text.replace(",", "")
    if re.match(r"^-?\d+(\.\d+)?$", text):
        return str(int(float(text)))
    return None


def clean_decimal(val):
    """Converte para decimal. Aceita formato BR e US."""
    text = clean_null(val)
    if text is None:
        return None
    text = text.replace(" ", "")
    # Formato BR: 1.234,56
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return str(Decimal(text))
    except InvalidOperation:
        return None


def clean_money(val):
    """Converte valor monetário BR para formato numérico.
    '1.234,56' → '1234.56'
    """
    text = clean_null(val)
    if text is None:
        return None
    text = text.replace(" ", "")
    # Formato BR: 1.234,56
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    try:
        val_dec = Decimal(text).quantize(Decimal("0.01"))
        return str(val_dec)
    except InvalidOperation:
        return None


# ============================================================
# CPF
# ============================================================

def clean_cpf(val):
    """Limpa CPF: remove pontuação, garante 11 dígitos, mantém como string."""
    text = clean_null(val)
    if text is None:
        return None
    digits = re.sub(r"\D", "", text)
    if len(digits) != 11:
        return None
    return digits


# ============================================================
# Datas
# ============================================================

def clean_date(val):
    """Converte data para formato YYYY-MM-DD."""
    text = clean_null(val)
    if text is None:
        return None
    try:
        dt = pd.to_datetime(text, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def clean_timestamp(val):
    """Converte timestamp para formato YYYY-MM-DD HH:MM:SS."""
    text = clean_null(val)
    if text is None:
        return None
    try:
        dt = pd.to_datetime(text, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


# ============================================================
# Booleanos
# ============================================================

def clean_boolean(val):
    """Converte Sim/Não, true/false, 1/0 para boolean PostgreSQL."""
    text = clean_null(val)
    if text is None:
        return None
    t = text.lower().strip()
    if t in ("1", "true", "t", "yes", "y", "sim"):
        return "true"
    if t in ("0", "false", "f", "no", "n", "nao", "não"):
        return "false"
    return None


# ============================================================
# URIs
# ============================================================

def extract_id_from_uri(val):
    """Extrai o último número de uma URI. Ex: '.../deputados/220593' → '220593'."""
    text = clean_null(val)
    if text is None:
        return None
    match = re.search(r"/(\d+)$", text)
    return match.group(1) if match else None
