import * as THREE from "three";
// ✅ Correct Vite-compatible imports
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import SunCalc from 'https://cdn.jsdelivr.net/npm/suncalc/+esm';


// Setup Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const gridSize = 30;
const boxSize = 1;

// Add OSM Buildings
window.addEventListener('DOMContentLoaded', () => {
    const osmb = new OSMBuildings({
        container: 'osmb',
        position: { latitude: 35.684749, longitude: 139.716742 },
        zoom: 18,
        tilt: 45,
        rotation: 0,
        state: true,
        effects: ['shadows']
    });

    osmb.date(new Date());
});



// Target Scene 
const targetScene = new THREE.Scene();
targetScene.background = new THREE.Color(0xffffff);
const targetBoxes = [];

let finalHeights = [];

// Height Color Gradient
function getColorBasedOnHeight(height) {
    const color = new THREE.Color();
    const normalized = Math.min(height / 10, 1); // 10 = max expected height
    color.setHSL(0.7 - normalized * 0.7, 1, 0.5); // cyan to red
    return color;
}

// Add gray base plane for contrast
const groundGeo = new THREE.PlaneGeometry(gridSize * boxSize, gridSize * boxSize);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set((gridSize * boxSize) / 2, 0, (gridSize * boxSize) / 2);
targetScene.add(ground);

// 🔹 Load and place real-world buildings
fetch('/export_3.geojson')
  .then(response => response.json())
  .then(geojson => {
    geojson.features.forEach(feature => {
      if (feature.geometry.type === "Polygon") {
        const coords = feature.geometry.coordinates[0]; // <- Only the first ring (outer shape)

        const shape = new THREE.Shape();
        coords.forEach(([lng, lat], idx) => {
            const manualOffsetX = -8; // <-- You can tweak this number manually
            const manualOffsetY = -22;   // <-- You can tweak this number manually

            const x = (lng - 139.716742) * 20000 + (gridSize * boxSize) / 2 + manualOffsetX;
            const y = (lat - 35.684749) * 20000 + (gridSize * boxSize) / 2 + manualOffsetY;
        
          if (idx === 0) {
            shape.moveTo(x, y);
          } else {
            shape.lineTo(x, y);
          }
        });

        const extrudeSettings = { depth: 1 + Math.random() * 7, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.rotation.x = -Math.PI / 2; // Rotate flat
        mesh.position.y = 0.5; // Slightly above ground
        mesh.scale.set(2, 2, 2); // Scale X, Y, Z (2 = double size)
        scene.add(mesh);
      }
    });
  })
  .catch(err => console.error('Error loading buildings:', err));


const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('three-canvas'), 
    alpha: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // 🚫 No need to append renderer.domElement manually anymore
  

//EntryOverlay
const entryOverlay = document.createElement("div");
entryOverlay.style.position = "fixed";
entryOverlay.style.top = "0";
entryOverlay.style.left = "0";
entryOverlay.style.width = "100%";
entryOverlay.style.height = "100%";
entryOverlay.style.background = "rgba(0,0,0,0.8)";
entryOverlay.style.display = "flex";
entryOverlay.style.alignItems = "center";
entryOverlay.style.justifyContent = "center";
entryOverlay.style.zIndex = "9999";

entryOverlay.innerHTML = `
    <div style="text-align:center; background:black; padding:40px; border:2px dashed white; font-family:Courier New, monospace;">
        <label style="color:white; font-size:20px;">Enter your name:</label><br><br>
        <input type="text" id="playerNameInput" autocomplete="off" style="padding:10px; font-size:18px; width:250px;">
        <button id="startGameBtn" style="padding:10px 20px; font-size:18px; background:#8DB600; color:black; border:none; cursor:pointer;">Start</button>
    </div>
`;

document.body.appendChild(entryOverlay);

let playerName = "Guest";
let isNameInputActive = true; //block key actions

const nameInput = document.getElementById("playerNameInput");
const startBtn = document.getElementById("startGameBtn");

function startGame() {
    const input = nameInput.value.trim();
    playerName = input || "Guest";
    isNameInputActive = false; //allow key controls
    entryOverlay.remove();
}

startBtn.addEventListener("click", startGame);

//press Enter to start
nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
});

const aspect = window.innerWidth / window.innerHeight;
const d = 20;

// Target Camera (Orthographic top-down view)
const targetCam = new THREE.OrthographicCamera(
    -gridSize * boxSize * 0.6,
     gridSize * boxSize * 0.6,
     gridSize * boxSize * 0.6,
    -gridSize * boxSize * 0.6,
    0.1,
    1000
);

