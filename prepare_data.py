"""
prepare_data.py — F1 Dashboard Data Preparation
Reads CSV files, cleans data, joins tables, exports JSON to data/
"""
import pandas as pd
import json

DATA_DIR = "data/"

# ── 1. Load & summarize ────────────────────────────────────────────────────────
def load_csv(name):
    df = pd.read_csv(f"{DATA_DIR}{name}.csv", na_values=["\\N", "NULL", ""])
    # Drop duplicate rows keeping the api source over historical when both exist
    if "source" in df.columns:
        df = df.sort_values("source", ascending=False)  # 'historical' < 'api' alphabetically? reverse: api first
        # actually: prefer api over historical — sort desc so 'historical' < 'api' means api comes first
        pk_cols = [c for c in df.columns if c.endswith("Id") and df.columns.get_loc(c) == 0]
        if pk_cols:
            df = df.drop_duplicates(subset=pk_cols, keep="first")
        df = df.drop(columns=["source"], errors="ignore")
    print(f"  {name}: shape={df.shape}, cols={list(df.columns)}")
    print(f"    head(2):\n{df.head(2).to_string(index=False)}\n")
    return df

print("=== Loading files ===")
results       = load_csv("results")
races         = load_csv("races")
drivers       = load_csv("drivers")
constructors  = load_csv("constructors")
status        = load_csv("status")
drv_standings = load_csv("driver_standings")
con_standings = load_csv("constructor_standings")
qualifying    = load_csv("qualifying")

# ── 2. Select only needed columns ─────────────────────────────────────────────
results = results[[
    "resultId","raceId","driverId","constructorId",
    "grid","position","positionText","positionOrder",
    "points","laps","statusId"
]]

races = races[["raceId","year","round","name","date","circuitId"]]

drivers = drivers[["driverId","driverRef","forename","surname","nationality","dob"]]
drivers["driver_name"] = drivers["forename"] + " " + drivers["surname"]

constructors = constructors[["constructorId","constructorRef","name"]].rename(
    columns={"name": "constructor_name"}  # type: ignore[call-overload]
)

status = status[["statusId","status"]]

# ── 3. Build race_results_full ────────────────────────────────────────────────
print("=== Building race_results_full ===")
before = len(results)

rf = results.merge(races,        on="raceId",        how="left")
rf = rf.merge(drivers,           on="driverId",      how="left")
rf = rf.merge(constructors,      on="constructorId", how="left")
rf = rf.merge(status,            on="statusId",      how="left")

after = len(rf)
print(f"  results rows before={before}, after join={after}")
assert after == before, f"Row count changed: {before} -> {after}"

# Check for unmatched IDs
null_race   = rf["year"].isna().sum()
null_driver = rf["driver_name"].isna().sum()
null_cons   = rf["constructor_name"].isna().sum()
print(f"  Unmatched: raceId={null_race}, driverId={null_driver}, constructorId={null_cons}")

# ── 4. Clean numeric columns ──────────────────────────────────────────────────
rf["grid"]          = pd.Series(pd.to_numeric(rf["grid"],          errors="coerce"))
rf["position"]      = pd.Series(pd.to_numeric(rf["position"],      errors="coerce"))
rf["positionOrder"] = pd.Series(pd.to_numeric(rf["positionOrder"], errors="coerce"))
rf["points"]        = pd.Series(pd.to_numeric(rf["points"],        errors="coerce")).fillna(0)
rf["year"]          = pd.Series(pd.to_numeric(rf["year"],          errors="coerce"))

# DNF flag: statusId != 1 (Finished) and no valid position
rf["dnf"] = (~rf["positionText"].isin(["1","2","3","4","5","6","7","8","9","10",
                                        "11","12","13","14","15","16","17","18","19","20","21","22",
                                        "23","24","25","26"])).astype(int)

# Keep only essential cols
rf_export = rf[[
    "resultId","raceId","year","round","name","date",
    "driverId","driverRef","driver_name","nationality",
    "constructorId","constructorRef","constructor_name",
    "grid","position","positionOrder","positionText",
    "points","laps","statusId","status","dnf"
]]

print(f"  race_results_full shape: {rf_export.shape}")

# ── 5. Clean driver_standings ─────────────────────────────────────────────────
print("=== Preparing driver_standings ===")
# drop source col if present (already removed in load_csv), join year from races
ds = drv_standings.copy()
if "driverStandingsId" in ds.columns:
    ds = ds.drop(columns=["driverStandingsId"], errors="ignore")

