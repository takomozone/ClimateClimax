#!/usr/bin/env python3
"""Aggregate FMI 10 km monthly climate grids into annual Finland values."""

import calendar
import glob
import json
import os
import sys

import numpy as np
from netCDF4 import Dataset


temperature_dir = sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/fmi-temperature-grids"
precipitation_dir = sys.argv[2] if len(sys.argv) > 2 else "/private/tmp/fmi-precipitation-grids"
rows = []
temperature_grids = {}
precipitation_grids = {}
eastings = None
northings = None

for path in sorted(glob.glob(os.path.join(temperature_dir, "tmon_*.nc"))):
    year = int(os.path.basename(path)[5:9])
    with Dataset(path) as dataset:
        grid = dataset.variables["Tmon"][:]
        monthly_means = np.ma.mean(grid, axis=(1, 2))
        easting_name = "easting" if "easting" in dataset.variables else "Lon"
        northing_name = "northing" if "northing" in dataset.variables else "Lat"
        eastings = dataset.variables[easting_name][:].tolist()
        northings = dataset.variables[northing_name][:].tolist()
    days = np.array([calendar.monthrange(year, month)[1] for month in range(1, 13)])
    temperature_grids[year] = np.ma.average(grid, axis=0, weights=days)
    rows.append({"year": year, "temperature": round(float(np.ma.average(monthly_means, weights=days)), 2)})

precipitation_by_year = {}
for path in sorted(glob.glob(os.path.join(precipitation_dir, "rrmon_*.nc"))):
    year = int(os.path.basename(path)[6:10])
    with Dataset(path) as dataset:
        grid = dataset.variables["RRmon"][:]
        monthly_means = np.ma.mean(grid, axis=(1, 2))
    precipitation_grids[year] = np.ma.sum(grid, axis=0)
    precipitation_by_year[year] = round(float(np.ma.sum(monthly_means)), 1)

for row in rows:
    row["precipitation"] = precipitation_by_year[row["year"]]

years = np.array([row["year"] for row in rows])
temperatures = np.array([row["temperature"] for row in rows])
slope, intercept = np.polyfit(years, temperatures, 1)

for index, row in enumerate(rows):
    window = temperatures[max(0, index - 9):index + 1]
    row["movingAverage"] = round(float(window.mean()), 2) if len(window) == 10 else None
    row["trend"] = round(float(slope * row["year"] + intercept), 2)

output = {
    "title": "Finland annual climate",
    "period": f"{rows[0]['year']}–{rows[-1]['year']}",
    "unit": "°C",
    "trendPerDecade": round(float(slope * 10), 2),
    "method": "Daily-weighted annual mean temperature and annual precipitation sum from monthly FMI 10 km grids, spatially averaged across valid Finland land cells.",
    "source": "Finnish Meteorological Institute, Monthly temperature and precipitation 10 km grids",
    "sourceUrl": "https://paituli.csc.fi/download.html?data_id=il_monthly_mean_temp_10km_netcdf_euref",
    "precipitationSourceUrl": "https://paituli.csc.fi/download?data_id=il_monthly_precipitation_10km_netcdf_euref",
    "rows": rows,
}

with open("data/finland-temperature.json", "w", encoding="utf-8") as file:
    json.dump(output, file, indent=2, ensure_ascii=False)
    file.write("\n")

valid_cells = np.ones(temperature_grids[rows[0]["year"]].shape, dtype=bool)
for year in years:
    valid_cells &= ~np.ma.getmaskarray(temperature_grids[int(year)])
    valid_cells &= ~np.ma.getmaskarray(precipitation_grids[int(year)])
cell_indices = np.flatnonzero(valid_cells)

grid_output = {
    "title": "FMI coordinate climate grid",
    "period": output["period"],
    "projection": "+proj=utm +zone=35 +ellps=GRS80 +units=m +no_defs",
    "width": len(eastings),
    "easting": [round(float(value), 1) for value in eastings],
    "northing": [round(float(value), 1) for value in northings],
    "cells": cell_indices.tolist(),
    "years": [int(year) for year in years],
    "temperature": [[round(float(value), 2) for value in temperature_grids[int(year)].filled(np.nan).ravel()[cell_indices]] for year in years],
    "precipitation": [[round(float(value), 1) for value in precipitation_grids[int(year)].filled(np.nan).ravel()[cell_indices]] for year in years],
    "source": output["source"],
    "sourceUrl": "https://en.ilmatieteenlaitos.fi/statistics-from-1961-onwards",
}

with open("data/finland-climate-grid.json", "w", encoding="utf-8") as file:
    json.dump(grid_output, file, separators=(",", ":"), ensure_ascii=False)
    file.write("\n")