// Calculate center of the terrain
const center = new THREE.Vector3((gridSize * boxSize) / 2, 0, (gridSize * boxSize) / 2);

// Set isometric-style angle
const radius = 65;
const isoX = center.x + radius * Math.cos(Math.PI / 4);
const isoY = center.y + radius * Math.sin(THREE.MathUtils.degToRad(30));
const isoZ = center.z + radius * Math.sin(Math.PI / 4);

// 🔹 Create Mini View Canvases
const planCanvas = document.createElement("canvas");
const isoCanvas = document.createElement("canvas");

planCanvas.width = isoCanvas.width = 300;
planCanvas.height = isoCanvas.height = 200;

planCanvas.style.position = isoCanvas.style.position = "fixed";
planCanvas.style.right = isoCanvas.style.right = "10px";
planCanvas.style.zIndex = isoCanvas.style.zIndex = "1000";
planCanvas.style.border = isoCanvas.style.border = "1px solid #444";
planCanvas.style.background = isoCanvas.style.background = "rgba(255, 255, 255, 0.4)";

// Position one above the other
planCanvas.style.top = "20px";
isoCanvas.style.top = "230px";

document.body.appendChild(planCanvas);
document.body.appendChild(isoCanvas);

const entriesZone = document.createElement("div");
entriesZone.style.position = "fixed";
entriesZone.style.right = "10px";
entriesZone.style.bottom = "10px"
entriesZone.style.width = "280px"
entriesZone.style.maxHeight = "380px"
entriesZone.style.overflowY = "auto";
entriesZone.style.color = "white";
entriesZone.style.fontFamily = "Courier New, monospace";
entriesZone.style.fontSize = "14px";
entriesZone.style.background = "rgba(0, 0, 0, 0.6)";
entriesZone.style.border = "1px dashed white";
entriesZone.style.padding = "10px";
entriesZone.style.zIndex = "1000";
entriesZone.innerHTML = "<strong>ENTRIES</strong><br>";
document.body.appendChild(entriesZone);

renderer.autoClear = false;
renderer.setScissorTest(true);

const planRenderer = new THREE.WebGLRenderer({ canvas: planCanvas });
const isoRenderer = new THREE.WebGLRenderer({ canvas: isoCanvas });

planRenderer.setSize(planCanvas.width, planCanvas.height);
isoRenderer.setSize(isoCanvas.width, isoCanvas.height);

let activeCamera = camera; 
let renderPass;

const clock = new THREE.Clock();

const miniPlanCam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const miniIsoCam = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);

const orthoCamera = new THREE.OrthographicCamera(
    -d * aspect, d * aspect,
    d, -d,
    0.1, 1000
);

// Create title
const titleLabel = document.createElement("div");
titleLabel.style.position = "fixed";
titleLabel.style.top = "10px";
titleLabel.style.left = "20px";
titleLabel.style.zIndex = "1000";

const titleImg = document.createElement("img");
titleImg.src = "motion-match-title.png"; // ✅ local path
titleImg.style.height = "120px"; // Adjust as needed
titleImg.alt = "Motion Match Title";

titleLabel.appendChild(titleImg);
document.body.appendChild(titleLabel);

// 🔹 Countdown Timer UI
const countdownDiv = document.createElement("div");
countdownDiv.style.position = "fixed";
countdownDiv.style.top = "20px";
countdownDiv.style.left = "50%";
countdownDiv.style.transform = "translateX(-50%)";
countdownDiv.style.color = "rgb(51, 0, 255)";
countdownDiv.style.fontSize = "24px";
countdownDiv.style.fontFamily = "Courier New, sans-serif";
//countdownDiv.style.background = "rgba(255, 255, 255, 0.4)";
countdownDiv.style.padding = "10px 20px";
countdownDiv.style.borderRadius = "5px";
countdownDiv.style.zIndex = "1000";
document.body.appendChild(countdownDiv);

function countdownTimer(seconds) {
    let timeLeft = seconds;
    countdownDiv.innerText = `New round in ${timeLeft} seconds...`;

    const interval = setInterval(() => {
        if (isPaused) return; // Skip tick if paused

        timeLeft--;
        countdownDiv.innerText = `New round in ${timeLeft} seconds...`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            countdownDiv.innerText = "";
        }
    }, 1000);
}

