let dataset, temperatureData, climateGridData, coordinateData, activeSite, growthChart, rainChart, finlandTemperatureChart, map, coordinateMarker, contextMarker, viewMode='site';
const siteMarkers = [];

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

const trendPerDecade = (rows, key) => {
  if(rows.length<2)return 0;
  const meanYear=rows.reduce((sum,row)=>sum+row.year,0)/rows.length,meanValue=rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
  const numerator=rows.reduce((sum,row)=>sum+(row.year-meanYear)*(row[key]-meanValue),0),denominator=rows.reduce((sum,row)=>sum+(row.year-meanYear)**2,0);
  return numerator/denominator*10;
};

function populateRange(rows,defaultStart){
  const start=document.getElementById('startYear'),end=document.getElementById('endYear'),years=rows.map(row=>row.year);
  start.replaceChildren();end.replaceChildren();years.forEach(year=>{start.add(new Option(year,year));end.add(new Option(year,year));});
  start.value=defaultStart;end.value=years.at(-1);start.disabled=false;end.disabled=false;
}

function coordinateClimateAt(clickedLat,clickedLon){
  const [clickedEasting,clickedNorthing]=proj4('EPSG:4326',climateGridData.projection,[clickedLon,clickedLat]);
  let nearestPosition=0,nearestDistance=Infinity;
  climateGridData.cells.forEach((cell,position)=>{
    const row=Math.floor(cell/climateGridData.width),column=cell%climateGridData.width,dx=climateGridData.easting[column]-clickedEasting,dy=climateGridData.northing[row]-clickedNorthing,distance=dx*dx+dy*dy;
    if(distance<nearestDistance){nearestDistance=distance;nearestPosition=position}
  });
  const nearestCell=climateGridData.cells[nearestPosition],nearestRow=Math.floor(nearestCell/climateGridData.width),nearestColumn=nearestCell%climateGridData.width;
  const [gridLon,gridLat]=proj4(climateGridData.projection,'EPSG:4326',[climateGridData.easting[nearestColumn],climateGridData.northing[nearestRow]]);
  const rows=climateGridData.years.map((year,index)=>({year,temperature:climateGridData.temperature[index][nearestPosition],precipitation:climateGridData.precipitation[index][nearestPosition]}));
  const movingAverage=trailingMovingAverage(rows,'temperature');
  rows.forEach((row,index)=>row.movingAverage=movingAverage[index]==null?null:+movingAverage[index].toFixed(2));
  return {rows,period:climateGridData.period,clickedLat,clickedLon,gridLat,gridLon,distanceKm:Math.sqrt(nearestDistance)/1000};
}

function setupMap(){
  map=L.map('map',{zoomControl:false}).setView([63.7,23.1],5);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap'}).addTo(map);
  dataset.sites.forEach((entry,index)=>{
    const s=entry.site,marker=L.marker([s.lat,s.lon],{icon:makeIcon(index===0),title:`Select ${s.name}`,bubblingMouseEvents:false}).addTo(map).bindTooltip(`${s.name} · ${s.species}`,{direction:'top'});
    marker.on('click',()=>selectSite(index));siteMarkers.push(marker);
  });
  contextMarker=L.marker([liphe.lat,liphe.lon],{icon:makeContextIcon(false),title:`Select ${liphe.name}`,bubblingMouseEvents:false}).addTo(map).bindTooltip(`${liphe.name} · ${liphe.period}`,{direction:'top'});
  contextMarker.on('click',selectLiPhe);
  map.on('click',selectClimate);
  document.getElementById('recenter').onclick=()=>map.setView([63.7,23.1],5);
}

function makeIcon(selected){return L.divIcon({className:`site-icon${selected?' selected':''}`,iconSize:[16,16]})}
function makeContextIcon(selected){return L.divIcon({className:`context-icon${selected?' selected':''}`,iconSize:[18,18]})}
function clearCoordinateMarker(){if(coordinateMarker){map.removeLayer(coordinateMarker);coordinateMarker=null}}

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
  clearCoordinateMarker();
  viewMode='site';
  setRingMode(true);
  activeSite=dataset.sites[index];
  siteMarkers.forEach((marker,i)=>marker.setIcon(makeIcon(i===index)));
  contextMarker?.setIcon(makeContextIcon(false));
  const s=activeSite.site;
  document.getElementById('selectionTypeLabel').textContent='Selected site';
  document.getElementById('siteName').textContent=s.name;
  document.getElementById('siteMeta').textContent=`${s.species} · ${s.country} · ${s.lat.toFixed(2)}°N, ${s.lon.toFixed(2)}°E${s.elevation==null?'':` · ${s.elevation} m`}`;
  document.getElementById('siteSymbol').textContent='♧';
  const years=activeSite.years.map(d=>d.year);
  populateRange(activeSite.years,years.length<=25?years[0]:Math.max(years[0],1970));update();
}

