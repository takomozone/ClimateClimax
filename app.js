let dataset, activeSite, growthChart, rainChart, siteMarkers = [];

const pearson = (rows, key) => {
  const xs=rows.map(d=>d.ring),ys=rows.map(d=>d[key]),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  const num=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0),den=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
  return num/den;
};

function setupMap(){
  const map=L.map('map',{zoomControl:false}).setView([65.2,25.8],5);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap'}).addTo(map);
  dataset.sites.forEach((entry,index)=>{
    const s=entry.site,marker=L.marker([s.lat,s.lon],{icon:makeIcon(index===0),title:`Select ${s.name}`}).addTo(map).bindTooltip(`${s.name} · ${s.species}`,{direction:'top'});
    marker.on('click',()=>selectSite(index));siteMarkers.push(marker);
  });
  document.getElementById('recenter').onclick=()=>map.setView([65.2,25.8],5);
}

function makeIcon(selected){return L.divIcon({className:`site-icon${selected?' selected':''}`,iconSize:[16,16]})}

function selectSite(index){
  activeSite=dataset.sites[index];
  siteMarkers.forEach((marker,i)=>marker.setIcon(makeIcon(i===index)));
  const s=activeSite.site;
  document.getElementById('siteName').textContent=s.name;
  document.getElementById('siteMeta').textContent=`${s.species} · ${s.lat.toFixed(2)}°N, ${s.lon.toFixed(2)}°E · ${s.elevation} m`;
  const start=document.getElementById('startYear'),end=document.getElementById('endYear'),years=activeSite.years.map(d=>d.year);
  start.replaceChildren();end.replaceChildren();years.forEach(y=>{start.add(new Option(y,y));end.add(new Option(y,y));});
  start.value=Math.max(years[0],1970);end.value=years.at(-1);update();
}

function chartOptions(){return {responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#f3f0e7',titleColor:'#173a31',bodyColor:'#173a31'}},scales:{x:{grid:{display:false},ticks:{color:'rgba(243,240,231,.55)',maxTicksLimit:7}},y:{grid:{color:'rgba(243,240,231,.12)'},ticks:{color:'rgba(243,240,231,.55)'}}}}}

function update(){
  const start=+document.getElementById('startYear').value,end=+document.getElementById('endYear').value,rows=activeSite.years.filter(d=>d.year>=start&&d.year<=end);
  const rt=pearson(rows,'temp'),rr=pearson(rows,'rain');
  document.getElementById('tempCorr').textContent=(rt>=0?'+':'')+rt.toFixed(2);document.getElementById('rainCorr').textContent=(rr>=0?'+':'')+rr.toFixed(2);
  document.getElementById('selectionNote').textContent=`${rows.length} paired annual observations · ${Math.min(...rows.map(d=>d.samples))}–${Math.max(...rows.map(d=>d.samples))} tree cores per year. Ring width is not age-detrended, so use this as exploration rather than causal evidence.`;
  const labels=rows.map(d=>d.year);growthChart.data.labels=labels;growthChart.data.datasets[0].data=rows.map(d=>d.ring);growthChart.data.datasets[1].data=rows.map(d=>d.temp);growthChart.update();rainChart.data.labels=labels;rainChart.data.datasets[0].data=rows.map(d=>d.rain);rainChart.update();
}

async function init(){
  dataset=await fetch('data/sites.json').then(r=>r.json());activeSite=dataset.sites[0];setupMap();
  const base=chartOptions();
  growthChart=new Chart(document.getElementById('growthChart'),{type:'line',data:{labels:[],datasets:[{label:'Ring width (mm)',data:[],borderColor:'#c9ee78',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:.18,yAxisID:'y'},{label:'Temperature (°C)',data:[],borderColor:'#db7547',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,tension:.18,yAxisID:'y1'}]},options:{...base,scales:{...base.scales,y:{...base.scales.y,title:{display:true,text:'mm',color:'rgba(243,240,231,.55)'}},y1:{position:'right',grid:{display:false},ticks:{color:'rgba(243,240,231,.55)'},title:{display:true,text:'°C',color:'rgba(243,240,231,.55)'}}}}});
  rainChart=new Chart(document.getElementById('rainChart'),{type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:'rgba(120,169,181,.65)',borderWidth:0}]},options:chartOptions()});
  const start=document.getElementById('startYear'),end=document.getElementById('endYear');start.onchange=()=>{if(+start.value>+end.value)end.value=start.value;update()};end.onchange=()=>{if(+end.value<+start.value)start.value=end.value;update()};selectSite(0);
}
init().catch(e=>{document.querySelector('.analysis-pane').innerHTML=`<p>Could not load data: ${e.message}. Run through a local web server.</p>`});
