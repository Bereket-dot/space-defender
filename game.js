let scene, camera, renderer;
let player;
let buildings = [];
let enemies = [];
let playerProjectiles = [];
let score = 0;
let health = 100;
let gameActive = false;
let keys = {};
let clock = new THREE.Clock();

let playerVelocity = new THREE.Vector3();
let playerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
const rotationSpeed = 0.015;
const moveSpeed = 0.04;
const friction = 0.92;
const maxSpeed = 0.35;
const boostMultiplier = 2.0;
let isBoosting = false;
let boostCooldown = 0;
let boostDuration = 0;

const playerRadius = 1.5;
let collisionCooldown = 0;

const citySize = 200;
const buildingCount = 200;
const boundarySize = citySize + 20;

let boundaryWalls = [];

let enemyBase;
let baseHealth = 100;

let missionProgress = 0;

let gamePaused = false;
let initialEnemiesCount = 0;
let shieldActive = false;
let shieldDuration = 0;
let shieldObject = null;

let bgMusic = document.getElementById('bgMusic');
let isMuted = false;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 20);
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('gameCanvas'),
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const ambientLight = new THREE.AmbientLight(0x222244, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x00ffff, 1.2);
    directionalLight.position.set(5, 20, -15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xff00ff, 0.8);
    backLight.position.set(-5, 10, 15);
    scene.add(backLight);
    
    const cityLight = new THREE.PointLight(0x7700ff, 0.5, 300);
    cityLight.position.set(0, 50, 0);
    scene.add(cityLight);
    
    createPlayer();
    generateEnvironment();
    createBoundaryWalls();
    createEnemyBase();
    createShieldPowerUp();
    
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keydown', onShoot);
    
    document.getElementById('startButton').addEventListener('click', startGame);
    document.getElementById('restartButton').addEventListener('click', startGame);
    document.getElementById('victoryRestartButton').addEventListener('click', startGame);
    document.getElementById('pauseButton').addEventListener('click', togglePause);
    document.getElementById('resumeButton').addEventListener('click', togglePause);
    
    document.getElementById('audioControl').addEventListener('click', toggleMute);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'h' || e.key === 'H') {
            const controls = document.getElementById('controlsInfo');
            controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
        }
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
        if (e.key === 'm' || e.key === 'M') {
            toggleMute();
        }
    });
    
    muteMusic();
    
    animate();
}

function toggleMute() {
    isMuted = !isMuted;
    bgMusic.muted = isMuted;
    updateAudioIcon();
}

function updateAudioIcon() {
    const icon = document.querySelector('#audioControl i');
    if (isMuted) {
        icon.className = 'fas fa-volume-mute';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function muteMusic() {
    bgMusic.muted = true;
    isMuted = true;
    updateAudioIcon();
}

function playMusic() {
    bgMusic.play().catch(e => console.log("Audio play failed:", e));
    updateAudioIcon();
}

function pauseMusic() {
    bgMusic.pause();
    updateAudioIcon();
}

function createBoundaryWalls() {
    const wallThickness = 5;
    const wallHeight = 100;
    const halfCity = boundarySize / 2;
    
    const wallMaterials = [
        new THREE.MeshPhongMaterial({ color: 0xff0055, transparent: true, opacity: 0.4 }),
        new THREE.MeshPhongMaterial({ color: 0xff0055, transparent: true, opacity: 0.4 }),
        new THREE.MeshPhongMaterial({ color: 0xff0055, transparent: true, opacity: 0.4 }),
        new THREE.MeshPhongMaterial({ color: 0xff0055, transparent: true, opacity: 0.4 })
    ];
    
    const wallGeometries = [
        new THREE.BoxGeometry(boundarySize + wallThickness*2, wallHeight, wallThickness),
        new THREE.BoxGeometry(boundarySize + wallThickness*2, wallHeight, wallThickness),
        new THREE.BoxGeometry(wallThickness, wallHeight, boundarySize),
        new THREE.BoxGeometry(wallThickness, wallHeight, boundarySize)
    ];
    
    const wallPositions = [
        new THREE.Vector3(0, wallHeight/2 - 10, halfCity + wallThickness/2),
        new THREE.Vector3(0, wallHeight/2 - 10, -halfCity - wallThickness/2),
        new THREE.Vector3(-halfCity - wallThickness/2, wallHeight/2 - 10, 0),
        new THREE.Vector3(halfCity + wallThickness/2, wallHeight/2 - 10, 0)
    ];
    
    for (let i = 0; i < 4; i++) {
        const wall = new THREE.Mesh(wallGeometries[i], wallMaterials[i]);
        wall.position.copy(wallPositions[i]);
        wall.userData.isBoundary = true;
        wall.userData.collisionSize = new THREE.Vector3(
            wallGeometries[i].parameters.width,
            wallGeometries[i].parameters.height,
            wallGeometries[i].parameters.depth
        );
        scene.add(wall);
        boundaryWalls.push(wall);
        
        const neonGeometry = new THREE.BoxGeometry(
            wallGeometries[i].parameters.width + 0.5, 
            0.5, 
            wallGeometries[i].parameters.depth + 0.5
        );
        const neonMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            emissive: 0x00ffff
        });
        const neon = new THREE.Mesh(neonGeometry, neonMaterial);
        neon.position.set(0, wallGeometries[i].parameters.height/2 - 0.5, 0);
        wall.add(neon);
    }
}

