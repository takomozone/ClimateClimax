#!/usr/bin/env python3
"""Aggregate FMI 10 km monthly temperature grids into annual Finland means."""

import calendar
import glob
import json
import os
import sys

import numpy as np
from netCDF4 import Dataset


source_dir = sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/fmi-temperature-grids"
rows = []

for path in sorted(glob.glob(os.path.join(source_dir, "tmon_*.nc"))):
    year = int(os.path.basename(path)[5:9])
    with Dataset(path) as dataset:
        grid = dataset.variables["Tmon"][:]
        monthly_means = np.ma.mean(grid, axis=(1, 2))
    days = np.array([calendar.monthrange(year, month)[1] for month in range(1, 13)])
    rows.append({"year": year, "temperature": round(float(np.ma.average(monthly_means, weights=days)), 2)})

years = np.array([row["year"] for row in rows])
temperatures = np.array([row["temperature"] for row in rows])
slope, intercept = np.polyfit(years, temperatures, 1)

for index, row in enumerate(rows):
    window = temperatures[max(0, index - 9):index + 1]
    row["movingAverage"] = round(float(window.mean()), 2) if len(window) == 10 else None
    row["trend"] = round(float(slope * row["year"] + intercept), 2)

output = {
    "title": "Finland annual mean temperature",
    "period": f"{rows[0]['year']}–{rows[-1]['year']}",
    "unit": "°C",
    "trendPerDecade": round(float(slope * 10), 2),
    "method": "Daily-weighted annual mean of monthly FMI 10 km gridded temperatures across valid Finland land cells.",
    "source": "Finnish Meteorological Institute, Monthly mean temperature 10 km grids",
    "sourceUrl": "https://paituli.csc.fi/download.html?data_id=il_monthly_mean_temp_10km_netcdf_euref",
    "rows": rows,
}

with open("data/finland-temperature.json", "w", encoding="utf-8") as file:
    json.dump(output, file, indent=2, ensure_ascii=False)
    file.write("\n")
