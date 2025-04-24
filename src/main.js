import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import starmapData from './data/starmap.json';

// Global variables
let backgroundSystem;

// Load affiliation textures
const textureLoader = new THREE.TextureLoader();
const affiliationTextures = {
  BANU: textureLoader.load('/images/BANU.png'),
  DEV: textureLoader.load('/images/DEV.png'),
  NONE: textureLoader.load('/images/NONE.png'),
  UNC: textureLoader.load('/images/UNC.png'),
  VNCL: textureLoader.load('/images/VNCL.png'),
  XIAN: textureLoader.load('/images/XIAN.png')
};

// Load system textures
const systemTextures = {
  1: textureLoader.load('/images/01_Texture.jpg'),
  2: textureLoader.load('/images/02_Texture.jpg'),
  3: textureLoader.load('/images/03_Texture.jpg'),
  4: textureLoader.load('/images/04_Texture.jpg'),
  5: textureLoader.load('/images/05_Texture.jpg'),
  6: textureLoader.load('/images/06_Texture.jpg'),
  7: textureLoader.load('/images/07_Texture.jpg'),
  8: textureLoader.load('/images/08_Texture.jpg'),
  9: textureLoader.load('/images/09_Texture.jpg')
};

// Star materials and geometries
function createStarMaterial(textureId) {
  return new THREE.MeshPhongMaterial({ 
    map: systemTextures[textureId],
    bumpMap: systemTextures[textureId],
    bumpScale: 0.05,
    specularMap: systemTextures[textureId],
    specular: new THREE.Color(0x333333),
    shininess: 25,
    emissive: 0x222222
  });
}

// Create star mesh with appropriate texture based on affiliation
function getTextureIdForSystem(system) {
  const affiliationId = system.affiliation?.[0]?.id;
  if (!affiliationId) return 1; // default texture
  return Math.min(9, Math.max(1, affiliationId)); // ensure it's between 1 and 9
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Minimap setup
const minimapCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1000);
minimapCamera.position.set(0, 0, 100);
minimapCamera.lookAt(0, 0, 0);
const minimapRenderer = new THREE.WebGLRenderer({ antialias: true });
minimapRenderer.setSize(200, 200);
document.getElementById('minimap').appendChild(minimapRenderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 500;
camera.position.z = 100;

// UI Elements
const systemInfo = document.querySelector('.system-info');
const resetViewBtn = document.getElementById('resetView');
const toggleLabelsBtn = document.getElementById('toggleLabels');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const filterContainer = document.getElementById('filter-container');
const routeFrom = document.getElementById('routeFrom');
const routeTo = document.getElementById('routeTo');
const routeFromResults = document.getElementById('routeFromResults');
const routeToResults = document.getElementById('routeToResults');
const calculateRouteBtn = document.getElementById('calculateRoute');
const shipSizeSelect = document.getElementById('shipSize');
const toggleRoutesBtn = document.getElementById('toggleRoutes');
let labelsVisible = true;

// Star materials and geometries
const starMaterials = {
  default: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x555555
  }),
  BANU: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x555555
  }),
  DEV: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x5f4415
  }),
  UNC: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x8b4b11
  }),
  VNCL: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x590015
  }),
  XIAN: new THREE.MeshPhongMaterial({ 
    color: 0xFFFFFF,
    emissive: 0x555555
  })
};

// Create sprite materials for logos
const logoMaterials = {
  BANU: new THREE.SpriteMaterial({ map: affiliationTextures.BANU, transparent: true }),
  DEV: new THREE.SpriteMaterial({ map: affiliationTextures.DEV, transparent: true }),
  NONE: new THREE.SpriteMaterial({ map: affiliationTextures.NONE, transparent: true }),
  UNC: new THREE.SpriteMaterial({ map: affiliationTextures.UNC, transparent: true }),
  VNCL: new THREE.SpriteMaterial({ map: affiliationTextures.VNCL, transparent: true }),
  XIAN: new THREE.SpriteMaterial({ map: affiliationTextures.XIAN, transparent: true })
};