// 🔹 Attempt Counter UI
const attemptDiv = document.createElement("div");
attemptDiv.style.position = "fixed";
attemptDiv.style.bottom = "170px";
attemptDiv.style.left = "20px";
attemptDiv.style.color = "#ffffff";
attemptDiv.style.fontSize = "20px";
attemptDiv.style.fontFamily = "Courier New, sans-serif";
attemptDiv.style.background = "rgba(8, 0, 255, 0.37)";
attemptDiv.style.padding = "8px 16px";
attemptDiv.style.borderRadius = "5px";
attemptDiv.style.zIndex = "1000";
attemptDiv.innerText = `Round: 0`;
document.body.appendChild(attemptDiv);

// 🔹 Export Button UI
const exportBtn = document.createElement("button");
exportBtn.innerText = "Export Terrain";
exportBtn.style.position = "fixed";
exportBtn.style.bottom = "10px";
exportBtn.style.left = "20px";
exportBtn.style.transform = "none";
exportBtn.style.fontSize = "16px";
exportBtn.style.fontFamily = "Courier New, sans-serif";
exportBtn.style.padding = "10px 20px";
exportBtn.style.border = "none";
exportBtn.style.borderRadius = "5px";
exportBtn.style.cursor = "pointer";
exportBtn.style.background = "#eb34b4";
exportBtn.style.color = "white";
exportBtn.style.zIndex = "1000";
document.body.appendChild(exportBtn);

// View toggle label
const viewLabel = document.createElement("div");
viewLabel.style.position = "fixed";
viewLabel.style.top = "60px";
viewLabel.style.left = "50%";
viewLabel.style.transform = "translateX(-50%)";
viewLabel.style.color = "rgb(51, 0, 255)";
viewLabel.style.fontSize = "18px";
viewLabel.style.fontFamily = "Courier New, sans-serif";
viewLabel.style.zIndex = "1000";
viewLabel.innerText = "[V] Gameplay";
document.body.appendChild(viewLabel);

// Button click = trigger export
exportBtn.addEventListener("click", exportScene);

// 🔹 Time Stop Button UI
const pauseBtn = document.createElement("button");
pauseBtn.innerText = "⏸ Pause [P]";
pauseBtn.style.position = "fixed";
pauseBtn.style.bottom = "110px";
pauseBtn.style.left = "20px";
pauseBtn.style.transform = "none";
pauseBtn.style.fontSize = "16px";
pauseBtn.style.fontFamily = "Courier New, sans-serif";
pauseBtn.style.padding = "10px 20px";
pauseBtn.style.border = "none";
pauseBtn.style.borderRadius = "5px";
pauseBtn.style.cursor = "pointer";
pauseBtn.style.background = "#f44336";
pauseBtn.style.color = "white";
pauseBtn.style.zIndex = "1000";
document.body.appendChild(pauseBtn);

const keysInfoBox = document.createElement("div");
keysInfoBox.style.lineHeight = "2"
keysInfoBox.innerHTML = `
  <strong>C O N T R O L S </strong><br>
  [WASD] → Move<br>
  [space] → jump<br>
  [P] → Pause<br>
  [V] → Toggle View
`;

keysInfoBox.style.position = "fixed";
keysInfoBox.style.top = "130px";  
keysInfoBox.style.left = "20px";  
//keysInfoBox.style.background = "rgba(0, 0, 0, 0.5)";
keysInfoBox.style.color = "rgb(51, 0, 255)";
keysInfoBox.style.border = "2px dashed blue";
keysInfoBox.style.padding = "10px 15px";
keysInfoBox.style.fontFamily = "Courier New, monospace";
keysInfoBox.style.fontSize = "14px";
keysInfoBox.style.borderRadius = "6px";
keysInfoBox.style.zIndex = "1000";

document.body.appendChild(keysInfoBox);


// Finish Button UI
const finishBtn = document.createElement("button");
finishBtn.innerText = "SUBMIT / FINISH";
finishBtn.style.position = "fixed";
finishBtn.style.bottom = "60px";
finishBtn.style.left = "20px";
finishBtn.style.fontSize = "16px";
finishBtn.style.fontFamily = "Courier New, sans-serif";
finishBtn.style.padding = "10px 20px";
finishBtn.style.border = "none";
finishBtn.style.borderRadius = "5px";
finishBtn.style.cursor = "pointer";
finishBtn.style.background = "#4caf50";
finishBtn.style.color = "white";
finishBtn.style.zIndex = "1000";
document.body.appendChild(finishBtn);

//Finish Game function
finishBtn.addEventListener("click", () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const tilesStepped = Object.keys(visitedTiles).length;

    const entry = document.createElement("div");
    entry.style.marginBottom = "10px";
    entry.style.paddingBottom = "10px";
    entry.style.borderBottom = "1px dashed white";

    entry.innerHTML = `
      <strong>${playerName}</strong> @ ${timeStr}<br>
      🛤️ Tiles Stepped: ${tilesStepped}
    `;

    entriesZone.insertBefore(entry, entriesZone.children[1]);

    const savedEntries = JSON.parse(localStorage.getItem("matchEntries") || "[]");
    savedEntries.push({
      name: playerName,
      time: timeStr,
      tilesStepped: tilesStepped
    });
    localStorage.setItem("matchEntries", JSON.stringify(savedEntries));
});