function selectLiPhe(){
  clearCoordinateMarker();
  viewMode='lidar';
  setRingMode(false);
  siteMarkers.forEach(marker=>marker.setIcon(makeIcon(false)));
  contextMarker.setIcon(makeContextIcon(true));
  document.getElementById('selectionTypeLabel').textContent='Selected research context';
  document.getElementById('siteName').textContent=liphe.name;
  document.getElementById('siteMeta').textContent=`${liphe.type} · ${liphe.lat.toFixed(2)}°N, ${liphe.lon.toFixed(2)}°E · ${liphe.period}`;
  document.getElementById('siteSymbol').textContent='⌁';
  document.getElementById('tempCorr').textContent=liphe.scans;
  document.getElementById('rainCorr').textContent=liphe.trees;
  document.getElementById('selectionNote').textContent='This source measures changing 3D tree structure and phenology, not annual ring width. Climate correlation is therefore not calculated in this view.';
}

function selectClimate(event){
  const {lat,lng:lon}=event.latlng;
  viewMode='climate';
  setRingMode(true);
  siteMarkers.forEach(marker=>marker.setIcon(makeIcon(false)));
  contextMarker?.setIcon(makeContextIcon(false));
  clearCoordinateMarker();coordinateMarker=L.circleMarker([lat,lon],{radius:7,color:'#f3f0e7',weight:3,fillColor:'#db7547',fillOpacity:1,interactive:false}).addTo(map);
  document.getElementById('selectionTypeLabel').textContent='Selected coordinates';
  document.getElementById('siteName').textContent=`${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
  document.getElementById('siteSymbol').textContent='☁︎';
  coordinateData=coordinateClimateAt(lat,lon);
  document.getElementById('siteMeta').textContent=`FMI 10 km grid ${coordinateData.gridLat.toFixed(2)}°N, ${coordinateData.gridLon.toFixed(2)}°E · ${coordinateData.distanceKm.toFixed(1)} km from click · ${coordinateData.period}`;
  populateRange(coordinateData.rows,coordinateData.rows[0].year);update();
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

function updateSite(){
  const start=+document.getElementById('startYear').value,end=+document.getElementById('endYear').value,rows=activeSite.years.filter(d=>d.year>=start&&d.year<=end);
  const rt=pearson(rows,'temp'),rr=pearson(rows,'rain');
  document.getElementById('metricOneLabel').textContent='Temperature correlation';document.getElementById('metricOneNote').textContent='Pearson r';
  document.getElementById('metricTwoLabel').textContent='Rainfall correlation';document.getElementById('metricTwoNote').textContent='Pearson r';
  document.getElementById('tempCorr').textContent=(rt>=0?'+':'')+rt.toFixed(2);document.getElementById('rainCorr').textContent=(rr>=0?'+':'')+rr.toFixed(2);
  document.getElementById('primaryChartTitle').textContent='Growth & temperature';document.getElementById('primaryChartSubtitle').textContent='Ring width (mm) · annual mean and 10-year average (°C)';
  document.getElementById('rainChartTitle').textContent='Rainfall response';document.getElementById('rainChartSubtitle').textContent='Annual precipitation (mm)';document.getElementById('growthLegend').hidden=false;
  document.getElementById('selectionNote').textContent=`${rows.length} paired annual observations · ${Math.min(...rows.map(d=>d.samples))}–${Math.max(...rows.map(d=>d.samples))} tree cores per year. Ring width is not age-detrended, so use this as exploration rather than causal evidence.`;
  const labels=rows.map(d=>d.year),siteTemperatureAverage=trailingMovingAverage(activeSite.years,'temp'),temperatureAverageByYear=new Map(activeSite.years.map((d,index)=>[d.year,siteTemperatureAverage[index]]));
  growthChart.data.labels=labels;growthChart.data.datasets[0].hidden=false;growthChart.data.datasets[0].data=rows.map(d=>d.ring);growthChart.data.datasets[1].data=rows.map(d=>d.temp);growthChart.data.datasets[2].data=rows.map(d=>temperatureAverageByYear.get(d.year));growthChart.options.scales.y.display=true;growthChart.options.scales.y1.position='right';growthChart.options.scales.y1.grid.display=false;growthChart.canvas.setAttribute('aria-label','Tree-ring growth, annual temperature and 10-year temperature moving average for the selected research site');growthChart.update();
  rainChart.data.labels=labels;rainChart.data.datasets[0].data=rows.map(d=>d.rain);rainChart.canvas.setAttribute('aria-label','Annual precipitation for the selected research site');rainChart.update();
}

function updateClimate(){
  const start=+document.getElementById('startYear').value,end=+document.getElementById('endYear').value,rows=coordinateData.rows.filter(row=>row.year>=start&&row.year<=end);
  const temperatureTrend=trendPerDecade(rows,'temperature'),meanPrecipitation=rows.reduce((sum,row)=>sum+row.precipitation,0)/rows.length,labels=rows.map(row=>row.year);
  document.getElementById('metricOneLabel').textContent='Temperature trend';document.getElementById('metricOneNote').textContent='°C per decade';
  document.getElementById('metricTwoLabel').textContent='Mean precipitation';document.getElementById('metricTwoNote').textContent='mm per year';
  document.getElementById('tempCorr').textContent=`${temperatureTrend>=0?'+':''}${temperatureTrend.toFixed(2)}`;document.getElementById('rainCorr').textContent=Math.round(meanPrecipitation);
  document.getElementById('primaryChartTitle').textContent='Temperature';document.getElementById('primaryChartSubtitle').textContent='Annual mean and trailing 10-year average (°C)';
  document.getElementById('rainChartTitle').textContent='Rainfall';document.getElementById('rainChartSubtitle').textContent='Annual precipitation (mm)';document.getElementById('growthLegend').hidden=true;
  document.getElementById('selectionNote').textContent=`${rows.length} annual values from FMI’s observation-based 10 km grid at the nearest valid land cell; ${coordinateData.rows.at(-1).year} is the latest complete year.`;
  growthChart.data.labels=labels;growthChart.data.datasets[0].hidden=true;growthChart.data.datasets[0].data=[];growthChart.data.datasets[1].data=rows.map(row=>row.temperature);growthChart.data.datasets[2].data=rows.map(row=>row.movingAverage);growthChart.options.scales.y.display=false;growthChart.options.scales.y1.position='left';growthChart.options.scales.y1.grid.display=true;growthChart.options.scales.y1.grid.color='rgba(243,240,231,.12)';growthChart.canvas.setAttribute('aria-label',`Annual mean temperature and 10-year moving average at ${coordinateData.clickedLat.toFixed(3)} degrees north, ${coordinateData.clickedLon.toFixed(3)} degrees east, from ${start} to ${end}`);growthChart.update();
  rainChart.data.labels=labels;rainChart.data.datasets[0].data=rows.map(row=>row.precipitation);rainChart.canvas.setAttribute('aria-label',`Annual precipitation at the selected coordinates from ${start} to ${end}`);rainChart.update();
}

function update(){if(viewMode==='climate')updateClimate();else if(viewMode==='site')updateSite()}

async function init(){
  const [siteData,climateData,gridData]=await Promise.all([fetch('data/sites.json').then(r=>r.json()),fetch('data/finland-temperature.json').then(r=>r.json()),fetch('data/finland-climate-grid.json').then(r=>r.json())]);
  dataset=siteData;temperatureData=climateData;climateGridData=gridData;activeSite=dataset.sites[0];setupMap();
  const base=chartOptions();
  growthChart=new Chart(document.getElementById('growthChart'),{type:'line',data:{labels:[],datasets:[{label:'Ring width (mm)',data:[],borderColor:'#c9ee78',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:.18,yAxisID:'y'},{label:'Annual temperature (°C)',data:[],borderColor:'#db7547',backgroundColor:'transparent',borderWidth:1.25,pointRadius:0,tension:.18,yAxisID:'y1'},{label:'10-year temperature average (°C)',data:[],borderColor:'#78a9b5',backgroundColor:'transparent',borderWidth:3,pointRadius:0,tension:.25,spanGaps:false,yAxisID:'y1'}]},options:{...base,scales:{...base.scales,y:{...base.scales.y,title:{display:true,text:'mm',color:'rgba(243,240,231,.55)'}},y1:{position:'right',grid:{display:false},ticks:{color:'rgba(243,240,231,.55)'},title:{display:true,text:'°C',color:'rgba(243,240,231,.55)'}}}}});
  rainChart=new Chart(document.getElementById('rainChart'),{type:'bar',data:{labels:[],datasets:[{label:'Annual precipitation (mm)',data:[],backgroundColor:'rgba(120,169,181,.65)',borderWidth:0}]},options:chartOptions()});
  createFinlandTemperatureChart(temperatureData);
  const start=document.getElementById('startYear'),end=document.getElementById('endYear');start.onchange=()=>{if(+start.value>+end.value)end.value=start.value;update()};end.onchange=()=>{if(+end.value<+start.value)start.value=end.value;update()};selectSite(0);
}
init().catch(e=>{document.querySelector('.analysis-pane').innerHTML=`<p>Could not load data: ${e.message}. Run through a local web server.</p>`});
