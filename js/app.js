// ================= MAP INIT =================
const map = L.map('map').setView([-8.65217,116.52885],19);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19});
const satelit = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(map);

L.control.layers({"OSM":osm,"Satelit":satelit}).addTo(map);

// ================= GPS AUTO ZOOM =================
let marker;
let firstFix=true;
if(navigator.geolocation){
  navigator.geolocation.watchPosition(pos=>{
    let lat = pos.coords.latitude;
    let lng = pos.coords.longitude;
    let alt = pos.coords.altitude || 0;

    document.getElementById("coords").innerHTML = lat.toFixed(6) + ", " + lng.toFixed(6);
    document.getElementById("altitude").innerHTML = alt.toFixed(1) + " mdpl";

    if(!marker){
      marker = L.marker([lat,lng]).addTo(map);
    } else {
      marker.setLatLng([lat,lng]);
    }

    if(firstFix){
      map.setView([lat,lng],18);
      firstFix = false;
    }

    reverseGeocode(lat,lng);
  });
}

function reverseGeocode(lat,lng){
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
    .then(r=>r.json())
    .then(d=>document.getElementById("lokasi").innerHTML=d.display_name)
    .catch(()=>document.getElementById("lokasi").innerHTML="Undetected");
}

// ================= POLYGON =================
let drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let colors = ["#e11d48","#2563eb","#16a34a","#f97316","#7c3aed"];
let colorIndex = 0;

let drawControl = new L.Control.Draw({
  draw: { polyline:false, rectangle:false, circle:false, marker:false, circlemarker:false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED,function(e){
  let layer = e.layer;
  layer.setStyle({ color: colors[colorIndex % colors.length] });
  colorIndex++;
  drawnItems.addLayer(layer);
});

// ================= POLYGON INFO =================
function updatePolygonInfo(){
  if(drawnItems.getLayers().length === 0){
    document.getElementById("area").innerHTML = "-";
    document.getElementById("perimeter").innerHTML = "-";
    return;
  }

  // Ambil polygon terakhir yang digambar
  let layer = drawnItems.getLayers()[drawnItems.getLayers().length - 1];
  let latlngs = layer.getLatLngs()[0]; // asumsi polygon tunggal

  // Hitung luas (m²) menggunakan formula geodesik
  let area = L.GeometryUtil.geodesicArea(latlngs);
  document.getElementById("area").innerHTML = (area/10000).toFixed(2) + " Ha";

  // Hitung keliling (m)
  let perimeter = 0;
  for(let i=0; i<latlngs.length-1; i++){
    perimeter += latlngs[i].distanceTo(latlngs[i+1]);
  }
  document.getElementById("perimeter").innerHTML = perimeter.toFixed(0) + " m";
}

// Panggil updatePolygonInfo setiap polygon dibuat, di-edit, atau dihapus
map.on(L.Draw.Event.CREATED, function(e){
  let layer = e.layer;
  layer.setStyle({ color: colors[colorIndex % colors.length] });
  colorIndex++;
  drawnItems.addLayer(layer);
  updatePolygonInfo();
});

map.on(L.Draw.Event.EDITED, function(e){
  updatePolygonInfo();
});

map.on(L.Draw.Event.DELETED, function(e){
  updatePolygonInfo();
});

map.on(L.Draw.Event.EDITED, function(e){});
map.on(L.Draw.Event.DELETED, function(e){});

// ================= SEARCH COORDINATE =================
function searchCoordinate(){
  let input=document.getElementById("searchCoord").value;
  if(!input.includes(",")) return alert("Format salah!");
  let parts=input.split(",");
  let lat=parseFloat(parts[0]);
  let lng=parseFloat(parts[1]);
  if(isNaN(lat)||isNaN(lng)) return alert("Koordinat tidak valid!");
  L.marker([lat,lng]).addTo(map);
  map.setView([lat,lng],19);
}

// ================= EXPORT =================
function exportJPG(){

  const mapElement = document.getElementById("map");

  if(!mapElement){
    alert("Elemen peta tidak ditemukan!");
    return;
  }

  html2canvas(mapElement, {
    useCORS: true,
    allowTaint: true,
    scale: 2   // kualitas lebih tajam
  }).then(canvas => {

    const link = document.createElement("a");
    link.download = "SurveyPro.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();

  }).catch(err => {
    console.error("Export Map Error:", err);
    alert("Gagal export peta.");
  });
}

function checkPolygonExist(){
  if(drawnItems.getLayers().length === 0){
    alert("Anda belum menggambar polygon");
    return false;
  }
  return true;
}

function exportKML(){
  if(!checkPolygonExist()) return;
  let geojson = drawnItems.toGeoJSON();
  let kml = tokml(geojson);
  let blob = new Blob([kml]);
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "SurveyPro.kml";
  link.click();
}

function exportKMZ(){
  if(!checkPolygonExist()) return;
  let geojson = drawnItems.toGeoJSON();
  let kml = tokml(geojson);
  let zip = new JSZip();
  zip.file("doc.kml", kml);
  zip.generateAsync({type:"blob"}).then(content=>{
    let link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "SurveyPro.kmz";
    link.click();
  });
}

// ================= EXPORT SHP (FIX JSZIP 3.x) =================
function exportSHP(){

  if(!checkPolygonExist()) return;

  try {

    let geojson = drawnItems.toGeoJSON();

    // Perbaiki MultiPolygon
    geojson.features.forEach(f=>{
      if(f.geometry.type === "MultiPolygon"){
        f.geometry = {
          type: "Polygon",
          coordinates: f.geometry.coordinates[0]
        };
      }
    });

    // Generate SHP file objects (tanpa download otomatis)
    let files = shpwrite.zip(geojson);

    // Pakai JSZip 3.x manual
    let zip = new JSZip();

    zip.file("SurveyPro.shp", files.shp);
    zip.file("SurveyPro.shx", files.shx);
    zip.file("SurveyPro.dbf", files.dbf);
    zip.file("SurveyPro.prj", files.prj);

    zip.generateAsync({type:"blob"}).then(content=>{
      let link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "SurveyPro.zip";
      link.click();
    });

  } catch(err){
    console.error("Export SHP Error:", err);
    alert("Export SHP gagal. Cek console.");
  }
}

// ================= SHOW/HIDE DASHBOARD =================
const sidebar = document.querySelector(".sidebar");
const showBtn = document.getElementById("show-dashboard-btn");

function toggleDashboard(){
  sidebar.classList.toggle("hidden");
  if(sidebar.classList.contains("hidden")){
    showBtn.style.display = "block";
  } else {
    showBtn.style.display = "none";
  }
}

showBtn.onclick = ()=>{
  sidebar.classList.remove("hidden");
  showBtn.style.display = "none";
};

// ================= DATETIME =================
setInterval(()=>{
  let now = new Date();
  document.getElementById("datetime").innerHTML =
    now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) +
    "<br>Pkl. "+now.toLocaleTimeString('id-ID');
},1000);

// ================= SERVICE WORKER =================
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('service-worker.js');
}