function loadSavedEntries() {
    const saved = JSON.parse(localStorage.getItem("matchEntries") || "[]");
    saved.reverse().forEach(({ name, time, tilesStepped }) => {

        const entry = document.createElement("div");
        entry.style.marginBottom = "10px";
        entry.style.paddingBottom = "10px";
        entry.style.borderBottom = "1px dashed white";

        entry.innerHTML = `
          <strong>${name}</strong> @ ${time}<br>
          🛤️ Tiles Stepped: ${tilesStepped}
        `;

        entriesZone.appendChild(entry);
    });
}
loadSavedEntries();

// Score Display UI
const scoreDiv = document.createElement("div");
scoreDiv.style.position = "fixed";
scoreDiv.style.top = "120px";
scoreDiv.style.left = "50%";
scoreDiv.style.transform = "translateX(-50%)";
scoreDiv.style.fontSize = "22px";
scoreDiv.style.fontFamily = "Courier New, sans-serif";
scoreDiv.style.color = "white";
scoreDiv.style.background = "rgba(0,0,0,0.6)";
scoreDiv.style.padding = "10px 20px";
scoreDiv.style.borderRadius = "5px";
scoreDiv.style.zIndex = "1000";
document.body.appendChild(scoreDiv);

// Post-Processing
const composer = new EffectComposer(renderer);
renderPass = new RenderPass(scene, activeCamera);
composer.addPass(renderPass);

const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, activeCamera);
outlinePass.edgeStrength = 5;
outlinePass.edgeGlow = 5;
outlinePass.visibleEdgeColor.set(0xffffff);
composer.addPass(outlinePass);

// Camera Holder
const cameraHolder = new THREE.Object3D();
cameraHolder.add(camera);
scene.add(cameraHolder);

// Lighting
// Ambient light (soft general light)
const ambientLight = new THREE.AmbientLight(0xffffff, 5); 
scene.add(ambientLight);

// Directional light (like the sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(100, 200, 100); // (x, y, z)
scene.add(directionalLight);

composer.passes = [];
composer.addPass(new RenderPass(scene, activeCamera));
composer.addPass(outlinePass);


// Grid Setup
const boxes = [];
const visitedTiles = {};

let currentPath = [];
let ghostPaths = [];
let ghosts = [];
let isPaused = false;
let shouldUpdateMiniViews = true;
let lastMiniViewUpdate = 0;
const miniUpdateInterval = 10000; // 10 seconds

// Gravity + Jump
const gravity = -0.008;
const jumpStrength = 0.2;
let velocityY = 0;
let isGrounded = false;

// Grid of Boxes
for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
        const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const material = new THREE.MeshBasicMaterial({ color: getColorBasedOnHeight(1), wireframe: true });
        const box = new THREE.Mesh(geometry, material);
        box.position.set(x * boxSize, 0.5, z * boxSize);
        scene.add(box);
        boxes.push({ box, x, z });
    }
}

// Player Start
const startX = (gridSize * boxSize) / 2;
const startZ = (gridSize * boxSize) / 2;
function respawnPlayer() {
    cameraHolder.position.set(startX, 1.5, startZ);
    velocityY = 0;
}

// Controls
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    " ": false,
    j: false, // turn left
    k: false  // turn right
};

window.addEventListener("keydown", e => {
    if (isNameInputActive) return;

    if (e.key in keys) keys[e.key] = true;

    if (e.key.toLowerCase() === "p") {
        isPaused = !isPaused;
        pauseBtn.innerText = isPaused ? "Resume" : "Pause";
    }
});

window.addEventListener("keyup", e => {
    if (isNameInputActive) return;
    if (e.key in keys) keys[e.key] = false;
});

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update main renderer
    renderer.setSize(width, height);

    // Update main camera
    if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    if (orthoCamera.isOrthographicCamera) {
        const aspect = width / height;
        const d = 20;
        orthoCamera.left = -d * aspect;
        orthoCamera.right = d * aspect;
        orthoCamera.top = d;
        orthoCamera.bottom = -d;
        orthoCamera.updateProjectionMatrix();
    }

    // Update post-processing composer
    composer.setSize(width, height);
    outlinePass.setSize(width, height);
});

