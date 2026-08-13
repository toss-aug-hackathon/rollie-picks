import * as THREE from 'three';

export interface CourseParams {
  width: number;
  courseHeight: number;
  startLineY: number;
  floorY: number;
  wallZ: number;
  activeTheme: string;
  screenToWorldY: (screenY: number) => number;
}

export function createCourse({ width, courseHeight, startLineY, floorY, wallZ, activeTheme, screenToWorldY }: CourseParams) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = courseHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create map canvas context');
  }

  const colors = {
    skyTop: '#8edfeb',
    skyBottom: '#d8f3e6',
    mountainFar: '#91ced2',
    mountainMid: '#69b7b2',
    mountainNear: '#4b9e82',
    snow: '#f5fbf6',
    grassFar: '#91c96d',
    grass: '#75b85e',
    grassLight: '#a9d975',
    grassDark: '#4e9560',
    roadEdge: '#d9b965',
    road: '#f5db78',
    roadHighlight: '#fff1ad',
    riverEdge: '#388fb5',
    river: '#53b9d8',
    riverHighlight: '#a7e8ef',
    treeTrunk: '#7a5a40',
    tree: '#4f9b5a',
    treeDark: '#3d8347',
    treeLight: '#73c37e',
    rock: '#9ba5a0',
    rockLight: '#c2ccc7',
    flowerYellow: '#ffd859',
    flowerPink: '#ff9ebb',
    flowerWhite: '#ffffff',
    text: '#315444'
  };

  let seed = 73129;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const range = (min: number, max: number) => min + (max - min) * random();

  const skyGradient = ctx.createLinearGradient(0, 0, 0, courseHeight);
  skyGradient.addColorStop(0, colors.skyTop);
  skyGradient.addColorStop(0.32, colors.skyBottom);
  skyGradient.addColorStop(1, colors.grassLight);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, courseHeight);

  const drawCloud = (x: number, y: number, scale = 1, alpha = 0.85) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 28 * scale, y + 10 * scale, 43 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f9ffff';
    ctx.beginPath();
    ctx.arc(x, y, 15 * scale, Math.PI, 0);
    ctx.arc(x + 19 * scale, y - 9 * scale, 22 * scale, Math.PI, 0);
    ctx.arc(x + 43 * scale, y, 16 * scale, Math.PI, 0);
    ctx.lineTo(x + 43 * scale, y + 10 * scale);
    ctx.lineTo(x, y + 10 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawMountain = ({ x, baseY, width, height, color, alpha = 1, snow = false }: { x: number; baseY: number; width: number; height: number; color: string; alpha?: number; snow?: boolean; }) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - width, baseY);
    ctx.quadraticCurveTo(x - width * 0.45, baseY - height * 0.45, x, baseY - height);
    ctx.quadraticCurveTo(x + width * 0.45, baseY - height * 0.38, x + width, baseY);
    ctx.closePath();
    ctx.fill();

    if (snow) {
      ctx.fillStyle = colors.snow;
      ctx.beginPath();
      ctx.moveTo(x - width * 0.2, baseY - height * 0.72);
      ctx.lineTo(x, baseY - height);
      ctx.lineTo(x + width * 0.21, baseY - height * 0.71);
      ctx.lineTo(x + width * 0.1, baseY - height * 0.63);
      ctx.lineTo(x, baseY - height * 0.68);
      ctx.lineTo(x - width * 0.09, baseY - height * 0.61);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  const drawHill = (y: number, color: string, amplitude: number, phase: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, courseHeight);
    ctx.lineTo(0, y);
    for (let x = 0; x <= width; x += 15) {
      const curveY = y + Math.sin(x / 55 + phase) * amplitude + Math.sin(x / 93 + phase * 1.7) * amplitude * 0.45;
      ctx.lineTo(x, curveY);
    }
    ctx.lineTo(width, courseHeight);
    ctx.closePath();
    ctx.fill();
  };

  const drawTree = (x: number, y: number, scale = 1, variation = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(variation * 0.025);
    ctx.fillStyle = colors.treeTrunk;
    ctx.beginPath();
    ctx.roundRect(-3.3 * scale, -1 * scale, 6.6 * scale, 28 * scale, 3 * scale);
    ctx.fill();

    ctx.fillStyle = colors.treeDark;
    ctx.beginPath();
    ctx.arc(-9 * scale, -15 * scale, 15 * scale, 0, Math.PI * 2);
    ctx.arc(9 * scale, -18 * scale, 16 * scale, 0, Math.PI * 2);
    ctx.arc(0, -34 * scale, 19 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.tree;
    ctx.beginPath();
    ctx.arc(-7 * scale, -18 * scale, 11 * scale, 0, Math.PI * 2);
    ctx.arc(8 * scale, -22 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.arc(1 * scale, -36 * scale, 13 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.treeLight;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(-2 * scale, -39 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawRock = (x: number, y: number, scale = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = colors.rock;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, 4 * scale);
    ctx.quadraticCurveTo(-9 * scale, -7 * scale, -2 * scale, -10 * scale);
    ctx.quadraticCurveTo(9 * scale, -11 * scale, 11 * scale, 3 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.rockLight;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(-2 * scale, -5 * scale, 4 * scale, 2.4 * scale, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawFlower = (x: number, y: number, scale: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 3 * scale, Math.sin(angle) * 3 * scale, 2.3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c95f';
    ctx.beginPath();
    ctx.arc(0, 0, 1.6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  [[18, 70, 0.75, 0.8], [250, 145, 0.7, 0.78], [92, 515, 0.55, 0.62], [285, 740, 0.6, 0.55], [30, 1060, 0.5, 0.45]].forEach(([x, y, scale, alpha]) => {
    drawCloud(x, y, scale, alpha);
  });

  drawMountain({ x: 55, baseY: 355, width: 125, height: 150, color: colors.mountainFar, alpha: 0.8, snow: true });
  drawMountain({ x: 265, baseY: 365, width: 155, height: 190, color: colors.mountainMid, alpha: 0.88, snow: true });
  drawMountain({ x: 110, baseY: 850, width: 150, height: 165, color: colors.mountainFar, alpha: 0.72 });
  drawMountain({ x: 320, baseY: 1160, width: 135, height: 170, color: colors.mountainMid, alpha: 0.72 });
  drawMountain({ x: 70, baseY: 1530, width: 120, height: 145, color: colors.mountainNear, alpha: 0.5 });

  drawHill(310, colors.grassFar, 22, 0.5);
  drawHill(455, colors.grass, 28, 1.4);
  drawHill(650, colors.grassLight, 24, 2.2);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = colors.grassDark;
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i += 1) {
    const x = range(0, width);
    const y = range(400, courseHeight);
    const length = range(3, 8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(-2, 2), y - length);
    ctx.stroke();
  }
  ctx.restore();

  const roadPath = () => {
    ctx.beginPath();
    ctx.moveTo(92, 300);
    ctx.bezierCurveTo(18, 560, 205, 760, 92, 1030);
    ctx.bezierCurveTo(14, 1240, 190, 1440, 118, 1730);
    ctx.bezierCurveTo(36, 1980, 196, 2310, 88, courseHeight + 20);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = colors.roadEdge;
  ctx.lineWidth = 46;
  roadPath();
  ctx.stroke();

  ctx.strokeStyle = colors.road;
  ctx.lineWidth = 36;
  roadPath();
  ctx.stroke();

  ctx.strokeStyle = colors.roadHighlight;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 6;
  roadPath();
  ctx.stroke();
  ctx.restore();

  const riverPath = () => {
    ctx.beginPath();
    ctx.moveTo(330, 270);
    ctx.bezierCurveTo(245, 560, 355, 810, 260, 1090);
    ctx.bezierCurveTo(200, 1310, 305, 1480, 220, 1740);
    ctx.bezierCurveTo(160, 2010, 315, 2320, 245, courseHeight + 20);
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = colors.riverEdge;
  ctx.lineWidth = 62;
  riverPath();
  ctx.stroke();

  ctx.strokeStyle = colors.river;
  ctx.lineWidth = 52;
  riverPath();
  ctx.stroke();

  ctx.strokeStyle = colors.riverHighlight;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 8;
  riverPath();
  ctx.stroke();
  ctx.restore();

  const treeRows = [430, 610, 815, 1020, 1260, 1460, 1680, 1890, 2100, 2300, 2530, 2710];
  treeRows.forEach((baseY, rowIndex) => {
    const positions = rowIndex % 2 === 0 ? [22, 65, 337, 378] : [12, 52, 350];
    positions.forEach((baseX, index) => {
      const x = baseX + range(-11, 11);
      const y = baseY + range(-30, 30);
      const scale = range(0.58, 0.9);
      drawTree(x, y, scale, index * 3 + rowIndex);
    });
  });

  for (let i = 0; i < 48; i += 1) {
    const x = range(14, width - 14);
    const y = range(380, courseHeight - 40);
    drawRock(x, y, range(0.6, 1.2));
  }

  for (let i = 0; i < 90; i += 1) {
    const x = range(10, width - 10);
    const y = range(360, courseHeight - 20);
    const color = [colors.flowerYellow, colors.flowerPink, colors.flowerWhite][i % 3];
    drawFlower(x, y, range(0.7, 1.35), color);
  }

  // Finish Gate & Start Line
  const finishY = screenToWorldY(courseHeight - 120);
  const startY = screenToWorldY(startLineY);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e07653';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(width / 2 - 110, startLineY - 26, 220, 42, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = '900 18px "Noto Sans KR", Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏁 데굴이 출발선', width / 2, startLineY - 4);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const aspect = width / courseHeight;
  const planeHeight = Math.abs(screenToWorldY(courseHeight) - screenToWorldY(0));
  const planeWidth = planeHeight * aspect;

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, screenToWorldY(courseHeight / 2), floorY);

  return { mesh, planeWidth, planeHeight, startY, finishY };
}

export function createMountainsMesh(width: number, courseHeight: number, floorY: number, activeTheme: string, screenToWorldY: (screenY: number) => number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = courseHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const isNight = activeTheme === 'night';
  const colors = isNight
    ? { skyTop: '#090e1a', skyBottom: '#111a34', mountainFar: '#1a294b', mountainMid: '#243761', mountainNear: '#1d2c4e', snow: '#8ba2d4' }
    : { skyTop: '#7ecedb', skyBottom: '#caedd9', mountainFar: '#81c0c4', mountainMid: '#5ba9a4', mountainNear: '#3f9076', snow: '#f0f9f1' };

  const skyGradient = ctx.createLinearGradient(0, 0, 0, courseHeight);
  skyGradient.addColorStop(0, colors.skyTop);
  skyGradient.addColorStop(0.4, colors.skyBottom);
  skyGradient.addColorStop(1, isNight ? '#0b1429' : '#95d179');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, courseHeight);

  const drawMtn = (x: number, baseY: number, w: number, h: number, color: string, snow = false) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w, baseY);
    ctx.quadraticCurveTo(x - w * 0.45, baseY - h * 0.45, x, baseY - h);
    ctx.quadraticCurveTo(x + w * 0.45, baseY - h * 0.38, x + w, baseY);
    ctx.closePath();
    ctx.fill();

    if (snow) {
      ctx.fillStyle = colors.snow;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.2, baseY - h * 0.72);
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x + w * 0.21, baseY - h * 0.71);
      ctx.lineTo(x + w * 0.1, baseY - h * 0.63);
      ctx.lineTo(x, baseY - h * 0.68);
      ctx.lineTo(x - w * 0.09, baseY - h * 0.61);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  drawMtn(60, 320, 140, 170, colors.mountainFar, true);
  drawMtn(270, 340, 160, 200, colors.mountainMid, true);
  drawMtn(120, 780, 170, 180, colors.mountainFar);
  drawMtn(310, 1100, 150, 190, colors.mountainMid);
  drawMtn(80, 1480, 130, 160, colors.mountainNear);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const aspect = width / courseHeight;
  const planeHeight = Math.abs(screenToWorldY(courseHeight) - screenToWorldY(0));
  const planeWidth = planeHeight * aspect;

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, screenToWorldY(courseHeight / 2), floorY - 0.05);

  return mesh;
}