function createEnemyBase() {
    const baseGroup = new THREE.Group();
    
    const baseGeometry = new THREE.CylinderGeometry(15, 20, 30, 16);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xaa0000,
        emissive: 0x550000
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 15;
    baseGroup.add(base);
    
    const topGeometry = new THREE.CylinderGeometry(8, 10, 15, 16);
    const topMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x880000,
        emissive: 0x440000
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 37.5;
    baseGroup.add(top);
    
    const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        emissive: 0x111111
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, 55, 0);
    baseGroup.add(antenna);
    
    const coreGeometry = new THREE.SphereGeometry(5, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 15, 0);
    baseGroup.add(core);
    
    const coreGlow = new THREE.PointLight(0xff0000, 2, 30);
    core.position.set(0, 15, 0);
    baseGroup.add(coreGlow);
    
    baseGroup.position.set(0, -1, 0);
    scene.add(baseGroup);
    
    enemyBase = baseGroup;
    enemyBase.userData.collisionSize = new THREE.Vector3(20, 30, 20);
    enemyBase.userData.health = 100;
}

function createShieldPowerUp() {
    const shieldGeometry = new THREE.SphereGeometry(2, 16, 16);
    const shieldMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        transparent: true,
        opacity: 0.7
    });
    
    shieldObject = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shieldObject.visible = false;
    scene.add(shieldObject);
}

function spawnShield() {
    if (!gameActive || gamePaused) return;
    
    const halfCity = boundarySize / 2 - 20;
    const xPos = -halfCity + Math.random() * boundarySize;
    const zPos = -halfCity + Math.random() * boundarySize;
    
    shieldObject.position.set(xPos, 10, zPos);
    shieldObject.visible = true;
    
    const shieldGlow = new THREE.PointLight(0x00ffff, 2, 20);
    shieldObject.add(shieldGlow);
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('victoryScreen').style.display = 'none';
    document.getElementById('pauseOverlay').style.display = 'none';
    gameActive = true;
    gamePaused = false;
    score = 0;
    health = 100;
    baseHealth = 100;
    missionProgress = 0;
    shieldActive = false;
    shieldDuration = 0;
    player.position.set(0, 10, 0);
    player.rotation.set(0, 0, 0);
    playerVelocity.set(0, 0, 0);
    playerRotation.set(0, 0, 0);
    isBoosting = false;
    boostCooldown = 0;
    boostDuration = 0;
    updateScore();
    updateHealth();
    updateBaseHealth();
    updateMissionProgress();
    updateSpeedIndicator();
    updateEnemyCount();
    document.getElementById('powerUpIndicator').style.display = 'none';
    shieldObject.visible = false;
    
    for (const enemy of enemies) {
        scene.remove(enemy.group);
    }
    enemies = [];
    
    for (const projectile of playerProjectiles) {
        scene.remove(projectile);
    }
    playerProjectiles = [];
    
    initialEnemiesCount = 8;
    for (let i = 0; i < initialEnemiesCount; i++) {
        spawnEnemy();
    }
    
    playMusic();
    
    setTimeout(spawnShield, 15000);
}

