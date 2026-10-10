"""Tiny SQLite store: one table per record type, each row is an id plus a JSON document."""
import json
import os
import sqlite3
from pathlib import Path

PATH = os.getenv("DATABASE_PATH", str(Path(__file__).parent / "data" / "easywrite.db"))
TABLES = ("events", "prospects", "drafts", "certs")


def _conn():
    c = sqlite3.connect(PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    Path(PATH).parent.mkdir(parents=True, exist_ok=True)
    with _conn() as c:
        for t in TABLES:
            c.execute(f"CREATE TABLE IF NOT EXISTS {t} (id TEXT PRIMARY KEY, doc TEXT NOT NULL)")


def put(table: str, id_: str, doc: dict):
    assert table in TABLES
    with _conn() as c:
        c.execute(f"INSERT INTO {table}(id, doc) VALUES (?, ?) "
                  f"ON CONFLICT(id) DO UPDATE SET doc = excluded.doc", (id_, json.dumps(doc)))


def get(table: str, id_: str):
    assert table in TABLES
    with _conn() as c:
        r = c.execute(f"SELECT doc FROM {table} WHERE id = ?", (id_,)).fetchone()
    return json.loads(r["doc"]) if r else None


def all_(table: str) -> list[dict]:
    assert table in TABLES
    with _conn() as c:
        return [json.loads(r["doc"]) for r in c.execute(f"SELECT doc FROM {table}")]


def delete(table: str, id_: str) -> bool:
    assert table in TABLES
    with _conn() as c:
        return c.execute(f"DELETE FROM {table} WHERE id = ?", (id_,)).rowcount > 0
