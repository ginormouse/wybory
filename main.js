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
      weight: 3,
      color: "black",
      opacity: 1,
      fill: false,
    },
  }).addTo(map),
  KolarskaDistricts: L.geoJSON(),
  KolarskaCircuits: L.geoJSON(),
  SladekDistricts: L.geoJSON(),
  SladekCircuits: L.geoJSON().addTo(map),
};
var layerControl = L.control
  .layers(
    {
      "Dzielnice ": layers.districts,
      "Obwody ": layers.circuits,
      "Kolarska 2024 (PE) Dzielnice": layers.KolarskaDistricts,
      "Kolarska 2024 (PE) Obwody": layers.KolarskaCircuits,
      "Sładek 2024 (Sejmik) Dzielnice": layers.SladekDistricts,
      "Sładek 2024 (Sejmik) Obwody": layers.SladekCircuits,
    },
    {
      "Okręg 33": layers.constituency33,
    },
    { collapsed: false }
  )
  .addTo(map);

const colorPalette = [
  "rgb(64,64,64)",
  "rgb(134,134,134)",
  "rgb(196,196,196)",
  "rgb(235,235,235)",
  "rgb(252,229,219)",
  "rgb(246,178,148)",
  "rgb(226,94,88)",
  "rgb(202,0,32)",
];

loadAll();
async function loadAll() {
  const [
    districts,
    circuits,
    constituency33,
    KolarskaDistricts,
    KolarskaCircuits,
    SladekDistricts,
    SladekCircuits,
  ] = await Promise.all([
    loadJson("geo/dzielnice.geojson"),
    loadJson("geo/obwody.geojson"),
    loadJson("geo/okreg33.geojson"),
    loadJson("data/Kolarska2024Dzielnice.json"),
    loadJson("data/Kolarska2024Obwody.json"),
    loadJson("data/Sladek2024Dzielnice.json"),
    loadJson("data/Sladek2024Obwody.json"),
  ]);
  layers.districts.addData(districts);
  layers.circuits.addData(circuits);

  const KolarskaDistrictsRanges = [0, 0, 0, 3, 5, 7, 9, 11];
  layers.KolarskaDistricts.options.style = (f) => {
    const data = KolarskaDistricts[f.properties.official_name];
    const ind = KolarskaDistrictsRanges.findIndex((x) => x > data.Procent);
    return {
      weight: 1,
      color: "#333",
      fillOpacity: 0.65,
      fillColor: colorPalette[ind],
    };
  };
  layers.KolarskaDistricts.options.onEachFeature = (f, l) => {
    return districtResultPopup(
      f.properties,
      KolarskaDistricts[f.properties.official_name],
      l
    );
  };
  layers.KolarskaDistricts.addData(districts);

  const KolarskaCircuitsRanges = [3, 5, 7, 9, 11, 13, 15, 17];
  const getKolarskaCircuit = (feature) =>
    KolarskaCircuits.find((c) => c.Obwod === feature.properties.Obwod);
  layers.KolarskaCircuits.options.style = (f) => {
    const data = getKolarskaCircuit(f);
    const ind = KolarskaCircuitsRanges.findIndex((x) => x > data.Procent);
    return {
      weight: 1,
      color: "#333",
      fillOpacity: 0.65,
      fillColor: colorPalette[ind],
    };
  };
  layers.KolarskaCircuits.options.onEachFeature = (f, l) => {
    return circuitResultPopup(f.properties, getKolarskaCircuit(f), l);
  };
  layers.KolarskaCircuits.addData(circuits);

  const SladekDistrictsRanges = [1, 2, 3, 4, 5, 6, 7, 8].map(
    (i) => (i * 2) / 8
  );
  layers.SladekDistricts.options.style = (f) => {
    const data = SladekDistricts[f.properties.official_name];
    const ind = SladekDistrictsRanges.findIndex((x) => x > data.Procent);
    return {
      weight: 1,
      color: "#333",
      fillOpacity: 0.65,
      fillColor: colorPalette[ind],
    };
  };
  layers.SladekDistricts.options.onEachFeature = (f, l) => {
    return districtResultPopup(
      f.properties,
      SladekDistricts[f.properties.official_name],
      l
    );
  };
  layers.SladekDistricts.addData(districts);

  const SladekCircuitsRanges = [1, 2, 3, 4, 5, 6, 7, 100].map(
    (i) => (i * 3) / 8
  );
  const getSladekCircuit = (feature) =>
    SladekCircuits.find((c) => c.Obwod === feature.properties.Obwod);
  layers.SladekCircuits.options.style = (f) => {
    const data = getSladekCircuit(f);
    const ind = SladekCircuitsRanges.findIndex((x) => x > data.Procent);
    return {
      weight: 1,
      color: "#333",
      fillOpacity: 0.65,
      fillColor: colorPalette[ind],
    };
  };
  layers.SladekCircuits.options.onEachFeature = (f, l) => {
    return circuitResultPopup(f.properties, getSladekCircuit(f), l);
  };
  layers.SladekCircuits.addData(circuits);

  layers.constituency33.addData(constituency33);
}

async function loadJson(url) {
  const resp = await fetch(url);
  return await resp.json();
}

function districtPopup({ properties: p }, layer) {
  layer.bindPopup(`<h3>${p.official_name}</h3>`);
}

function circuitPopup({ properties: p }, layer) {
  const content = `
<h3>Obwód ${p.Obwod}</h3>
<h4>${p.Dzielnica}</h4>
<h4>Granice</h4>
${p.Granice}
<h4>Siedziba</h4>
${p.Siedziba}
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
`;
  layer.bindPopup(content);
}