// Mouse Look
let yaw = 0, pitch = 0;
function onMouseMove(event) {
    if (viewMode !== 0) return;
    const sensitivity = 0.0007;
    yaw -= event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch));
    cameraHolder.rotation.y = yaw;
    camera.rotation.x = pitch;
}
document.body.addEventListener("mousemove", onMouseMove);
document.body.addEventListener("click", () => {
    if (viewMode === 0) document.body.requestPointerLock();
});

// Terrain Logic
function modifyTileHeight(x, z, isGhost = false) {
    let gridX = Math.floor(x / boxSize);
    let gridZ = Math.floor(z / boxSize);
    let key = `${gridX},${gridZ}`;

    if (!visitedTiles[key]) visitedTiles[key] = 1;
    else visitedTiles[key] += isGhost ? 0.5 : 1;

    let tile = boxes.find(b => b.x === gridX && b.z === gridZ);
    if (tile) {
        let newHeight = 1 + Math.log(visitedTiles[key] + 1);
        newHeight = Math.max(1, newHeight); // Avoid super low values

        // Dispose old geometry and assign new one
        tile.box.geometry.dispose();
        tile.box.geometry = new THREE.BoxGeometry(boxSize, newHeight, boxSize);
        tile.box.position.y = newHeight / 2;
        tile.box.material.color = getColorBasedOnHeight(newHeight);

        // Store actual height for accurate scoring
        tile.actualHeight = newHeight;
    }
}



function drawSunPath() {
    const sunPathPoints = [];
    const center = new THREE.Vector3(gridSize * boxSize / 2, 0, gridSize * boxSize / 2);
    const radius = 50;

    const date = new Date(); 
    date.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 24; i += 0.5) { // every 30 min
        const time = new Date(date.getTime() + i * 60 * 60 * 1000);
        const sunPos = SunCalc.getPosition(time, 13.738596, 100.645505);

        const azimuth = sunPos.azimuth + Math.PI;
        const altitude = sunPos.altitude;

        const x = center.x + radius * Math.cos(altitude) * Math.cos(azimuth);
        const y = center.y + radius * Math.sin(altitude);
        const z = center.z + radius * Math.cos(altitude) * Math.sin(azimuth);

        const position = new THREE.Vector3(x, y, z);
        sunPathPoints.push(position);

        // 🔥 Every full hour, add tiny sphere and label
        if (i % 1 === 0) {
            const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.copy(position);
            scene.add(sphere);

            // 🔥 Label time nicely (like "9AM" or "3PM")
            let hour = (i % 24);
            let labelText = `${(hour % 12) || 12}${hour < 12 ? "AM" : "PM"}`;
            
            const timeLabel = makeTextLabel(labelText);
            timeLabel.position.copy(position);
            timeLabel.position.y += 2; // move label slightly above
            scene.add(timeLabel);
        }
    }

    const sunPathGeometry = new THREE.BufferGeometry().setFromPoints(sunPathPoints);

    const sunPathMaterial = new THREE.LineDashedMaterial({
        color: 0xffa500,
        dashSize: 3,
        gapSize: 1.5,
    });

    const sunPathLine = new THREE.Line(sunPathGeometry, sunPathMaterial);
    sunPathLine.computeLineDistances(); // REQUIRED for dashed lines to work!
    scene.add(sunPathLine);
}

function makeTextLabel(text) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'orange';
    ctx.font = '100px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(5, 2.5, 1); // adjust the size if needed
    return sprite;
}

// ✨ Run it
drawSunPath();

// Player Movement Trail
function trackPlayerPosition() {
    let pos = { 
        x: cameraHolder.position.x, 
        y: cameraHolder.position.y, 
        z: cameraHolder.position.z 
    };    
    currentPath.push(pos);
    modifyTileHeight(pos.x, pos.z);
}

// Ghosts
function createGhost(roundNum) {
    const geometry = new THREE.BoxGeometry(0.7, 1.5, 0.7);
    const material = new THREE.MeshBasicMaterial({ color: 0xdedede });
    const ghost = new THREE.Mesh(geometry, material);
    scene.add(ghost);

    // Add floating round number
    const label = makeTextSprite(`${roundNum}`);
    label.position.set(0, 1, 0); // Hover above the ghost
    ghost.add(label); // Attach to ghost so it follows

    ghosts.push(ghost);
    return ghost;
}

function spawnGhosts(roundNum) {
    ghostPaths.push([...currentPath]);
    drawGhostTrail(currentPath, roundNum);
    currentPath = [];

    ghostPaths.forEach((path, index) => {
        let ghost = ghosts[index] || createGhost(roundNum);
        ghosts[index] = ghost;
        ghost.movementPath = path;
        ghost.currentStep = 0;
        ghost.speed = 0.47;
    });
}

