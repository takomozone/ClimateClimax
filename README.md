# TreePulse Finland

Interactive research prototype comparing annual Scots pine ring width with temperature and precipitation in Finland.

## Run

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Data

- NOAA International Tree-Ring Data Bank, Muonio ELU01/ELU02, Kuusipää ELK01, Pitkäjärvi HLP01, Kyynärä/Liesjärvi FINL012 and Kovero FINL013, raw ring widths.
- Open-Meteo Historical Weather API (ERA5 / ERA5-Land), daily temperature and precipitation aggregated annually for research sites.
- Luke GRAF and 2026 NFI spruce research are linked as Finnish research context.
- LiPheStream, Hyytiälä: 103 terrestrial LiDAR observations of 458 trees from April 2020 to September 2021.
- Luke MVMI 2021: nationwide 16 m forest-resource rasters covering stand age, height, diameter, canopy, biomass and volume.
- FMI monthly temperature and precipitation 10 km grids: annual values for national trends and instant map-coordinate lookup from 1970–2025.

The displayed Pearson correlations are exploratory. Raw ring width retains biological age trends and other non-climatic influences.