race_years = races[["raceId","year","round"]].copy()
ds = ds.merge(pd.DataFrame(race_years), on="raceId", how="left")
ds = ds.merge(pd.DataFrame(drivers[["driverId","driver_name","driverRef"]]), on="driverId", how="left")
ds["points"]   = pd.Series(pd.to_numeric(ds["points"],   errors="coerce")).fillna(0)
ds["position"] = pd.Series(pd.to_numeric(ds["position"], errors="coerce"))
ds["wins"]     = pd.Series(pd.to_numeric(ds["wins"],     errors="coerce")).fillna(0)
ds["year"]     = pd.Series(pd.to_numeric(ds["year"],     errors="coerce"))
ds["round"]    = pd.Series(pd.to_numeric(ds["round"],    errors="coerce"))
ds_export = ds[["raceId","year","round","driverId","driverRef","driver_name","points","position","wins"]]
print(f"  driver_standings shape: {ds_export.shape}")

# ── 6. Clean constructor_standings ────────────────────────────────────────────
print("=== Preparing constructor_standings ===")
cs = con_standings.copy()
if "constructorStandingsId" in cs.columns:
    cs = cs.drop(columns=["constructorStandingsId"], errors="ignore")

cs = cs.merge(pd.DataFrame(race_years), on="raceId", how="left")
cs = cs.merge(pd.DataFrame(constructors[["constructorId","constructor_name","constructorRef"]]), on="constructorId", how="left")
cs["points"]   = pd.Series(pd.to_numeric(cs["points"],   errors="coerce")).fillna(0)
cs["position"] = pd.Series(pd.to_numeric(cs["position"], errors="coerce"))
cs["wins"]     = pd.Series(pd.to_numeric(cs["wins"],     errors="coerce")).fillna(0)
cs["year"]     = pd.Series(pd.to_numeric(cs["year"],     errors="coerce"))
cs["round"]    = pd.Series(pd.to_numeric(cs["round"],    errors="coerce"))
cs_export = cs[["raceId","year","round","constructorId","constructorRef","constructor_name","points","position","wins"]]
print(f"  constructor_standings shape: {cs_export.shape}")

# ── 7. Build meta.json ────────────────────────────────────────────────────────
_years_series: pd.Series = rf_export["year"].dropna()  # type: ignore[assignment]
years = sorted(_years_series.unique().astype(int).tolist(), reverse=True)
_drivers_df: pd.DataFrame = rf_export[["driverId","driverRef","driver_name"]]  # type: ignore[assignment]
drivers_list = (
    _drivers_df
    .drop_duplicates()
    .sort_values("driver_name")
    .to_dict(orient="records")
)
meta = {"years": years, "drivers": drivers_list}

# ── 8. Build qualifying.json ──────────────────────────────────────────────────
print("=== Preparing qualifying ===")
q = qualifying[["raceId","driverId","position","q1","q2","q3"]].copy()
q = q.merge(pd.DataFrame(races[["raceId","year","round","name"]]), on="raceId", how="left")
q = q.merge(pd.DataFrame(drivers[["driverId","driver_name","driverRef"]]), on="driverId", how="left")
q["position"] = pd.Series(pd.to_numeric(q["position"], errors="coerce"))
q["year"]     = pd.Series(pd.to_numeric(q["year"],     errors="coerce"))
q["round"]    = pd.Series(pd.to_numeric(q["round"],    errors="coerce"))
q_export = q[["raceId","year","round","name","driverId","driverRef","driver_name","position","q1","q2","q3"]]
print(f"  qualifying shape: {q_export.shape}")

# ── 9. Export JSON ─────────────────────────────────────────────────────────────
def to_json(df, path):
    # Convert NaN/NaT to None for JSON serialization
    records = df.where(pd.notnull(df), other=None).to_dict(orient="records")
    # Replace any residual float NaN (from int columns that became float) with None
    def clean(v):
        if isinstance(v, float) and (v != v):  # NaN check
            return None
        return v
    records = [{k: clean(v) for k, v in row.items()} for row in records]
    with open(path, "w") as f:
        json.dump(records, f, separators=(",", ":"), default=str)
    print(f"  Exported {path} ({len(records)} records)")

print("=== Exporting JSON ===")
to_json(rf_export,  f"{DATA_DIR}race_results_full.json")
to_json(ds_export,  f"{DATA_DIR}driver_standings.json")
to_json(cs_export,  f"{DATA_DIR}constructor_standings.json")
to_json(q_export,   f"{DATA_DIR}qualifying.json")

with open(f"{DATA_DIR}meta.json", "w") as f:
    json.dump(meta, f, separators=(",", ":"))
print(f"  Exported {DATA_DIR}meta.json ({len(years)} years, {len(drivers_list)} drivers)")

print("\n=== Done ===")