function drawGhostTrail(path, roundNum) {
    const points = path.map(p => new THREE.Vector3(p.x, 0.01, p.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xababab });
    const line = new THREE.Line(geometry, material);
    scene.add(line);

    // 🔸 Sprite number labels
    for (let i = 0; i < points.length; i += 5) {
        const sprite = makeTextSprite(`${roundNum}`);
        sprite.position.copy(points[i]);
        sprite.position.y = 0.08;
        scene.add(sprite);
    }
}

function makeTextSprite(message) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;

    context.font = '40px Courier New';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.5, 1, 0.5); // Bigger text
    sprite.rotation.x = -Math.PI / 2; // Lay flat on ground
    return sprite;
}

// Convert lat/lon to tile x,y at a specific zoom level
function lonLatToTileXY(lon, lat, zoom) {
    const xTile = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const yTile = Math.floor(
        (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)
    );
    return { x: xTile, y: yTile };
}

function addMapTexture() {
    const centerLat = 35.684749;
    const centerLon = 139.716742;
    const zoom = 16; // zoom out a bit if needed

    const { x, y } = lonLatToTileXY(centerLon, centerLat, zoom);
    const tileUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

    const loader = new THREE.TextureLoader();
    loader.load(tileUrl, (texture) => {
        
        // --- 🛠️ Control plane size and offset here ---
        const sizeMultiplier = 1; // 🔥 make map plane 1.8x bigger than grid
        const manualOffsetX = -55;  // 🔥 adjust left-right
        const manualOffsetY = -45;  // 🔥 adjust up-down
        const planeYPosition = 0.9; // a bit above the ground

        const planeSize = gridSize * boxSize * sizeMultiplier * 2;

        const mapPlaneGeo = new THREE.PlaneGeometry(planeSize, planeSize);
        const mapPlaneMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1, // or 0.8 if you want semi-transparent
        });

        const mapPlane = new THREE.Mesh(mapPlaneGeo, mapPlaneMat);
        mapPlane.rotation.x = -Math.PI / 2; // flat on ground

        mapPlane.position.set(
            (gridSize * boxSize*4) / 2 + manualOffsetX,
            planeYPosition,
            (gridSize * boxSize*4) / 2 + manualOffsetY
        );

        // --- prevent texture from repeating weirdly ---
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(1, 1);

        scene.add(mapPlane);
    });

}

function addWhiteGroundPlane() {
    const planeSize = gridSize * boxSize * 1; // twice bigger than your box grid

    const whitePlaneGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const whitePlaneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const whitePlane = new THREE.Mesh(whitePlaneGeo, whitePlaneMat);

    whitePlane.rotation.x = -Math.PI / 2;

    const manualOffsetX = 0;
    const manualOffsetY = 0;

    whitePlane.position.set(
        (gridSize * boxSize) / 2 + manualOffsetX,
        0.8,  // <--- SET HEIGHT to 0.9
        (gridSize * boxSize) / 2 + manualOffsetY
    );

    scene.add(whitePlane);
}

addWhiteGroundPlane();


function logPlayerEntry(name, heights, time) {
    const entry = document.createElement("div");
    entry.style.marginBottom = "10px";
    entry.innerHTML = `<strong>${name}</strong> @ ${time}<br>Heights: [${heights.slice(0, 6).join(', ')}...]`;
    entriesZone.appendChild(entry);
}

let attemptCount = 0;
let resetTimer = 0;

function exportScene() {
    const exporter = new GLTFExporter();

    // Clone the scene so we can modify it without affecting the game
    const exportScene = new THREE.Scene();

    // Copy all terrain boxes but use solid materials
    boxes.forEach(({ box }) => {
        const clone = box.clone();
        const solidMaterial = new THREE.MeshStandardMaterial({
            color: box.material.color.clone(),
            wireframe: false
        });
        clone.material = solidMaterial;
        exportScene.add(clone);
    });

    exporter.parse(
        exportScene,
        (result) => {
            const output = JSON.stringify(result);
            const blob = new Blob([output], { type: 'application/octet-stream' });

            const link = document.createElement('a');
            link.style.display = 'none';
            document.body.appendChild(link);

            link.href = URL.createObjectURL(blob);
            link.download = 'terrain.glb';
            link.click();
        },
        { binary: true }
    );
}
addMapTexture();



