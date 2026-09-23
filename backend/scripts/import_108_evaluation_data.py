"""Create a minimized, anonymized evaluation CSV from the supplied 108 workbook.

This is an offline import utility. It deliberately excludes patient demographics,
staff identifiers, remarks, odometer readings, and detailed timestamps.
"""
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home() / "Downloads" / "dummy_ambulance_data.xlsx"
DESTINATION = ROOT / "Datasets" / "Datasets" / "tamil_nadu_108_evaluation.csv"

def seconds(value):
    if pd.isna(value):
        return ""
    if isinstance(value, pd.Timedelta):
        return int(value.total_seconds())
    parts = str(value).strip().split(":")
    if len(parts) != 3:
        return ""
    try:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
    except ValueError:
        return ""

def text(value):
    return "" if pd.isna(value) else str(value).strip()

def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source workbook not found: {SOURCE}")
    data = pd.read_excel(SOURCE)
    rows = []
    for _, row in data.iterrows():
        response_seconds = seconds(row["Response Time"])
        benchmark_seconds = seconds(row["Bench Mark"])
        rows.append({
            "caseId": text(row["Case_ID"]),
            "callType": text(row["Emergency / IFT"]),
            "callerDistrict": text(row["Caller District"]),
            "callerTaluk": text(row["Caller Taluk"]),
            "critical": text(row["is_critical"]),
            "triage": text(row["triage"]),
            "vehicleType": text(row["Vehicle Type"]),
            "emergencyType": text(row["Emergency Type - New"]),
            "hospitalType": text(row["Hospital_Type"]),
            "area": text(row["Area"]),
            "hour": text(row["Hour"]),
            "baseToSceneKm": row["BS(KM)"],
            "sceneToHospitalKm": row["SH(KM)"],
            "baseToSceneSeconds": seconds(row["BS (hms)"]),
            "sceneToHospitalSeconds": seconds(row["SH(hms)"]),
            "responseSeconds": response_seconds,
            "benchmarkSeconds": benchmark_seconds,
            "metBenchmark": "" if response_seconds == "" or benchmark_seconds == "" else str(response_seconds <= benchmark_seconds).lower(),
        })
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(DESTINATION, index=False)
    print(f"Wrote {len(rows)} anonymized evaluation records to {DESTINATION}")

if __name__ == "__main__":
    main()