// Add lighting
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
camera.add(pointLight);
scene.add(camera);

// Create stars
const systems = starmapData.data.systems.resultset;
const starGroups = {};
const systemsMap = new Map();
const labels = [];
const starGeometry = new THREE.SphereGeometry(0.5, 32, 32);

// Shader materials
const glowShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    uniform float coefficient;
    uniform float power;
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float intensity = pow(coefficient - dot(vPositionNormal, vNormal), power);
      gl_FragColor = vec4(glowColor, intensity);
    }
  `
};

// Create star mesh with glow effect
function createStarWithGlow(system, textureId) {
  const group = new THREE.Group();
  
  // Main star
  const starMaterial = createStarMaterial(textureId);
  const starMesh = new THREE.Mesh(starGeometry, starMaterial);
  group.add(starMesh);
  
  // Inner glow
  const glowGeometry = new THREE.SphereGeometry(0.6, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(system.affiliation?.[0]?.color || '#ffffff') },
      coefficient: { value: 0.5 },
      power: { value: 2.0 }
    },
    vertexShader: glowShader.vertexShader,
    fragmentShader: glowShader.fragmentShader,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  
  const innerGlow = new THREE.Mesh(glowGeometry, glowMaterial);
  group.add(innerGlow);
  
  // Outer glow
  const outerGlowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
  const outerGlowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(system.affiliation?.[0]?.color || '#ffffff') },
      coefficient: { value: 0.3 },
      power: { value: 3.0 }
    },
    vertexShader: glowShader.vertexShader,
    fragmentShader: glowShader.fragmentShader,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  
  const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
  group.add(outerGlow);
  
  group.position.set(system.position_x, system.position_y, system.position_z);
  group.userData.system = system;
  
  return group;
}

// Create star systems function
function createStarSystems() {
  systems.forEach(system => {
    const affiliation = system.affiliation?.[0]?.code?.toUpperCase() || 'default';
    systemsMap.set(`${system.position_x},${system.position_y},${system.position_z}`, system);
    
    // Create star with glow effects
    const textureId = getTextureIdForSystem(system);
    const starGroup = createStarWithGlow(system, textureId);
    scene.add(starGroup);
    
    // Create logo sprite
    if (affiliation !== 'default' && logoMaterials[affiliation]) {
      const sprite = new THREE.Sprite(logoMaterials[affiliation]);
      sprite.position.copy(starGroup.position);
      sprite.position.z += 0.6;
      sprite.scale.set(0.5, 0.5, 1);
      sprite.userData.system = system;
      scene.add(sprite);
    }
    
    if (!starGroups[affiliation]) {
      starGroups[affiliation] = [];
    }
    starGroups[affiliation].push(starGroup);
    
    // Create label
    const div = document.createElement('div');
    div.className = 'label';
    div.innerHTML = `${system.name}<br>SYSTEM`;
    div.style.color = system.affiliation?.[0]?.color || 'white';
    div.style.position = 'absolute';
    div.style.padding = '0px 2px';
    div.style.backgroundColor = 'rgba(0,0,0,0.7)';
    div.style.fontSize = '12px';
    div.style.textAlign = 'right';
    div.style.pointerEvents = 'auto';
    div.style.whiteSpace = 'nowrap';
    div.style.borderRadius = '1px';
    document.body.appendChild(div);
    
    div.addEventListener('click', () => {
      const targetPosition = new THREE.Vector3(
        system.position_x,
        system.position_y,
        system.position_z + 20
      );
      animateCamera(targetPosition);
      showSystemInfo(system);
    });
    
    labels.push({
      element: div,
      position: new THREE.Vector3(system.position_x, system.position_y, system.position_z),
      system: system
    });
  });
}

// Route materials
const routeMaterials = {
  commercial: new THREE.LineBasicMaterial({
    color: 0x4a8f8f,
    transparent: true,
    opacity: 0.5
  }),
  military: new THREE.LineBasicMaterial({
    color: 0x8f4a4a,
    transparent: true,
    opacity: 0.5
  }),
  smuggling: new THREE.LineBasicMaterial({
    color: 0x8f8f4a,
    transparent: true,
    opacity: 0.5
  })
};

// Create route toggles
const routeGroups = {
  commercial: new THREE.Group(),
  military: new THREE.Group(),
  smuggling: new THREE.Group()
};

// Add route groups to scene
Object.values(routeGroups).forEach(group => {
  scene.add(group);
});

let currentRoute = null;
let selectedFromSystem = null;
let selectedToSystem = null;

// Create affiliation filters
const uniqueAffiliations = [...new Set(systems.map(s => s.affiliation?.[0]?.code))].filter(Boolean);
uniqueAffiliations.forEach(affiliation => {
  const btn = document.createElement('button');
  btn.className = 'toggle-btn';
  btn.textContent = affiliation;
  const system = systems.find(s => s.affiliation?.[0]?.code === affiliation);
  if (system?.affiliation?.[0]?.color) {
    btn.style.borderColor = system.affiliation[0].color;
  }
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const isActive = btn.classList.contains('active');
    const stars = scene.children.filter(obj => 
      obj instanceof THREE.Mesh && 
      obj.userData.system?.affiliation?.[0]?.code === affiliation
    );
    stars.forEach(star => {
      star.visible = isActive;
      // Find and update the corresponding label
      const label = labels.find(l => l.system.id === star.userData.system.id);
      if (label) {
        label.element.style.display = isActive && labelsVisible ? 'block' : 'none';
      }
    });
  });
  btn.classList.add('active'); // Start with all filters active
  filterContainer.appendChild(btn);
});

// Create routes function
function createRoutes() {
  if (starmapData.data.routes) {
    starmapData.data.routes.forEach(route => {
      if (route.start_system_id && route.end_system_id) {
        const startSystem = systems.find(s => s.id === route.start_system_id);
        const endSystem = systems.find(s => s.id === route.end_system_id);
        
        if (startSystem && endSystem) {
          const points = [];
          points.push(new THREE.Vector3(startSystem.position_x, startSystem.position_y, startSystem.position_z));
          points.push(new THREE.Vector3(endSystem.position_x, endSystem.position_y, endSystem.position_z));
          
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const routeType = route.type || 'commercial';
          const line = new THREE.Line(geometry, routeMaterials[routeType]);
          routeGroups[routeType].add(line);
        }
      }
    });
  }
}

// Raycaster setup
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Click handler
function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children);
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    if (object.userData.system) {
      showSystemInfo(object.userData.system);
      const targetPosition = new THREE.Vector3(
        object.position.x,
        object.position.y,
        object.position.z + 20
      );
      animateCamera(targetPosition);
    }
  }
}

// System info display
function showSystemInfo(system) {
  systemInfo.style.display = 'block';
  document.getElementById('systemName').textContent = system.name;
  document.getElementById('systemCode').textContent = `Code: ${system.code}`;
  
  const affiliation = system.affiliation?.[0];
  document.getElementById('systemAffiliation').textContent = 
    `Affiliation: ${affiliation?.name || 'Independent'}`;
  
  // Update system logo
  const systemLogo = document.getElementById('systemLogo');
  if (affiliation?.code) {
    const logoPath = `/images/${affiliation.code}.png`;
    systemLogo.style.backgroundImage = `url(${logoPath})`;
    systemLogo.style.display = 'block';
  } else {
    systemLogo.style.backgroundImage = 'url(/images/NONE.png)';
  }
  
  document.getElementById('systemDescription').textContent = system.description;
  document.getElementById('systemPopulation').textContent = system.aggregated_population;
  document.getElementById('systemEconomy').textContent = system.aggregated_economy;
  document.getElementById('systemDanger').textContent = system.aggregated_danger;
}

// Camera animation
function animateCamera(targetPosition) {
  const start = camera.position.clone();
  const end = targetPosition;
  const duration = 1000;
  const startTime = performance.now();

  function update() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const eased = 1 - Math.pow(1 - progress, 3);
    
    camera.position.lerpVectors(start, end, eased);
    controls.target.lerpVectors(
      new THREE.Vector3(),
      new THREE.Vector3(end.x, end.y, end.z - 20),
      eased
    );
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  update();
}

// Search functionality
function setupSearch() {
  const systemsList = systems.map(system => ({
    name: system.name,
    code: system.code,
    position: new THREE.Vector3(system.position_x, system.position_y, system.position_z),
    system: system
  }));

  searchInput.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase();
    if (!value) {
      searchResults.style.display = 'none';
      return;
    }

    const matches = systemsList.filter(system => 
      system.name.toLowerCase().includes(value) || 
      system.code.toLowerCase().includes(value)
    ).slice(0, 5);

    searchResults.innerHTML = '';
    matches.forEach(match => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = `${match.name} (${match.code})`;
      div.addEventListener('click', () => {
        const targetPosition = new THREE.Vector3(
          match.position.x,
          match.position.y,
          match.position.z + 20
        );
        animateCamera(targetPosition);
        showSystemInfo(match.system);
        searchResults.style.display = 'none';
        searchInput.value = '';
      });
      searchResults.appendChild(div);
    });

    searchResults.style.display = matches.length ? 'block' : 'none';
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.style.display = 'none';
    }
  });
}

setupSearch();

// Event listeners
window.addEventListener('click', onClick);
resetViewBtn.addEventListener('click', () => {
  animateCamera(new THREE.Vector3(0, 0, 100));
  systemInfo.style.display = 'none';
});

toggleLabelsBtn.addEventListener('click', () => {
  labelsVisible = !labelsVisible;
  labels.forEach(label => {
    label.element.style.display = labelsVisible ? 'block' : 'none';
  });
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  
  // Update background
  if (backgroundSystem) {
    backgroundSystem.update();
  }
  
  // Make stars always face the camera (billboard effect)
  scene.traverse(object => {
    if (object instanceof THREE.Mesh && object.userData.initialQuaternion) {
      const lookAtPosition = camera.position.clone();
      object.lookAt(lookAtPosition);
      // Preserve the up direction
      const rotation = object.rotation.clone();
      object.quaternion.copy(object.userData.initialQuaternion);
      object.rotateY(rotation.y);
      object.rotateX(rotation.x);
    }
  });
  
  // Update labels
  if (labelsVisible) {
    updateLabels();
  }
  
  renderer.render(scene, camera);
  minimapRenderer.render(scene, minimapCamera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add route search functionality
function setupRouteSearch(input, resultsContainer, onSelect) {
  input.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase();
    if (!value) {
      resultsContainer.style.display = 'none';
      return;
    }

    const matches = systems.filter(system => 
      system.name.toLowerCase().includes(value) || 
      system.code.toLowerCase().includes(value)
    ).slice(0, 5);

    resultsContainer.innerHTML = '';
    matches.forEach(match => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = `${match.name} (${match.code})`;
      div.addEventListener('click', () => {
        input.value = match.name;
        resultsContainer.style.display = 'none';
        onSelect(match);
      });
      resultsContainer.appendChild(div);
    });

    resultsContainer.style.display = matches.length ? 'block' : 'none';
  });

  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!resultsContainer.contains(e.target) && e.target !== input) {
      resultsContainer.style.display = 'none';
    }
  });
}

// Setup route search handlers
setupRouteSearch(routeFrom, routeFromResults, (system) => {
  selectedFromSystem = system;
  if (selectedToSystem) {
    calculateRouteBtn.disabled = false;
  }
});

setupRouteSearch(routeTo, routeToResults, (system) => {
  selectedToSystem = system;
  if (selectedFromSystem) {
    calculateRouteBtn.disabled = false;
  }
});

// Route system with waypoints
class RouteSystem {
  constructor() {
    this.routes = new Map();
    this.waypoints = new Map();
    this.pathfinder = new THREE.Group();
    scene.add(this.pathfinder);
  }

  addWaypoint(position, type = 'standard') {
    const key = `${position.x},${position.y},${position.z}`;
    if (!this.waypoints.has(key)) {
      this.waypoints.set(key, {
        position: position.clone(),
        type,
        connections: new Set()
      });
    }
    return this.waypoints.get(key);
  }

  connectWaypoints(wp1, wp2, type = 'standard') {
    wp1.connections.add(wp2);
    wp2.connections.add(wp1);
    
    const geometry = new THREE.BufferGeometry().setFromPoints([
      wp1.position,
      wp2.position
    ]);
    
    const material = routeMaterials[type] || routeMaterials.commercial;
    const line = new THREE.Line(geometry, material);
    this.pathfinder.add(line);
  }

  findPath(start, end, shipSize) {
    // A* pathfinding implementation
    const openSet = new Set([start]);
    const closedSet = new Set();
    const cameFrom = new Map();
    
    const gScore = new Map();
    gScore.set(start, 0);
    
    const fScore = new Map();
    fScore.set(start, this.heuristic(start, end));
    
    while (openSet.size > 0) {
      const current = this.getLowestFScore(openSet, fScore);
      
      if (current === end) {
        return this.reconstructPath(cameFrom, current);
      }
      
      openSet.delete(current);
      closedSet.add(current);
      
      for (const neighbor of current.connections) {
        if (closedSet.has(neighbor)) continue;
        
        const tentativeGScore = gScore.get(current) + 
          this.getDistance(current, neighbor, shipSize);
        
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        } else if (tentativeGScore >= gScore.get(neighbor)) {
          continue;
        }
        
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);
        fScore.set(neighbor, gScore.get(neighbor) + this.heuristic(neighbor, end));
      }
    }
    
    return null; // No path found
  }

  heuristic(a, b) {
    return a.position.distanceTo(b.position);
  }

  getLowestFScore(set, scores) {
    let lowest = null;
    let lowestScore = Infinity;
    
    for (const item of set) {
      const score = scores.get(item);
      if (score < lowestScore) {
        lowest = item;
        lowestScore = score;
      }
    }
    
    return lowest;
  }

  getDistance(a, b, shipSize) {
    const distance = a.position.distanceTo(b.position);
    const sizeFactor = {
      small: 1,
      medium: 1.2,
      large: 1.5
    }[shipSize] || 1;
    
    return distance * sizeFactor;
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current);
      path.unshift(current);
    }
    return path;
  }

  createRoute(fromSystem, toSystem, shipSize) {
    // Remove previous route if exists
    if (currentRoute) {
      scene.remove(currentRoute);
    }
    
    // Create waypoints for start and end
    const startWP = this.addWaypoint(
      new THREE.Vector3(fromSystem.position_x, fromSystem.position_y, fromSystem.position_z)
    );
    const endWP = this.addWaypoint(
      new THREE.Vector3(toSystem.position_x, toSystem.position_y, toSystem.position_z)
    );
    
    // Find path between waypoints
    const path = this.findPath(startWP, endWP, shipSize);
    if (!path) return null;
    
    // Create curved route through waypoints
    const points = [];
    for (let i = 0; i < path.length; i++) {
      points.push(path[i].position);
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    
    const routeColors = {
      small: 0x4a8f8f,
      medium: 0x8f4a4a,
      large: 0x8f8f4a
    };
    
    const material = new THREE.LineBasicMaterial({
      color: routeColors[shipSize],
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });

    currentRoute = new THREE.Line(geometry, material);
    scene.add(currentRoute);
    
    return {
      distance: this.calculateRouteDistance(points),
      path: points
    };
  }

  calculateRouteDistance(points) {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      distance += points[i].distanceTo(points[i - 1]);
    }
    return distance;
  }
}

// Initialize route system
const routeSystem = new RouteSystem();

// Update route calculation to use new system
function calculateRoute(fromSystem, toSystem, shipSize) {
  const result = routeSystem.createRoute(fromSystem, toSystem, shipSize);
  if (result) {
    showRouteInfo(fromSystem, toSystem, result.distance, shipSize);
  }
}

// Create initial waypoints from routes data
if (starmapData.data.routes) {
  starmapData.data.routes.forEach(route => {
    if (route.start_system_id && route.end_system_id) {
      const startSystem = systems.find(s => s.id === route.start_system_id);
      const endSystem = systems.find(s => s.id === route.end_system_id);
      
      if (startSystem && endSystem) {
        const startWP = routeSystem.addWaypoint(
          new THREE.Vector3(startSystem.position_x, startSystem.position_y, startSystem.position_z)
        );
        const endWP = routeSystem.addWaypoint(
          new THREE.Vector3(endSystem.position_x, endSystem.position_y, endSystem.position_z)
        );
        routeSystem.connectWaypoints(startWP, endWP, route.type || 'commercial');
      }
    }
  });
}

// Add route calculation event listener
calculateRouteBtn.addEventListener('click', () => {
  if (selectedFromSystem && selectedToSystem) {
    calculateRoute(selectedFromSystem, selectedToSystem, shipSizeSelect.value);
  }
});

// Add route toggle functionality
toggleRoutesBtn.addEventListener('click', () => {
  toggleRoutesBtn.classList.toggle('active');
  Object.values(routeGroups).forEach(group => {
    group.visible = toggleRoutesBtn.classList.contains('active');
  });
  if (currentRoute) {
    currentRoute.visible = toggleRoutesBtn.classList.contains('active');
  }
});

// Resource caching system
const ResourceCache = {
  textures: new Map(),
  materials: new Map(),
  geometries: new Map(),

  loadTexture(url) {
    if (this.textures.has(url)) {
      return Promise.resolve(this.textures.get(url));
    }
    
    return new Promise((resolve, reject) => {
      textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this.textures.set(url, texture);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  },

  async loadAffiliationTextures() {
    const affiliations = ['BANU', 'DEV', 'NONE', 'UNC', 'VNCL', 'XIAN'];
    const texturePromises = affiliations.map(code => 
      this.loadTexture(`/images/${code}.png`)
        .then(texture => [code, texture])
    );
    
    const results = await Promise.all(texturePromises);
    results.forEach(([code, texture]) => {
      logoMaterials[code] = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
    });
  },

  async loadSystemTextures() {
    const texturePromises = Array.from({length: 9}, (_, i) => 
      this.loadTexture(`/images/${String(i + 1).padStart(2, '0')}_Texture.jpg`)
        .then(texture => [i + 1, texture])
    );
    
    const results = await Promise.all(texturePromises);
    results.forEach(([id, texture]) => {
      systemTextures[id] = texture;
    });
  },

  getGeometry(key, createFn) {
    if (!this.geometries.has(key)) {
      this.geometries.set(key, createFn());
    }
    return this.geometries.get(key);
  }
};

// Background system
class BackgroundSystem {
  constructor(scene) {
    this.scene = scene;
  }

  async initialize() {
    console.log('Initializing background system...');
    
    const loader = new THREE.CubeTextureLoader();
    const texture = await new Promise((resolve) => {
      loader.load([
        '/images/DarkMatter.png',  // right
        '/images/DarkMatter.png',  // left
        '/images/DarkMatter.png',  // top
        '/images/DarkMatter.png',  // bottom
        '/images/DarkMatter.png',  // front
        '/images/DarkMatter.png'   // back
      ], resolve);
    });

    this.scene.background = texture;
    console.log('Background setup complete');
  }

  update() {
    // No update needed for skybox
  }
}

// Update labels function
function updateLabels() {
  labels.forEach(label => {
    const position = label.position.clone();
    position.project(camera);
    
    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;
    
    const distance = camera.position.distanceTo(label.position);
    const scale = Math.max(0.5, 2 - distance / 50);
    
    if (position.z < 1 && distance < 150) {
      label.element.style.display = 'block';
      // Position le label avec un espace minimal (2px)
      label.element.style.left = `${x - 2}px`;
      label.element.style.top = `${y}px`;
      label.element.style.transform = `translate(-100%, -50%) scale(${scale})`;
      label.element.style.opacity = Math.max(0.2, 1 - distance / 150);
      label.element.style.zIndex = Math.floor((1 - position.z) * 100000);
    } else {
      label.element.style.display = 'none';
    }
  });
}

// Setup all event handlers
function setupEventHandlers() {
  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Click handler
  window.addEventListener('click', onClick);

  // Reset view button
  resetViewBtn.addEventListener('click', () => {
    animateCamera(new THREE.Vector3(0, 0, 100));
    systemInfo.style.display = 'none';
  });

  // Toggle labels button
  toggleLabelsBtn.addEventListener('click', () => {
    labelsVisible = !labelsVisible;
    labels.forEach(label => {
      label.element.style.display = labelsVisible ? 'block' : 'none';
    });
  });

  // Route toggle button
  toggleRoutesBtn.addEventListener('click', () => {
    toggleRoutesBtn.classList.toggle('active');
    Object.values(routeGroups).forEach(group => {
      group.visible = toggleRoutesBtn.classList.contains('active');
    });
    if (currentRoute) {
      currentRoute.visible = toggleRoutesBtn.classList.contains('active');
    }
  });

  // Calculate route button
  calculateRouteBtn.addEventListener('click', () => {
    if (selectedFromSystem && selectedToSystem) {
      calculateRoute(selectedFromSystem, selectedToSystem, shipSizeSelect.value);
    }
  });

  // Setup search functionality
  setupSearch();

  // Setup route search
  setupRouteSearch(routeFrom, routeFromResults, (system) => {
    selectedFromSystem = system;
    if (selectedToSystem) {
      calculateRouteBtn.disabled = false;
    }
  });

  setupRouteSearch(routeTo, routeToResults, (system) => {
    selectedToSystem = system;
    if (selectedFromSystem) {
      calculateRouteBtn.disabled = false;
    }
  });
}

// Initialize application
async function initializeApp() {
  try {
    console.log('Starting application initialization...');
    
    // Create and initialize background system
    console.log('Creating background system...');
    backgroundSystem = new BackgroundSystem(scene);
    console.log('Initializing background system...');
    await backgroundSystem.initialize();
    console.log('Background system initialized');

    // Load resources
    console.log('Loading resources...');
    await Promise.all([
      ResourceCache.loadAffiliationTextures(),
      ResourceCache.loadSystemTextures()
    ]);
    console.log('Resources loaded');

    // Create scene elements
    console.log('Creating scene elements...');
    createStarSystems();
    createRoutes();
    setupEventHandlers();
    console.log('Scene elements created');

    // Start animation loop
    console.log('Starting animation loop...');
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      
      // Update background
      if (backgroundSystem) {
        backgroundSystem.update();
      }
      
      // Update labels
      if (labelsVisible) {
        updateLabels();
      }
      
      renderer.render(scene, camera);
      minimapRenderer.render(scene, minimapCamera);
    }
    
    animate();
    console.log('Animation loop started');
  } catch (error) {
    console.error('Error initializing application:', error);
  }
}

// Start the application
initializeApp(); 