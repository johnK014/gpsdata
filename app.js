const MAP_BOUNDARIES = {
  B1: {
    topLeft: { lat: 14.264005, lon: 120.919565 },
    topRight: { lat: 14.264018, lon: 120.920337 },
    bottomRight: { lat: 14.263451, lon: 120.920330 },
    bottomLeft: { lat: 14.263468, lon: 120.919589 }
  },
  B2: {
    topLeft: { lat: 14.261578, lon: 120.919865 },
    topRight: { lat: 14.261568, lon: 120.920441 },
    bottomRight: { lat: 14.260945, lon: 120.920432 },
    bottomLeft: { lat: 14.260949, lon: 120.919889 }
  },
  B3: {
    topLeft: { lat: 14.261563, lon: 120.920674 },
    topRight: { lat: 14.261492, lon: 120.922056 },
    bottomRight: { lat: 14.260709, lon: 120.922074 },
    bottomLeft: { lat: 14.260727, lon: 120.920700 }
  },
  B4: {
    topLeft: { lat: 14.262381, lon: 120.919792 },
    topRight: { lat: 14.262390, lon: 120.920635 },
    bottomRight: { lat: 14.261757, lon: 120.920622 },
    bottomLeft: { lat: 14.261744, lon: 120.919752 }
  },
  B5: {
    topLeft: { lat: 14.260344, lon: 120.919820 },
    topRight: { lat: 14.260327, lon: 120.921042 },
    bottomRight: { lat: 14.259626, lon: 120.921061 },
    bottomLeft: { lat: 14.259580, lon: 120.919746 }
  },
  B6: {
    topLeft: { lat: 14.259396, lon: 120.919820 },
    topRight: { lat: 14.259406, lon: 120.920998 },
    bottomRight: { lat: 14.258674, lon: 120.920995 },
    bottomLeft: { lat: 14.258654, lon: 120.919835 }
  }
};

function isPointInPolygon(point, polygon) {
  let x = point[1], y = point[0];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][1], yi = polygon[i][0];
    let xj = polygon[j][1], yj = polygon[j][0];

    let intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getBuildingForCoordinates(lat, lon) {
  for (const [building, bounds] of Object.entries(MAP_BOUNDARIES)) {
    const polygon = [
      [bounds.topLeft.lat, bounds.topLeft.lon],
      [bounds.topRight.lat, bounds.topRight.lon],
      [bounds.bottomRight.lat, bounds.bottomRight.lon],
      [bounds.bottomLeft.lat, bounds.bottomLeft.lon]
    ];
    if (isPointInPolygon([lat, lon], polygon)) {
      return building;
    }
  }
  return null;
}

let machines = [];
const sheetURL = 'https://script.google.com/macros/s/AKfycbyygfiQx7eAIW4gqaC0lux4Q-aq-9T6sQPLZK2S773nhSJEh2doT-8c9LvBHRoXsbAkFQ/exec';
const map = document.getElementById("map");
const floorplan = document.getElementById("floorplan");
const buildingSelect = document.getElementById("buildingSelect");
const searchInput = document.getElementById("searchInput");
const autocompleteList = document.getElementById("autocompleteList");
const promptMessage = document.getElementById("promptMessage");
let dots = [];

const imageMap = {
  B1: "B1.png",
  B2: "B2a.png",
  B3: "B3.png",
  B4: "B4.png",
  B5: "B5.png",
  B6: "B6.png",
};

// Convert GPS to canvas pixel coordinates using 4-corner interpolation
function convertGPSToCanvas(gpsLon, gpsLat, building, imageWidth, imageHeight) {
  const bounds = MAP_BOUNDARIES[building];
  if (!bounds) {
    console.warn(`Missing map boundaries for building ${building}.`);
    return { x: imageWidth / 2, y: imageHeight / 2 };
  }
	
  const { topLeft, topRight, bottomRight, bottomLeft } = bounds;

  const xTop = (gpsLon - topLeft.lon) / (topRight.lon - topLeft.lon);
  const xBottom = (gpsLon - bottomLeft.lon) / (bottomRight.lon - bottomLeft.lon);

  const yTopLat = topLeft.lat + xTop * (topRight.lat - topLeft.lat);
  const yBottomLat = bottomLeft.lat + xBottom * (bottomRight.lat - bottomLeft.lat);

  const yRatio = (yTopLat - gpsLat) / (yTopLat - yBottomLat);
  const xRatio = (xTop + xBottom) / 2;

  const clampedX = Math.max(0, Math.min(1, xRatio));
  const clampedY = Math.max(0, Math.min(1, yRatio));

  return {
    x: clampedX * imageWidth,
    y: clampedY * imageHeight
  };
}