function createPlayer() {
    const playerGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.CylinderGeometry(0.8, 0.6, 2, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x0088ff,
        emissive: 0x0055aa,
        shininess: 100
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    playerGroup.add(body);
    
    const cockpitGeometry = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff,
        emissive: 0x0088ff,
        shininess: 120,
        transparent: true,
        opacity: 0.7
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.2, 0.8);
    playerGroup.add(cockpit);
    
    const wingGeometry = new THREE.BoxGeometry(2, 0.1, 0.8);
    const wingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x0088ff,
        emissive: 0x0055aa
    });
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-1.1, 0, 0);
    playerGroup.add(leftWing);
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(1.1, 0, 0);
    playerGroup.add(rightWing);
    
    const engineGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 16);
    const engineMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        emissive: 0x222222
    });
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.position.set(0, 0, -0.8);
    engine.rotation.x = Math.PI / 2;
    playerGroup.add(engine);
    
    const engineGlow = new THREE.PointLight(0x00ffff, 2, 10);
    engineGlow.position.set(0, 0, -1.5);
    playerGroup.add(engineGlow);
    
    player = playerGroup;
    player.position.set(0, 10, 0);
    scene.add(player);
}

function generateEnvironment() {
    const groundGeometry = new THREE.PlaneGeometry(boundarySize, boundarySize, 50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222233,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    scene.add(ground);
    
    createRoadSystem();
    
    for (let i = 0; i < buildingCount; i++) {
        let width = 3 + Math.random() * 7;
        let depth = 3 + Math.random() * 7;
        let height = 15 + Math.random() * 35;
        const buildingGroup = new THREE.Group();
        
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x111122,
            shininess: 30
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.castShadow = true;
        building.receiveShadow = true;
        building.position.y = height/2;
        buildingGroup.add(building);
        
        buildingGroup.userData.collisionSize = new THREE.Vector3(width, height, depth);
        buildingGroup.userData.originalColor = new THREE.Color(0x111122);
        
        const neonColors = [0xff0055, 0x7700ff, 0x00ffcc, 0xffcc00, 0xff00ff];
        const color = neonColors[Math.floor(Math.random() * neonColors.length)];
        
        for (let j = 0; j < 6; j++) {
            const neonGeometry = new THREE.BoxGeometry(width + 0.1, 0.2, 0.1);
            const neonMaterial = new THREE.MeshBasicMaterial({ 
                color: color,
                emissive: color
            });
            const neon = new THREE.Mesh(neonGeometry, neonMaterial);
            neon.position.y = height - 2 - j * (height/6);
            neon.position.z = depth/2 + 0.05;
            buildingGroup.add(neon);
        }
        
        const halfCity = boundarySize / 2 - 15;
        let xPos = -halfCity + Math.random() * boundarySize;
        let zPos = -halfCity + Math.random() * boundarySize;
        
        const distToCenter = Math.sqrt(xPos*xPos + zPos*zPos);
        if (distToCenter < 30) {
            const angle = Math.atan2(zPos, xPos);
            xPos = Math.cos(angle) * 30;
            zPos = Math.sin(angle) * 30;
        }
        
        buildingGroup.position.set(xPos, -1, zPos);
        scene.add(buildingGroup);
        buildings.push(buildingGroup);
        
        if (Math.random() > 0.3) {
            const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, 7, 8);
            const antennaMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x888888,
                emissive: 0x444444
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.set(0, height + 3.5, 0);
            buildingGroup.add(antenna);
            
            const antennaTopGeometry = new THREE.SphereGeometry(0.4, 8, 8);
            const antennaTopMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                emissive: 0xff0000
            });
            const antennaTop = new THREE.Mesh(antennaTopGeometry, antennaTopMaterial);
            antennaTop.position.set(0, 3.5, 0);
            antenna.add(antennaTop);
        }
        
        if (Math.random() > 0.7) {
            createStreetLight(buildingGroup.position.x, buildingGroup.position.z);
        }
    }
    
    for (let i = 0; i < 20; i++) {
        const platformGeometry = new THREE.CylinderGeometry(5, 5, 0.5, 16);
        const platformMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x333355,
            emissive: 0x222244
        });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        
        platform.position.set(
            -boundarySize/2 + Math.random() * boundarySize,
            10 + Math.random() * 40,
            -boundarySize/2 + Math.random() * boundarySize
        );
        
        scene.add(platform);
        buildings.push(platform);
        platform.userData.collisionSize = new THREE.Vector3(10, 0.5, 10);
    }
    
    createAtmosphericParticles();
}

