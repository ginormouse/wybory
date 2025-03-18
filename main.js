// Map focused on Kraków.
var map = L.map("map").fitBounds([
  [49.95169143102034, 19.794982263064924],
  [50.14921533053712, 20.23337412956119],
]);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  minZoom: 1,
  maxZoom: 28,
  minNativeZoom: 0,
  // "z" parameter in tile requests. Upscaling above that value.
  maxNativeZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

// Search bar
L.Control.geocoder({
  collapsed: true,
  position: "topleft",
  placeholder: "Szukaj",
}).addTo(map);

// Geojson data on different layers have the same index.
// Ensure overlay is always on top by using a pane.
map.createPane("constituency33").style.zIndex = 401;

// Layers
// `addTo` defines initial selection.
const layers = {
  districts: L.geoJSON(null, {
    onEachFeature: districtPopup,
    style: {
      weight: 2,
      opacity: 1,
      color: "#666",
      fillOpacity: 0.3,
    },
  }),
  circuits: L.geoJSON(null, {
    onEachFeature: circuitPopup,
    style: { weight: 1 },
  }),
  constituency33: L.geoJSON(null, {
    style: {
      weight: 4,
      color: "black",
      opacity: 1,
      fill: false,
    },
    pane: "constituency33",
  }).addTo(map),
};
var layerControl = L.control
  .layers(
    { "Dzielnice ": layers.districts, "Obwody 2025": layers.circuits },
    { "Okręg 33": layers.constituency33 },
    { collapsed: false }
  )
  .addTo(map);

const colorPalette = [
  "rgb(255,247,243)",
  "rgb(253,224,221)",
  "rgb(252,197,192)",
  "rgb(250,159,181)",
  "rgb(247,104,161)",
  "rgb(221,52,151)",
  "rgb(174,1,126)",
  "rgb(122,1,119)",
];
const districtPalette = colorPalette.slice(3);
const stdDevRanges = [
  "< -1.5 σ",
  "-1.5 σ — -1.0 σ",
  "-1.0 σ — -0.5 σ",
  "-0.5 σ — 0.0 σ",
  "0.0 σ — +0.5 σ",
  "+0.5 σ — +1.0 σ",
  "+1.0 σ — +1.5 σ",
  "> +1.5 σ",
];

loadAll();
async function loadAll() {
  const [electionsLayers, districtMapping] = await Promise.all([
    loadJson("data/wybory.json"),
    loadJson("data/ObwodyDzielnice2025.json"),
  ]);
  const electionsPromises = Object.entries(electionsLayers).map(
    async ([electionName, fileName]) => {
      const data = await loadJson("data/" + fileName);
      return { electionName, data };
    }
  );
  const [districts, circuits, constituency33, ...elections] = await Promise.all(
    [
      loadJson("geo/dzielnice.geojson"),
      loadJson("geo/obwody2025.geojson"),
      loadJson("geo/okreg33.geojson"),
      ...electionsPromises,
    ]
  );
  // Add numerical `Obwod` property.
  circuits.features.forEach((f) => {
    f.properties.Obwod = Number(f.properties.Nr_obszaru);
  });
  layers.districts.addData(districts);
  layers.circuits.addData(circuits);
  layers.constituency33.addData(constituency33);
  let last;
  for (const { electionName, data } of elections) {
    const filteredData = data.filter((d) =>
      districtMapping.some((m) => m.Obwod == d.Obwod)
    );
    const districtData = getDistrictData(filteredData, districtMapping);
    addDistrictsLayer(electionName, districts, districtData);
    last = addCircuitsLayer(electionName, circuits, filteredData);
  }
  last.addTo(map);
}

function addCircuitsLayer(name, geo, data) {
  const { mean, stdDev } = getStatistics(data);
  const values = data.map((d) => d.Procent);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const boundaries = [min];
  let boundary = mean - 2 * stdDev;
  for (let i = 0; i < 7; i++) {
    boundary += stdDev / 2;
    boundaries.push(boundary);
  }
  boundaries.push(max);
  const lBounds = boundaries.map((n) => n.toFixed(2));
  const labels = stdDevRanges.map(
    (text, i) => `${lBounds[i]}% — ${lBounds[i + 1]}% (${text})`
  );
  return addElectionLayer({
    name: name + " Obwody",
    geo,
    getData: (feature) =>
      data.find((c) => c.Obwod === feature.properties.Obwod),
    boundaries,
    colors: colorPalette,
    labels,
    popup: circuitResultPopup,
  });
}