// Game Loop
function resetGame() {
    if (attemptCount > 0) {
        spawnGhosts(attemptCount); //Only spawn ghosts starting from round 1
    }

    respawnPlayer();
    countdownTimer(10);

    attemptCount++;
    attemptDiv.innerText = `ROUND: ${attemptCount}`;
    shouldUpdateMiniViews = true;

    let lastMiniViewUpdate = performance.now();
    const miniUpdateInterval = 10000; // 10 seconds
    }

    outlinePass.edgeStrength = 5;
    outlinePass.edgeGlow = 5;
    outlinePass.visibleEdgeColor.set(0xffffff);

    composer.passes = [];
    composer.addPass(renderPass);
    composer.addPass(outlinePass);
    composer.setSize(window.innerWidth, window.innerHeight); //important in case of resize

    // Restart gameplay
    respawnPlayer();
    isPaused = false;
    resetTimer = 0;
    countdownTimer(10);

    // Respawn player and camera
    respawnPlayer();

    // Reset timers and flags
    isPaused = false;
    resetTimer = 0;
    countdownTimer(10);

resetGame();

const resetDelay = 10000; // 10 seconds

function tickResetTimer(delta) {
    if (isPaused) return;

    resetTimer += delta;
    if (resetTimer >= resetDelay) {
        resetGame();
        resetTimer = 0;
    }
}

// Isometric View Toggle
let viewMode = 0; // 0 = gameplay, 1 = plan, 2 = isometric
function switchView() {
    viewMode = (viewMode + 1) % 3;

    // Remove both cameras from wherever they were
    if (camera.parent) camera.parent.remove(camera);
    if (orthoCamera.parent) orthoCamera.parent.remove(orthoCamera);
    const center = new THREE.Vector3(gridSize / 2, 0, gridSize / 2);

    if (viewMode === 1) {
        // 🔹 Plan / top-down view
        scene.add(camera);
        camera.position.set(center.x, 40, center.z);
        camera.up.set(0, 0, -1);
        camera.lookAt(center);
        activeCamera = camera;
        viewLabel.innerText = "[V] Plan View";

    } else if (viewMode === 2) {
        // 🔹 True Isometric (Orthographic)
        scene.add(orthoCamera);

        const radius = 65;
        const isoX = center.x + radius * Math.cos(Math.PI / 4);
        const isoY = center.y + radius * Math.sin(THREE.MathUtils.degToRad(30));
        const isoZ = center.z + radius * Math.sin(Math.PI / 4);

        orthoCamera.position.set(isoX, isoY, isoZ);
        orthoCamera.lookAt(center);
        orthoCamera.up.set(0, 1, 0);

        orthoCamera.zoom = 0.8; // < 1 = zoom out, > 1 = zoom in
        orthoCamera.updateProjectionMatrix(); // REQUIRED after changing zoom

        activeCamera = orthoCamera;
        renderPass.camera = activeCamera;
        outlinePass.camera = activeCamera;

        const cameraOffset = new THREE.Vector3(isoX, isoY + 10, isoZ); // just move up
        orthoCamera.position.copy(cameraOffset);

        viewLabel.innerText = "[V] Isometric View";

    } else {
        // 🔹 Gameplay / first-person
        cameraHolder.add(camera);
        camera.position.set(0, 0, 0);
        camera.rotation.set(0, 0, 0);
        activeCamera = camera;

        renderPass.camera = activeCamera;
        outlinePass.camera = activeCamera;
        viewLabel.innerText = "[V] Gameplay";
    }
}

window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === 'v') switchView();
});