function createRoadSystem() {
    const roadWidth = 15;
    const roadSpacing = 40;
    const halfCity = boundarySize / 2;
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333344,
        roughness: 0.9,
        metalness: 0.1
    });
    
    for (let z = -halfCity; z <= halfCity; z += roadSpacing) {
        const roadGeometry = new THREE.PlaneGeometry(boundarySize, roadWidth);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, -1.9, z);
        scene.add(road);
        
        const markingGeometry = new THREE.BoxGeometry(1, 0.1, 0.5);
        const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        for (let x = -halfCity + 5; x < halfCity; x += 10) {
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.position.set(x, -1.85, z);
            scene.add(marking);
        }
    }
    
    for (let x = -halfCity; x <= halfCity; x += roadSpacing) {
        const roadGeometry = new THREE.PlaneGeometry(roadWidth, boundarySize);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, -1.9, 0);
        scene.add(road);
        
        const markingGeometry = new THREE.BoxGeometry(0.5, 0.1, 1);
        const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        for (let z = -halfCity + 5; z < halfCity; z += 10) {
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.position.set(x, -1.85, z);
            scene.add(marking);
        }
    }
}

function createStreetLight(x, z) {
    const lightGroup = new THREE.Group();
    
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
    const poleMaterial = new THREE.MeshPhongMaterial({ color: 0x555555 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(0, 4, 0);
    lightGroup.add(pole);
    
    const housingGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.3);
    const housingMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.set(0, 8, 0);
    lightGroup.add(housing);
    
    const light = new THREE.PointLight(0xffff99, 1.5, 15);
    light.position.set(0, 8, 0);
    lightGroup.add(light);
    
    const glowGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff99,
        emissive: 0xffff99,
        transparent: true,
        opacity: 0.7
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 8, -0.15);
    lightGroup.add(glow);
    
    lightGroup.position.set(
        x + (Math.random() - 0.5) * 15,
        -1,
        z + (Math.random() - 0.5) * 15
    );
    
    scene.add(lightGroup);
}

function createAtmosphericParticles() {
    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        positions[i3] = (Math.random() - 0.5) * boundarySize * 1.5;
        positions[i3 + 1] = Math.random() * 60 + 10;
        positions[i3 + 2] = (Math.random() - 0.5) * boundarySize * 1.5;
        
        colors[i3] = Math.random() > 0.5 ? 0.2 : 1.0;
        colors[i3 + 1] = Math.random() > 0.5 ? 0.2 : 1.0;
        colors[i3 + 2] = Math.random() > 0.5 ? 0.2 : 1.0;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.7
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
}

function spawnEnemy() {
    if (!gameActive || gamePaused) return;
    
    const enemyGroup = new THREE.Group();
    
    const geometry = new THREE.OctahedronGeometry(1.5);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xff0055,
        emissive: 0xff0055,
        shininess: 100
    });
    const enemyBody = new THREE.Mesh(geometry, material);
    enemyBody.castShadow = true;
    enemyGroup.add(enemyBody);
    
    const detailGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const detailMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x000000,
        emissive: 0x222222
    });
    const leftDetail = new THREE.Mesh(detailGeometry, detailMaterial);
    leftDetail.position.set(-1.2, 0, 0);
    enemyGroup.add(leftDetail);
    const rightDetail = new THREE.Mesh(detailGeometry, detailMaterial);
    rightDetail.position.set(1.2, 0, 0);
    enemyGroup.add(rightDetail);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 20;
    const xPos = player.position.x + Math.cos(angle) * distance;
    const yPos = player.position.y + (Math.random() - 0.5) * 10;
    const zPos = player.position.z + Math.sin(angle) * distance;
    
    enemyGroup.position.set(xPos, yPos, zPos);
    scene.add(enemyGroup);
    enemies.push({
        group: enemyGroup,
        health: 3
    });
}