async function fetchMachineData() {
  const url = `${sheetURL}?sheet=Sheet1`; // Assuming your Sheet1 has the data

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // 1. Change: Use .json() to parse the JSON response from Apps Script
    const result = await response.json(); 

    if (result.error) {
        // Handle errors returned from the Apps Script
        throw new Error(`Apps Script Error: ${result.error}`);
    }

    // 2. Change: Access the data array from the JSON object
    const rows = result.data; 

    // Guard against empty data
    if (!rows || rows.length < 2) {
        console.warn("No data rows fetched or only header row exists.");
        machines = [];
        renderDotsForCurrentView();
        return;
    }

    // Original logic starts here: skip the header row (index 0)
    machines = rows.slice(1).map(row => {
      // Data columns: [DeviceName, Time, Lat, Lon]
      const deviceName = String(row[0]).trim(); // Ensure it's a string and trim
      const rawLat = parseFloat(row[2]);
const rawLon = parseFloat(row[3]);
if (isNaN(rawLat) || isNaN(rawLon)) {
  console.warn(`Skipping device ${deviceName}: Invalid coordinates.`);
  return null;
}
const buildingID = getBuildingForCoordinates(rawLat, rawLon) || "B1";


      let mapX, mapY;

      
        const { width, height } = floorplan;
        // Check if lat/lon are valid numbers before conversion
        if (isNaN(rawLat) || isNaN(rawLon)) {
             console.warn(`Skipping device ${deviceName}: Invalid coordinates.`);
             return null; // Skip this entry
        }
        const { x, y } = convertGPSToCanvas(rawLon, rawLat, buildingID, width, height);
        mapX = x;
        mapY = y;
      

      return {
        name: deviceName,
        building: buildingID,
        x: mapX,
        y: mapY
      };
    }).filter(m => m !== null); // Filter out any entries skipped due to invalid coordinates

    console.log("Fetched machines:", machines);
    buildingSelect.value = "B1";
    renderDotsForCurrentView();

  } catch (error) {
    console.error("Failed to fetch or process JSON data:", error);
    promptMessage.textContent = `Error loading data: ${error.message}`;
  }
}

const changeFloorplan = (selectedBuilding, callback) => {
  const newSrc = imageMap[selectedBuilding] || "B1.png";

  if (!floorplan.src.endsWith(newSrc)) {
    floorplan.onload = () => {
      if (callback) callback();
      floorplan.onload = null;
    };
    floorplan.src = newSrc;
  } else {
    if (callback) callback();
  }
};

const renderDotsForCurrentView = (highlightName = null) => {
  dots.forEach(dot => dot.remove());
  dots = [];

  const selectedBuilding = buildingSelect.value;
  const filteredMachines = machines.filter(m => m.building === selectedBuilding);

  filteredMachines.forEach(machine => {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.id = `dot-${machine.name.replace(/\s/g, '_')}`;
    dot.dataset.name = machine.name.toLowerCase();

    dot.title = `${machine.name} | X: ${machine.x.toFixed(2)} px, Y: ${machine.y.toFixed(2)} px`;

    dot.style.left = `${machine.x}px`;
    dot.style.top = `${machine.y}px`;

    if (highlightName && machine.name.toLowerCase() === highlightName.toLowerCase()) {
      dot.classList.add("highlight");
    }

    dot.onclick = () => {
      dots.forEach(d => d.classList.remove("highlight"));
      dot.classList.add("highlight");

      promptMessage.textContent =
        `${machine.name} is in ${machine.building}`;// | Location: X=${machine.x.toFixed(2)} px, Y=${machine.y.toFixed(2)} px`;
    };

    map.appendChild(dot);
    dots.push(dot);
  });
};

buildingSelect.addEventListener("change", function () {
  const selectedBuilding = this.value;

  changeFloorplan(selectedBuilding, () => {
    renderDotsForCurrentView();
  });

  searchInput.value = '';
  promptMessage.textContent = `Viewing ${selectedBuilding}. Click a dot for details.`;
});

searchInput.addEventListener("input", function () {
  const query = this.value.toLowerCase();
  autocompleteList.innerHTML = "";
  if (query.length === 0) return;

  const machineNames = machines.map(m => m.name);
  const matches = machineNames.filter(name => name.toLowerCase().startsWith(query));

  matches.slice(0, 10).forEach(name => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.textContent = name;
    item.onclick = () => {
      searchInput.value = name;
      autocompleteList.innerHTML = "";
      searchMachine();
    };
    autocompleteList.appendChild(item);
  });
});

document.addEventListener("click", function (e) {
  if (!searchInput.contains(e.target) && !autocompleteList.contains(e.target)) {
    autocompleteList.innerHTML = "";
  }
});

function searchMachine() {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return;

  const matchingMachine = machines.find(m => m.name.toLowerCase() === query);

  if (matchingMachine) {
    const foundMachineBuilding = matchingMachine.building;

    if (buildingSelect.value !== foundMachineBuilding) {
      buildingSelect.value = foundMachineBuilding;

      changeFloorplan(foundMachineBuilding, () => {
        renderDotsForCurrentView(query);
      });

    } else {
      renderDotsForCurrentView(query);
    }

    promptMessage.textContent =
      `${matchingMachine.name} found in ${matchingMachine.building}`;// | Location: X=${matchingMachine.x.toFixed(2)} px, Y=${matchingMachine.y.toFixed(2)} px`;

  } else {
    renderDotsForCurrentView();
    promptMessage.textContent = `Machine '${searchInput.value}' not found.`;
  }
}

fetchMachineData();
setInterval(fetchMachineData, 60000);