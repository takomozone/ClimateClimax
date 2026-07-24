import fs from 'node:fs';

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const specs = [
  { id:'muonio-pine', name:'Muonio ELU01', rwl:'/private/tmp/fin100.rwl', climate:'/private/tmp/muonio-climate.json', lat:67.63, lon:23.95, elevation:340, country:'Finland', species:'Scots pine', scientific:'Pinus sylvestris', end:2013 },
  { id:'muonio-spruce', name:'Muonio ELU02', rwl:'/private/tmp/fin101.rwl', climate:'/private/tmp/muonio-climate.json', lat:67.63, lon:23.95, elevation:340, country:'Finland', species:'Norway spruce', scientific:'Picea abies', end:2013 },
  { id:'kuusipaa-wet', name:'Kuusipää Wet ELK01', rwl:'/private/tmp/fin098.rwl', climate:'/private/tmp/kuusipaa-climate.json', lat:68.45, lon:27.37, elevation:300, country:'Finland', species:'Norway spruce', scientific:'Picea abies', end:2011 },
  { id:'pitkajarvi-pine', name:'Pitkäjärvi Lake HLP01', rwl:'/private/tmp/fin102.rwl', climate:'/private/tmp/pitkajarvi-climate.json', lat:67.50, lon:24.12, elevation:220, country:'Finland', species:'Scots pine', scientific:'Pinus sylvestris', end:2016 },
  { id:'liesjarvi-spruce', name:'Kyynärä, Liesjärvi FINL012', rwl:'/private/tmp/finl012.rwl', climate:'/private/tmp/liesjarvi-climate.json', lat:60.67, lon:23.88, elevation:115, country:'Finland', species:'Norway spruce', scientific:'Picea abies', end:1978 },
  { id:'kovero-spruce', name:'Kovero FINL013', rwl:'/private/tmp/finl013.rwl', climate:'/private/tmp/kovero-climate.json', lat:61.83, lon:23.48, elevation:180, country:'Finland', species:'Norway spruce', scientific:'Picea abies', end:1978 },
  { id:'jokkmokk-wet', name:'Jokkmokk Wet SWED340', rwl:'/private/tmp/swed340.rwl', climate:'/private/tmp/jokkmokk-climate.json', lat:66.65, lon:20.11, elevation:302, country:'Sweden', species:'Scots pine', scientific:'Pinus sylvestris', end:2013 },
  { id:'stockholm-wet', name:'Stockholm Wet SWED344', rwl:'/private/tmp/swed344.rwl', climate:'/private/tmp/stockholm-climate.json', lat:59.44, lon:17.99, elevation:20, country:'Sweden', species:'Scots pine', scientific:'Pinus sylvestris', end:2009 },
  { id:'jaervselja-oak', name:'Järvselja EJAER', format:'fh', measurements:'/private/tmp/estonia-jaervselja/originalvalues', metadata:'/private/tmp/estonia-jaervselja/tridas.xml', climate:'/private/tmp/jaervselja-climate.json', lat:58.37090278, lon:26.714675, elevation:null, country:'Estonia', species:'Oak', scientific:'Quercus', end:1998 }
];

function buildSite(spec) {
  const climate = JSON.parse(fs.readFileSync(spec.climate, 'utf8'));
  const rings = new Map(), annual = new Map();
  if (spec.format === 'fh') {
    const xml = fs.readFileSync(spec.metadata, 'utf8');
    for (const block of xml.matchAll(/<tridas:measurementSeries\b[\s\S]*?<\/tridas:measurementSeries>/g)) {
      const series = block[0];
      const code = series.match(/<tridas:title>(EJAER\d+)<\/tridas:title>/)?.[1];
      const firstYear = Number(series.match(/<tridas:firstYear[^>]*>(\d+)<\/tridas:firstYear>/)?.[1]);
      const lastYear = Number(series.match(/<tridas:lastYear[^>]*>(\d+)<\/tridas:lastYear>/)?.[1]);
      if (!code || !Number.isFinite(firstYear) || !Number.isFinite(lastYear)) continue;
      const text = fs.readFileSync(`${spec.measurements}/${code}.fh`, 'utf8');
      const values = text.split('DATA:Tree')[1]?.match(/-?\d+/g)?.map(Number) || [];
      values.slice(0, lastYear - firstYear + 1).forEach((value, i) => {
        if (value <= 0) return;
        const year = firstYear + i;
        if (!rings.has(year)) rings.set(year, []);
        rings.get(year).push(value / 100);
      });
    }
  } else {
    const lines = fs.readFileSync(spec.rwl, 'utf8').split(/\r?\n/).slice(3);
    for (const line of lines) {
      const decade = Number(line.slice(8, 12));
      if (!Number.isFinite(decade)) continue;
      for (let i = 0; i < 10; i++) {
        const value = Number(line.slice(12 + i * 6, 18 + i * 6).trim());
        if (value > 0 && value < 900) {
          const year = decade + i;
          if (!rings.has(year)) rings.set(year, []);
          rings.get(year).push(value / 100);
        }
      }
    }
  }
  climate.daily.time.forEach((date, i) => {
    const year = Number(date.slice(0, 4));
    if (!annual.has(year)) annual.set(year, { temp: [], rain: [] });
    const row = annual.get(year), temp = climate.daily.temperature_2m_mean[i], rain = climate.daily.precipitation_sum[i];
    if (temp != null) row.temp.push(temp);
    if (rain != null) row.rain.push(rain);
  });
  const years = [];
  for (let year = 1961; year <= spec.end; year++) {
    const ring = rings.get(year), c = annual.get(year);
    if (!ring?.length || !c?.temp.length) continue;
    years.push({ year, ring:+mean(ring).toFixed(3), samples:ring.length, temp:+mean(c.temp).toFixed(2), rain:+c.rain.reduce((s,v)=>s+v,0).toFixed(1) });
  }
  return { site:{ id:spec.id, name:spec.name, lat:spec.lat, lon:spec.lon, elevation:spec.elevation, country:spec.country, species:spec.species, scientific:spec.scientific }, years };
}

fs.mkdirSync('data', { recursive: true });
const existingSites = fs.existsSync('data/sites.json')
  ? new Map(JSON.parse(fs.readFileSync('data/sites.json', 'utf8')).sites.map(entry => [entry.site.id, entry]))
  : new Map();
const sites = specs.map(spec => {
  try {
    return buildSite(spec);
  } catch (error) {
    const existing = existingSites.get(spec.id);
    if (error.code !== 'ENOENT' || !existing) throw error;
    return { ...existing, site:{ ...existing.site, country:spec.country } };
  }
});
fs.writeFileSync('data/sites.json', JSON.stringify({ sites }, null, 2));