function createPlayerProjectile() {
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff
    });
    const projectile = new THREE.Mesh(geometry, material);
    
    projectile.position.copy(player.position);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyEuler(player.rotation);
    
    projectile.userData.velocity = direction.multiplyScalar(0.5);
    
    scene.add(projectile);
    playerProjectiles.push(projectile);
}

function updatePlayer(delta) {
    if (boostCooldown > 0) {
        boostCooldown -= delta;
    }
    
    if (boostDuration > 0) {
        boostDuration -= delta;
    } else if (isBoosting) {
        isBoosting = false;
        boostCooldown = 5.0;
    }
    
    if (keys['ArrowLeft']) {
        playerRotation.y += rotationSpeed * delta * 60;
    }
    if (keys['ArrowRight']) {
        playerRotation.y -= rotationSpeed * delta * 60;
    }
    if (keys['ArrowUp']) {
        playerRotation.x += rotationSpeed * delta * 60;
    }
    if (keys['ArrowDown']) {
        playerRotation.x -= rotationSpeed * delta * 60;
    }
    if (keys['z'] || keys['Z']) {
        playerRotation.z += rotationSpeed * delta * 60;
    }
    if (keys['c'] || keys['C']) {
        playerRotation.z -= rotationSpeed * delta * 60;
    }
    
    playerRotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, playerRotation.x));
    playerRotation.z = Math.max(-Math.PI/4, Math.min(Math.PI/4, playerRotation.z));
    
    player.rotation.copy(playerRotation);
    
    const direction = new THREE.Vector3();
    const speedMultiplier = isBoosting ? boostMultiplier : 1;
    
    if (keys['w'] || keys['W']) {
        direction.z -= moveSpeed * speedMultiplier;
    }
    if (keys['s'] || keys['S']) {
        direction.z += moveSpeed * speedMultiplier;
    }
    if (keys['a'] || keys['A']) {
        direction.x -= moveSpeed * speedMultiplier;
    }
    if (keys['d'] || keys['D']) {
        direction.x += moveSpeed * speedMultiplier;
    }
    if (keys['q'] || keys['Q']) {
        direction.y += moveSpeed * speedMultiplier;
    }
    if (keys['e'] || keys['E']) {
        direction.y -= moveSpeed * speedMultiplier;
    }
    
    direction.applyEuler(playerRotation);
    
    playerVelocity.add(direction.multiplyScalar(delta * 60));
    
    playerVelocity.multiplyScalar(friction);
    
    if (playerVelocity.length() > maxSpeed * speedMultiplier) {
        playerVelocity.normalize().multiplyScalar(maxSpeed * speedMultiplier);
    }
    
    player.position.add(playerVelocity.clone().multiplyScalar(delta * 60));
    
    document.getElementById('velocityIndicator').textContent = 
        `VELOCITY: ${playerVelocity.length().toFixed(1)}`;
        
    document.getElementById('positionPanel').textContent = 
        `POSITION: [${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}]`;
    
    if (playerVelocity.length() < 0.1) {
        document.getElementById('speedWarning').style.opacity = 1;
    } else {
        document.getElementById('speedWarning').style.opacity = 0;
    }
    
    const arrow = document.getElementById('orientationArrow');
    arrow.style.transform = `translate(-50%, -50%) rotate(${playerRotation.z}rad)`;
    
    if (collisionCooldown > 0) {
        collisionCooldown -= delta;
    }
    
    updateSpeedIndicator();
    updateRadar();
}

function updateSpeedIndicator() {
    const speedPercent = Math.min(100, (playerVelocity.length() / maxSpeed) * 100);
    document.getElementById('speedIndicator').style.height = speedPercent + '%';
    
    if (isBoosting) {
        document.getElementById('speedIndicator').style.background = 'linear-gradient(to top, #ff5500, #ff9900)';
    } else if (speedPercent > 70) {
        document.getElementById('speedIndicator').style.background = 'linear-gradient(to top, #00ffaa, #00cc88)';
    } else {
        document.getElementById('speedIndicator').style.background = 'linear-gradient(to top, #00aaff, #0088ff)';
    }
}