function addDistrictsLayer(name, geo, districtData) {
  const values = Object.values(districtData).map((d) => d.Procent);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / 5;
  const boundaries = [min];
  for (let i = 1; i < 5; i++) boundaries.push(min + step * i);
  boundaries.push(max);
  const lBounds = boundaries.map((n) => n.toFixed(2));
  const labels = districtPalette.map(
    (_, i) => `${lBounds[i]}% — ${lBounds[i + 1]}%`
  );
  return addElectionLayer({
    name: name + " Dzielnice",
    geo,
    getData: (feature) => districtData[feature.properties.official_name],
    boundaries,
    colors: districtPalette,
    labels,
    popup: districtResultPopup,
  });
}

function addElectionLayer({
  geo,
  colors, // n
  labels, // n
  boundaries, // n+1
  getData, // returns object with `Procent` for feature, passed as context to popup.
  popup,
  name,
}) {
  const layer = L.geoJSON(geo, {
    onEachFeature: (feature, layer) => {
      if (getData(feature)) popup(feature.properties, getData(feature), layer);
    },
    style: (feature) => {
      const data = getData(feature);
      const value = data?.Procent ?? 0;
      let ind = boundaries.findIndex((i) => value <= i) - 1;
      ind = Math.max(0, ind);
      const fillColor = colors[ind];
      // If there's no data for feature, paint it "invisible"
      return {
        weight: data ? 1 : 0,
        color: "#333",
        fillOpacity: data ? 0.75 : 0,
        fillColor,
      };
    },
  });
  const legend = createLegend(colors, labels);
  layer.on("add", () => legend.addTo(map));
  layer.on("remove", () => legend.remove());
  layerControl.addBaseLayer(layer, name);
  return layer;
}

function getDistrictData(filteredData, districtMapping) {
  const districts = {};
  filteredData.forEach((d) => {
    const name = districtMapping.find((m) => m.Obwod === d.Obwod).Dzielnica;
    if (!districts[name]) districts[name] = { Total: 0, Kandydatka: 0 };
    districts[name].Total += d.Total;
    districts[name].Kandydatka += d.Kandydatka;
  });
  Object.values(districts).forEach(
    (d) => (d.Procent = Number(((d.Kandydatka / d.Total) * 100).toFixed(2)))
  );
  return districts;
}

function getStatistics(data) {
  const mean = data.reduce((acc, cur) => acc + cur.Procent, 0) / data.length;
  const variance =
    data.reduce((acc, cur) => acc + Math.pow(cur.Procent - mean, 2), 0) /
    data.length;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev };
}

async function loadJson(url) {
  const resp = await fetch(url);
  return await resp.json();
}

function createLegend(colors, labels) {
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create(
      "div",
      "legend leaflet-control-layers leaflet-control-layers-expanded"
    );
    colors.forEach((col, i) => {
      div.innerHTML += `<div><i style="background: ${col}"></i> ${labels[i]}</div>`;
    });
    return div;
  };
  return legend;
}

function districtPopup({ properties: p }, layer) {
  layer.bindPopup(`<h3>${p.official_name}</h3>`);
}

function circuitPopup({ properties: p }, layer) {
  const content = `
<h3>Obwód ${p.Obwod}</h3>
<h4>${p.Dzielnica}</h4>
`;
  layer.bindPopup(content);
}

function districtResultPopup(p, data, layer) {
  const content = `
  <h4>${p.official_name}</h4>
  <h4>Procent</h4>
  ${data.Procent.toFixed(2)}%
  <h4>Głosy na kandydatkę</h4>
  ${data.Kandydatka}
  <h4>Wszystkie głosy ważne</h4>
  ${data.Total}
  `;
  layer.bindPopup(content);
}

function circuitResultPopup(p, data, layer) {
  const content = `
<h3>Obwód ${p.Obwod}</h3>
<h4>${p.Dzielnica}</h4>
<h4>Procent</h4>
${data.Procent.toFixed(2)}%
<h4>Głosy na kandydatkę</h4>
${data.Kandydatka}
<h4>Wszystkie głosy ważne</h4>
${data.Total}
<h4><a href="${data.url}" target=_blank>PKW</a></h4>
`;
  layer.bindPopup(content);
}
