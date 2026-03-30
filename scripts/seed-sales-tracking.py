#!/usr/bin/env python3
"""Parse sales tracking CSVs and output SQL INSERT statements for sales_tracking table."""

import csv
import os
import re
import sys

CSV_DIR = os.path.join(os.path.dirname(__file__), "..", "sheet", "sales")

MONTH_MAP = {
    "JAN": ("2026", "01"),
    "FEB": ("2026", "02"),
    "MARCH": ("2026", "03"),
    "APRIL": ("2026", "04"),
}

METRIC_MAP = {
    "calls booked": "calls_booked",
    "calls taken": "calls_taken",
    "closes #": "closes",
    "cc": "cc",
    "no shows": "no_shows",
    "cancellation": "cancellations",
    "cancellations": "cancellations",
    "reschedules": "reschedules",
}

SKIP_METRICS = {"show rate", "close rate"}

KNOWN_REPS = {
    "Joel", "Richard", "Jake", "Mari", "Callum", "Jordan", "Kornelius",
    "Alec", "Henry", "AJ", "Julian", "Jamie", "Casey", "Kevin", "Harry",
    "Jack", "Meghna",
}

SKIP_ROWS = {
    "TEAM DAY", "Source Show rate", "Show rate to Call",
    "Show rate to Call (excluding pre-call cancels & Reschedules)",
    "Skool A", "Skool C", "Skool P", "Masterclass", "Phone", "Email",
    "Website", "Website B", "Website C", "Closes",
}


def parse_currency(val: str) -> int:
    """Parse currency string like '$9,500' or '4000' to integer."""
    if not val or not val.strip():
        return 0
    s = val.strip().replace("$", "").replace(",", "").replace('"', "")
    if not s or s == "#DIV/0!" or s == "#REF!":
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_int(val: str) -> int:
    """Parse integer value, handling empty and error strings."""
    if not val or not val.strip():
        return 0
    s = val.strip().replace(",", "")
    if s in ("#DIV/0!", "#REF!"):
        return 0
    # Handle percentage strings (skip them)
    if "%" in s:
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def get_day_columns(header_row):
    """Map column index → day number for columns that have numeric day values."""
    day_cols = {}
    for j, cell in enumerate(header_row):
        cell = cell.strip()
        if cell.isdigit():
            day_cols[j] = int(cell)
    return day_cols


def process_csv(filepath, year, month):
    """Parse a single CSV and return list of (rep_name, date, metric, value) tuples."""
    with open(filepath, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    if len(rows) < 3:
        return []

    # Row 1 has day numbers
    day_cols = get_day_columns(rows[1])

    results = []  # (rep_name, day, metric_field, value)
    current_rep = None

    for row in rows[2:]:  # Skip header rows
        if not row:
            continue

        cell = row[0].strip()

        # Skip empty rows
        if not cell:
            continue

        # Skip known non-rep rows
        if cell in SKIP_ROWS:
            continue

        # Check if this is a rep name
        if cell in KNOWN_REPS:
            current_rep = cell
            continue

        # Check if this is a metric row
        cell_lower = cell.lower().strip()
        if cell_lower in SKIP_METRICS:
            continue

        metric_field = METRIC_MAP.get(cell_lower)
        if not metric_field or not current_rep:
            continue

        # Extract daily values
        for col_idx, day_num in day_cols.items():
            if col_idx >= len(row):
                continue

            raw = row[col_idx]
            if metric_field == "cc":
                val = parse_currency(raw)
            else:
                val = parse_int(raw)

            if val != 0:  # Only store non-zero to reduce SQL size
                date_str = f"{year}-{month}-{day_num:02d}"
                results.append((current_rep, date_str, metric_field, val))

    return results


def main():
    all_data = {}  # (rep_name, date) → {field: value}

    files = sorted(f for f in os.listdir(CSV_DIR) if f.endswith(".csv"))

    for fname in files:
        # Extract month from filename
        match = re.search(r"- (\w+)\.csv$", fname)
        if not match:
            continue
        month_key = match.group(1).upper()
        if month_key not in MONTH_MAP:
            continue

        year, month = MONTH_MAP[month_key]
        filepath = os.path.join(CSV_DIR, fname)

        print(f"-- Processing {fname} ({year}-{month})", file=sys.stderr)
        results = process_csv(filepath, year, month)
        print(f"--   Found {len(results)} data points", file=sys.stderr)

        for rep_name, date_str, metric_field, value in results:
            key = (rep_name, date_str)
            if key not in all_data:
                all_data[key] = {
                    "calls_booked": 0,
                    "calls_taken": 0,
                    "closes": 0,
                    "cc": 0,
                    "no_shows": 0,
                    "cancellations": 0,
                    "reschedules": 0,
                }
            all_data[key][metric_field] = value

    # Generate SQL
    print("-- Sales tracking seed data")
    print(f"-- Generated from {len(files)} CSV files")
    print(f"-- Total rows: {len(all_data)}")
    print()

    batch = []
    for (rep_name, date_str), metrics in sorted(all_data.items()):
        rep_escaped = rep_name.replace("'", "''")
        vals = (
            f"('{rep_escaped}', '{date_str}', "
            f"{metrics['calls_booked']}, {metrics['calls_taken']}, "
            f"{metrics['closes']}, {metrics['cc']}, "
            f"{metrics['no_shows']}, {metrics['cancellations']}, "
            f"{metrics['reschedules']})"
        )
        batch.append(vals)

    # Output in batches of 100 for SQL editor compatibility
    for i in range(0, len(batch), 100):
        chunk = batch[i:i+100]
        print(f"INSERT INTO sales_tracking (rep_name, date, calls_booked, calls_taken, closes, cc, no_shows, cancellations, reschedules) VALUES")
        print(",\n".join(chunk))
        print("ON CONFLICT (rep_name, date) DO UPDATE SET")
        print("  calls_booked = EXCLUDED.calls_booked,")
        print("  calls_taken = EXCLUDED.calls_taken,")
        print("  closes = EXCLUDED.closes,")
        print("  cc = EXCLUDED.cc,")
        print("  no_shows = EXCLUDED.no_shows,")
        print("  cancellations = EXCLUDED.cancellations,")
        print("  reschedules = EXCLUDED.reschedules;")
        print()


if __name__ == "__main__":
    main()
