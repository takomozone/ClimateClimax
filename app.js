let dataset, activeSite, growthChart, rainChart, finlandTemperatureChart, siteMarkers = [], contextMarker;

const liphe = {
  name:'LiPheStream · Hyytiälä', lat:61.85, lon:24.28, elevation:193,
  type:'Terrestrial LiDAR time series', period:'Apr 2020–Sep 2021', scans:103, trees:458
};

const pearson = (rows, key) => {
  const xs=rows.map(d=>d.ring),ys=rows.map(d=>d[key]),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  const num=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0),den=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
  return num/den;
};

const trailingMovingAverage = (rows, key, windowSize=10) => rows.map((row,index)=>{
  const window=rows.slice(Math.max(0,index-windowSize+1),index+1);
  const isComplete=window.length===windowSize&&window.at(-1).year-window[0].year===windowSize-1;
  return isComplete?window.reduce((sum,item)=>sum+item[key],0)/windowSize:null;
});

function setupMap(){
  const map=L.map('map',{zoomControl:false}).setView([65.2,25.8],5);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap'}).addTo(map);
  dataset.sites.forEach((entry,index)=>{
    const s=entry.site,marker=L.marker([s.lat,s.lon],{icon:makeIcon(index===0),title:`Select ${s.name}`}).addTo(map).bindTooltip(`${s.name} · ${s.species}`,{direction:'top'});
    marker.on('click',()=>selectSite(index));siteMarkers.push(marker);
  });
  contextMarker=L.marker([liphe.lat,liphe.lon],{icon:makeContextIcon(false),title:`Select ${liphe.name}`}).addTo(map).bindTooltip(`${liphe.name} · ${liphe.period}`,{direction:'top'});
  contextMarker.on('click',selectLiPhe);
  document.getElementById('recenter').onclick=()=>map.setView([65.2,25.8],5);
}

function makeIcon(selected){return L.divIcon({className:`site-icon${selected?' selected':''}`,iconSize:[16,16]})}
function makeContextIcon(selected){return L.divIcon({className:`context-icon${selected?' selected':''}`,iconSize:[18,18]})}

function setRingMode(enabled){
  document.getElementById('rangeRow').hidden=!enabled;
  document.querySelectorAll('.ring-chart').forEach(el=>el.hidden=!enabled);
  document.getElementById('contextDetails').hidden=enabled;
  document.getElementById('metricOneLabel').textContent=enabled?'Temperature correlation':'LiDAR observations';
  document.getElementById('metricOneNote').textContent=enabled?'Pearson r':'average interval 3.5 days';
  document.getElementById('metricTwoLabel').textContent=enabled?'Rainfall correlation':'Individual trees';
  document.getElementById('metricTwoNote').textContent=enabled?'Pearson r':'3 boreal species';
}

function selectSite(index){
  setRingMode(true);
  activeSite=dataset.sites[index];
  siteMarkers.forEach((marker,i)=>marker.setIcon(makeIcon(i===index)));
  contextMarker?.setIcon(makeContextIcon(false));
  const s=activeSite.site;
  document.getElementById('siteName').textContent=s.name;
  document.getElementById('siteMeta').textContent=`${s.species} · ${s.lat.toFixed(2)}°N, ${s.lon.toFixed(2)}°E · ${s.elevation} m`;
  const start=document.getElementById('startYear'),end=document.getElementById('endYear'),years=activeSite.years.map(d=>d.year);
  start.replaceChildren();end.replaceChildren();years.forEach(y=>{start.add(new Option(y,y));end.add(new Option(y,y));});
  start.value=years.length<=25?years[0]:Math.max(years[0],1970);end.value=years.at(-1);update();
}

function selectLiPhe(){
  setRingMode(false);
  siteMarkers.forEach(marker=>marker.setIcon(makeIcon(false)));
  contextMarker.setIcon(makeContextIcon(true));
  document.getElementById('siteName').textContent=liphe.name;
  document.getElementById('siteMeta').textContent=`${liphe.type} · ${liphe.lat.toFixed(2)}°N, ${liphe.lon.toFixed(2)}°E · ${liphe.period}`;
  document.getElementById('tempCorr').textContent=liphe.scans;
  document.getElementById('rainCorr').textContent=liphe.trees;
  document.getElementById('selectionNote').textContent='This source measures changing 3D tree structure and phenology, not annual ring width. Climate correlation is therefore not calculated in this view.';
}