function updateRadar() {
    const radar = document.getElementById('radar');
    radar.innerHTML = '<div class="radar-center"></div><div class="radar-sweep"></div>';
    
    const radarSize = 140;
    const radarRadius = radarSize / 2;
    const maxDistance = boundarySize / 2;
    
    enemies.forEach(enemy => {
        const dx = enemy.group.position.x - player.position.x;
        const dz = enemy.group.position.z - player.position.z;
        
        const distance = Math.sqrt(dx*dx + dz*dz);
        if (distance > maxDistance) return;
        
        const angle = Math.atan2(dz, dx) - player.rotation.y;
        
        const radarX = radarRadius + (dx / maxDistance) * radarRadius;
        const radarY = radarRadius + (dz / maxDistance) * radarRadius;
        
        if (radarX >= 0 && radarX <= radarSize && radarY >= 0 && radarY <= radarSize) {
            const dot = document.createElement('div');
            dot.className = 'enemy-dot';
            dot.style.left = radarX + 'px';
            dot.style.top = radarY + 'px';
            radar.appendChild(dot);
        }
    });
    
    const baseDot = document.createElement('div');
    baseDot.className = 'base-dot';
    baseDot.style.left = radarRadius + 'px';
    baseDot.style.top = radarRadius + 'px';
    radar.appendChild(baseDot);
}

function updateEnemyCount() {
    document.getElementById('enemyCount').textContent = `ENEMIES: ${enemies.length}/${initialEnemiesCount}`;
}

function updateEnemies(delta) {
    if (Math.random() < 0.01 && enemies.length < 15) {
        spawnEnemy();
    }
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        const direction = new THREE.Vector3();
        direction.subVectors(player.position, enemy.group.position).normalize();
        enemy.group.position.add(direction.multiplyScalar(0.03 * delta * 60));
        
        enemy.group.lookAt(player.position);
        
        if (player.position.distanceTo(enemy.group.position) < 3 && !shieldActive) {
            health -= 1 * delta * 60;
            updateHealth();
            
            if (health <= 0) {
                gameOver();
            }
        }
    }
    updateEnemyCount();
}

function updateProjectiles(delta) {
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const projectile = playerProjectiles[i];
        
        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(delta * 60));
        
        if (projectile.position.distanceTo(player.position) > 100) {
            scene.remove(projectile);
            playerProjectiles.splice(i, 1);
            continue;
        }
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (projectile.position.distanceTo(enemy.group.position) < 2) {
                scene.remove(enemy.group);
                enemies.splice(j, 1);
                score += 100;
                updateScore();
                
                scene.remove(projectile);
                playerProjectiles.splice(i, 1);
                break;
            }
        }
        
        if (enemyBase && projectile.position.distanceTo(enemyBase.position) < 20) {
            baseHealth -= 5;
            updateBaseHealth();
            missionProgress = 100 - baseHealth;
            updateMissionProgress();
            
            enemyBase.material.color.set(0xff5500);
            setTimeout(() => {
                if (enemyBase.material) {
                    enemyBase.material.color.set(0xaa0000);
                }
            }, 100);
            
            scene.remove(projectile);
            playerProjectiles.splice(i, 1);
            
            if (baseHealth <= 0) {
                victory();
            }
        }
    }
}

function updateShield(delta) {
    if (shieldActive) {
        shieldDuration -= delta;
        document.getElementById('powerUpIndicator').textContent = `SHIELD ACTIVE: ${Math.ceil(shieldDuration)}s`;
        
        if (shieldDuration <= 0) {
            shieldActive = false;
            document.getElementById('powerUpIndicator').style.display = 'none';
        }
    }
    
    if (shieldObject.visible) {
        shieldObject.rotation.y += delta;
        
        if (player.position.distanceTo(shieldObject.position) < 3) {
            shieldActive = true;
            shieldDuration = 10;
            shieldObject.visible = false;
            document.getElementById('powerUpIndicator').style.display = 'block';
            setTimeout(spawnShield, 20000);
        }
    }
}