// Animation
const speed = 0.05;
function animate() {
    requestAnimationFrame(animate);

// Smooth arrow key turning
if (keys.j) yaw += 0.01; // turn left
if (keys.k) yaw -= 0.01; // turn right
cameraHolder.rotation.y = yaw;
cameraHolder.rotation.y = yaw;

    if (!isPaused) {
        if (viewMode === 0) {
            const cameraDirection = new THREE.Vector3();
            cameraHolder.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const strafeDirection = new THREE.Vector3();
            strafeDirection.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

            const moveDir = new THREE.Vector3();
            if (keys.w) moveDir.addScaledVector(cameraDirection, -speed);
            if (keys.s) moveDir.addScaledVector(cameraDirection, speed);
            if (keys.a) moveDir.addScaledVector(strafeDirection, speed);
            if (keys.d) moveDir.addScaledVector(strafeDirection, -speed);

            cameraHolder.position.add(moveDir);

            velocityY += gravity;
            cameraHolder.position.y += velocityY;

            if (cameraHolder.position.y < -100) {
                respawnPlayer();
                velocityY = 0;
            }

            const gridX = Math.floor(cameraHolder.position.x / boxSize);
            const gridZ = Math.floor(cameraHolder.position.z / boxSize);
            const tile = boxes.find(b => b.x === gridX && b.z === gridZ);

            if (tile) {
                const topY = tile.box.scale.y * 0.5 + tile.box.position.y;
                const playerFeet = cameraHolder.position.y - 1;

                const desiredY = topY + 1;
                if (playerFeet <= topY) {
                    velocityY = 0;
                    isGrounded = true;
                    cameraHolder.position.y = THREE.MathUtils.lerp(cameraHolder.position.y, desiredY, 0.1);
                } else {
                    isGrounded = false;
                }
            }

            if (keys[" "] && isGrounded) {
                velocityY = jumpStrength;
                isGrounded = false;
            }

            trackPlayerPosition();
        }

        // Ghosts
        ghosts.forEach(ghost => {
            if (ghost.movementPath && ghost.currentStep < ghost.movementPath.length - 1) {
                let nextPos = ghost.movementPath[ghost.currentStep + 1];
                ghost.position.lerp(new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z), ghost.speed);
                if (ghost.position.distanceTo(new THREE.Vector3(nextPos.x, nextPos.y, nextPos.z)) < 0.1) {
                    ghost.currentStep++;
                    modifyTileHeight(ghost.position.x, ghost.position.z, true);
                }
            }
        });
    }

const delta = clock.getDelta() * 1000; // milliseconds
tickResetTimer(delta);

// Clear full canvas once
renderer.clear();

// MAIN VIEW (full screen)
const w = window.innerWidth;
const h = window.innerHeight;
const miniW = w * 0.25;
const miniH = h * 0.25;

renderer.setViewport(0, 0, w, h);
renderer.setScissor(0, 0, w, h);
renderer.setScissorTest(true);
composer.render(); // Render main view with activeCamera

const now = performance.now();
if (now - lastMiniViewUpdate > miniUpdateInterval) {

    // Update PLAN View
    miniPlanCam.aspect = planCanvas.width / planCanvas.height;
    miniPlanCam.updateProjectionMatrix();
    miniPlanCam.position.set(gridSize / 2, 40, gridSize / 2);
    miniPlanCam.up.set(0, 0, -1);
    miniPlanCam.lookAt(new THREE.Vector3(gridSize / 2, 0, gridSize / 2));
    planRenderer.render(scene, miniPlanCam);

    // Update ISO View
    const center = new THREE.Vector3(gridSize / 2, 0, gridSize / 2);
    const isoRadius = 65;
    const isoX = center.x + isoRadius * Math.cos(Math.PI / 4);
    const isoY = center.y + isoRadius * Math.sin(THREE.MathUtils.degToRad(20)); // same angle as main
    const isoZ = center.z + isoRadius * Math.sin(Math.PI / 4);

    miniIsoCam.position.set(isoX, isoY, isoZ);
    miniIsoCam.lookAt(center);
    miniIsoCam.up.set(0, 1, 0);
    const cameraOffset = new THREE.Vector3(isoX, isoY + 10, isoZ);
    miniIsoCam.position.copy(cameraOffset);
    miniIsoCam.zoom = 1;
    miniIsoCam.updateProjectionMatrix();
    isoRenderer.render(scene, miniIsoCam);

    lastMiniViewUpdate = now;
    }
    }

// Label for Plan View
const planLabel = document.createElement("div");
planLabel.innerText = "MINI-PLAN VIEW";
planLabel.style.position = "fixed";
planLabel.style.right = "10px";
planLabel.style.top = "10px";
planLabel.style.color = "white";
planLabel.style.fontSize = "14px";
planLabel.style.fontFamily = "Courier New, monospace";
planLabel.style.background = "rgba(0,0,0,0.6)";
planLabel.style.padding = "2px 6px";
planLabel.style.borderRadius = "4px";
planLabel.style.zIndex = "1001";
document.body.appendChild(planLabel);

// Label for Isometric View
const isoLabel = document.createElement("div");
isoLabel.innerText = "MINI-ISOMETRIC VIEW";
isoLabel.style.position = "fixed";
isoLabel.style.right = "10px";
isoLabel.style.top = "225px"; // 200px canvas + 10px spacing
isoLabel.style.color = "white";
isoLabel.style.fontSize = "14px";
isoLabel.style.fontFamily = "Courier New, monospace";
isoLabel.style.background = "rgba(0,0,0,0.6)";
isoLabel.style.padding = "2px 6px";
isoLabel.style.borderRadius = "4px";
isoLabel.style.zIndex = "1001";
document.body.appendChild(isoLabel);

animate();