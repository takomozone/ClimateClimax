import fs from 'node:fs';

const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const specs = [
  { id:'muonio-pine', name:'Muonio ELU01', rwl:'/private/tmp/fin100.rwl', climate:'/private/tmp/muonio-climate.json', lat:67.63, lon:23.95, elevation:340, species:'Scots pine', scientific:'Pinus sylvestris', end:2013 },
  { id:'muonio-spruce', name:'Muonio ELU02', rwl:'/private/tmp/fin101.rwl', climate:'/private/tmp/muonio-climate.json', lat:67.63, lon:23.95, elevation:340, species:'Norway spruce', scientific:'Picea abies', end:2013 },
  { id:'kuusipaa-wet', name:'Kuusipää Wet ELK01', rwl:'/private/tmp/fin098.rwl', climate:'/private/tmp/kuusipaa-climate.json', lat:68.45, lon:27.37, elevation:300, species:'Norway spruce', scientific:'Picea abies', end:2011 },
  { id:'pitkajarvi-pine', name:'Pitkäjärvi Lake HLP01', rwl:'/private/tmp/fin102.rwl', climate:'/private/tmp/pitkajarvi-climate.json', lat:67.50, lon:24.12, elevation:220, species:'Scots pine', scientific:'Pinus sylvestris', end:2016 },
  { id:'liesjarvi-spruce', name:'Kyynärä, Liesjärvi FINL012', rwl:'/private/tmp/finl012.rwl', climate:'/private/tmp/liesjarvi-climate.json', lat:60.67, lon:23.88, elevation:115, species:'Norway spruce', scientific:'Picea abies', end:1978 },
  { id:'kovero-spruce', name:'Kovero FINL013', rwl:'/private/tmp/finl013.rwl', climate:'/private/tmp/kovero-climate.json', lat:61.83, lon:23.48, elevation:180, species:'Norway spruce', scientific:'Picea abies', end:1978 }
];

function buildSite(spec) {
  const lines = fs.readFileSync(spec.rwl, 'utf8').split(/\r?\n/).slice(3);
  const climate = JSON.parse(fs.readFileSync(spec.climate, 'utf8'));
  const rings = new Map(), annual = new Map();
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
  return { site:{ id:spec.id, name:spec.name, lat:spec.lat, lon:spec.lon, elevation:spec.elevation, species:spec.species, scientific:spec.scientific }, years };
}

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/sites.json', JSON.stringify({ sites: specs.map(buildSite) }, null, 2));