function checkCollisions() {
    if (collisionCooldown > 0) return;
    
    const allCollidables = [...buildings, ...boundaryWalls];
    
    for (const object of allCollidables) {
        const objectPos = object.position;
        const size = object.userData.collisionSize;
        
        const dx = Math.abs(player.position.x - objectPos.x) - size.x/2;
        const dy = Math.abs(player.position.y - objectPos.y) - size.y/2;
        const dz = Math.abs(player.position.z - objectPos.z) - size.z/2;
        
        if (dx < playerRadius && dy < playerRadius && dz < playerRadius) {
            collisionCooldown = 0.5;
            
            if (object.material) {
                object.material.color.set(0xff5500);
                setTimeout(() => {
                    if (object.material) {
                        object.material.color.copy(object.userData.originalColor);
                    }
                }, 500);
            }
            
            const overlapX = (playerRadius + size.x/2) - Math.abs(player.position.x - objectPos.x);
            const overlapY = (playerRadius + size.y/2) - Math.abs(player.position.y - objectPos.y);
            const overlapZ = (playerRadius + size.z/2) - Math.abs(player.position.z - objectPos.z);
            
            if (overlapX < overlapY && overlapX < overlapZ) {
                if (player.position.x < objectPos.x) {
                    player.position.x -= overlapX;
                } else {
                    player.position.x += overlapX;
                }
                playerVelocity.x = 0;
            } else if (overlapY < overlapZ) {
                if (player.position.y < objectPos.y) {
                    player.position.y -= overlapY;
                } else {
                    player.position.y += overlapY;
                }
                playerVelocity.y = 0;
            } else {
                if (player.position.z < objectPos.z) {
                    player.position.z -= overlapZ;
                } else {
                    player.position.z += overlapZ;
                }
                playerVelocity.z = 0;
            }
            
            break;
        }
    }
    
    if (player.position.y < 5) {
        player.position.y = 5;
        playerVelocity.y = 0;
    }
}

function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateHealth() {
    document.getElementById('healthFill').style.width = health + '%';
    
    if (health <= 30) {
        document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #ff0000, #ff5555)';
    } else {
        document.getElementById('healthFill').style.background = 'linear-gradient(90deg, #ff0055, #ff2299)';
    }
    
    document.getElementById('damageEffect').style.opacity = (100 - health) / 150;
}

function updateBaseHealth() {
    document.getElementById('baseHealthFill').style.width = baseHealth + '%';
}

function updateMissionProgress() {
    document.getElementById('missionFill').style.width = missionProgress + '%';
}

function gameOver() {
    gameActive = false;
    pauseMusic();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function victory() {
    gameActive = false;
    pauseMusic();
    document.getElementById('victoryScore').textContent = score;
    document.getElementById('victoryScreen').style.display = 'flex';
}

function togglePause() {
    gamePaused = !gamePaused;
    document.getElementById('pauseOverlay').style.display = gamePaused ? 'flex' : 'none';
    
    if (gamePaused) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    
    if (gameActive && !gamePaused) {
        updatePlayer(delta);
        updateEnemies(delta);
        updateProjectiles(delta);
        updateShield(delta);
        checkCollisions();
        
        const cameraOffset = new THREE.Vector3(0, 3, 15);
        cameraOffset.applyEuler(player.rotation);
        camera.position.copy(player.position).add(cameraOffset);
        camera.lookAt(player.position);
        
        score += delta * 10;
        updateScore();
    }
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    keys[event.key] = true;
    
    if (event.key === ' ') {
        event.preventDefault();
    }
    
    if (event.key === 'Shift' && boostCooldown <= 0) {
        isBoosting = true;
        boostDuration = 2.0;
    }
}

function onKeyUp(event) {
    keys[event.key] = false;
}

function onShoot(event) {
    if ((event.key === ' ' || event.key === 'Spacebar') && gameActive && !gamePaused) {
        createPlayerProjectile();
        event.preventDefault();
    }
}

init();