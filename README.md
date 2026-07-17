# TreePulse Finland

Interactive research prototype comparing annual Scots pine ring width with temperature and precipitation in Finland.

## Run

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Data

- NOAA International Tree-Ring Data Bank, Muonio ELU01/ELU02, Kuusipää ELK01 and Pitkäjärvi HLP01, raw ring widths.
- Open-Meteo Historical Weather API (ERA5-Land), daily mean temperature and precipitation aggregated annually for the Muonio coordinates.
- Luke GRAF and 2026 NFI spruce research are linked as Finnish research context.

The displayed Pearson correlations are exploratory. Raw ring width retains biological age trends and other non-climatic influences.