function chartOptions(){return {responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#f3f0e7',titleColor:'#173a31',bodyColor:'#173a31'}},scales:{x:{grid:{display:false},ticks:{color:'rgba(243,240,231,.55)',maxTicksLimit:7}},y:{grid:{color:'rgba(243,240,231,.12)'},ticks:{color:'rgba(243,240,231,.55)'}}}}}

function createFinlandTemperatureChart(data){
  document.getElementById('nationalTrend').textContent=`+${data.trendPerDecade.toFixed(2)} °C`;
  const labels=data.rows.map(row=>row.year);
  finlandTemperatureChart=new Chart(document.getElementById('finlandTemperatureChart'),{
    type:'line',
    data:{labels,datasets:[
      {label:'Annual mean',data:data.rows.map(row=>row.temperature),borderColor:'rgba(120,169,181,.55)',backgroundColor:'rgba(120,169,181,.55)',borderWidth:1,pointRadius:2,pointHoverRadius:4,tension:0},
      {label:'10-year moving average',data:data.rows.map(row=>row.movingAverage),borderColor:'#173a31',backgroundColor:'transparent',borderWidth:3,pointRadius:0,tension:.25,spanGaps:false},
      {label:'Linear trend',data:data.rows.map(row=>row.trend),borderColor:'#db7547',backgroundColor:'transparent',borderWidth:2,pointRadius:0,borderDash:[7,6],tension:0}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',align:'start',labels:{color:'#173a31',usePointStyle:true,pointStyle:'line',boxWidth:28,padding:20}},tooltip:{backgroundColor:'#173a31',titleColor:'#f3f0e7',bodyColor:'#f3f0e7',callbacks:{label:context=>`${context.dataset.label}: ${context.parsed.y.toFixed(2)} °C`}}},scales:{x:{grid:{display:false},ticks:{color:'rgba(23,58,49,.62)',maxTicksLimit:9}},y:{grid:{color:'rgba(23,58,49,.12)'},ticks:{color:'rgba(23,58,49,.62)',callback:value=>`${value}°`},title:{display:true,text:'Annual mean temperature (°C)',color:'rgba(23,58,49,.7)'}}}}
  });
}

function update(){
  const start=+document.getElementById('startYear').value,end=+document.getElementById('endYear').value,rows=activeSite.years.filter(d=>d.year>=start&&d.year<=end);
  const rt=pearson(rows,'temp'),rr=pearson(rows,'rain');
  document.getElementById('tempCorr').textContent=(rt>=0?'+':'')+rt.toFixed(2);document.getElementById('rainCorr').textContent=(rr>=0?'+':'')+rr.toFixed(2);
  document.getElementById('selectionNote').textContent=`${rows.length} paired annual observations · ${Math.min(...rows.map(d=>d.samples))}–${Math.max(...rows.map(d=>d.samples))} tree cores per year. Ring width is not age-detrended, so use this as exploration rather than causal evidence.`;
  const labels=rows.map(d=>d.year),siteTemperatureAverage=trailingMovingAverage(activeSite.years,'temp'),temperatureAverageByYear=new Map(activeSite.years.map((d,index)=>[d.year,siteTemperatureAverage[index]]));
  growthChart.data.labels=labels;growthChart.data.datasets[0].data=rows.map(d=>d.ring);growthChart.data.datasets[1].data=rows.map(d=>d.temp);growthChart.data.datasets[2].data=rows.map(d=>temperatureAverageByYear.get(d.year));growthChart.update();rainChart.data.labels=labels;rainChart.data.datasets[0].data=rows.map(d=>d.rain);rainChart.update();
}

async function init(){
  const [siteData,temperatureData]=await Promise.all([fetch('data/sites.json').then(r=>r.json()),fetch('data/finland-temperature.json').then(r=>r.json())]);
  dataset=siteData;activeSite=dataset.sites[0];setupMap();
  const base=chartOptions();
  growthChart=new Chart(document.getElementById('growthChart'),{type:'line',data:{labels:[],datasets:[{label:'Ring width (mm)',data:[],borderColor:'#c9ee78',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:.18,yAxisID:'y'},{label:'Annual temperature (°C)',data:[],borderColor:'#db7547',backgroundColor:'transparent',borderWidth:1.25,pointRadius:0,tension:.18,yAxisID:'y1'},{label:'10-year temperature average (°C)',data:[],borderColor:'#78a9b5',backgroundColor:'transparent',borderWidth:3,pointRadius:0,tension:.25,spanGaps:false,yAxisID:'y1'}]},options:{...base,scales:{...base.scales,y:{...base.scales.y,title:{display:true,text:'mm',color:'rgba(243,240,231,.55)'}},y1:{position:'right',grid:{display:false},ticks:{color:'rgba(243,240,231,.55)'},title:{display:true,text:'°C',color:'rgba(243,240,231,.55)'}}}}});
  rainChart=new Chart(document.getElementById('rainChart'),{type:'bar',data:{labels:[],datasets:[{data:[],backgroundColor:'rgba(120,169,181,.65)',borderWidth:0}]},options:chartOptions()});
  createFinlandTemperatureChart(temperatureData);
  const start=document.getElementById('startYear'),end=document.getElementById('endYear');start.onchange=()=>{if(+start.value>+end.value)end.value=start.value;update()};end.onchange=()=>{if(+end.value<+start.value)start.value=end.value;update()};selectSite(0);
}
init().catch(e=>{document.querySelector('.analysis-pane').innerHTML=`<p>Could not load data: ${e.message}. Run through a local web server.</p>`});
