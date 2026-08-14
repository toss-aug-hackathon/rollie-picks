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

const COURSE_TEXTURE_URLS = {
  day: [
    new URL('../assets/backgrounds/rolling-course-long-bleed-1350.webp', import.meta.url).href,
    new URL('../assets/backgrounds/course-snow-day.webp', import.meta.url).href,
    new URL('../assets/backgrounds/course-autumn-day.webp', import.meta.url).href,
  ],
  night: [
    new URL('../assets/backgrounds/course-classic-night.webp', import.meta.url).href,
    new URL('../assets/backgrounds/course-snow-night.webp', import.meta.url).href,
    new URL('../assets/backgrounds/course-autumn-night.webp', import.meta.url).href,
  ],
};
const FINISH_LINE_TEXTURE_URL = new URL('../assets/backgrounds/finish-line-wide.webp', import.meta.url).href;
const COURSE_TEXTURE_ASPECT_RATIO = 1350 / 5277;
const FINISH_LINE_ASPECT_RATIO = 1048 / 84;

export async function loadCourseTexture(theme: 'day' | 'night') {
  const candidates = COURSE_TEXTURE_URLS[theme];
  const textureUrl = candidates[Math.floor(Math.random() * candidates.length)];
  const texture = await new THREE.TextureLoader().loadAsync(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createCourse({ width, courseHeight, startLineY, floorY, wallZ, activeTheme, screenToWorldY }: CourseParams) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = courseHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create map canvas context');
  }

  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = width;
  nightCanvas.height = courseHeight;
  const nightCtx = nightCanvas.getContext('2d')!;

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

  const nightColors = {
    skyTop: '#090e1a',
    skyBottom: '#111a34',
    mountainFar: '#1a294b',
    mountainMid: '#243761',
    mountainNear: '#1d2c4e',
    snow: '#8ba2d4',
    grassFar: '#16233b',
    grass: '#1a2b46',
    grassLight: '#1f3454',
    grassDark: '#111d31',
    roadEdge: '#4d4633',
    road: '#7c6d48',
    roadHighlight: '#a9996d',
    riverEdge: '#1c3d5a',
    river: '#29547a',
    riverHighlight: '#4b82b0',
    treeTrunk: '#3b2f28',
    tree: '#254437',
    treeDark: '#1b3429',
    treeLight: '#355c4a',
    rock: '#4a535e',
    rockLight: '#6e7987',
    flowerYellow: '#99833f',
    flowerPink: '#8c5969',
    flowerWhite: '#99a3b5',
    text: '#d9efff'
  };

  let seed = 73129;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const range = (min: number, max: number) => min + (max - min) * random();

  const drawThemeMap = (targetCtx: CanvasRenderingContext2D, palette: typeof colors, isNight: boolean) => {
    const skyGradient = targetCtx.createLinearGradient(0, 0, 0, courseHeight);
    skyGradient.addColorStop(0, palette.skyTop);
    skyGradient.addColorStop(0.32, palette.skyBottom);
    skyGradient.addColorStop(1, palette.grassLight);

    targetCtx.fillStyle = skyGradient;
    targetCtx.fillRect(0, 0, width, courseHeight);

    const drawCloud = (x: number, y: number, scale = 1, alpha = 0.85) => {
      targetCtx.save();
      targetCtx.globalAlpha = isNight ? alpha * 0.45 : alpha;
      targetCtx.fillStyle = isNight ? 'rgba(180, 205, 240, 0.18)' : 'rgba(255, 255, 255, 0.28)';
      targetCtx.beginPath();
      targetCtx.ellipse(x + 28 * scale, y + 10 * scale, 43 * scale, 13 * scale, 0, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.fillStyle = isNight ? '#263859' : '#f9ffff';
      targetCtx.beginPath();
      targetCtx.arc(x, y, 15 * scale, Math.PI, 0);
      targetCtx.arc(x + 19 * scale, y - 9 * scale, 22 * scale, Math.PI, 0);
      targetCtx.arc(x + 43 * scale, y, 16 * scale, Math.PI, 0);
      targetCtx.lineTo(x + 43 * scale, y + 10 * scale);
      targetCtx.lineTo(x, y + 10 * scale);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.restore();
    };

    const drawMountain = ({ x, baseY, mtnWidth, height, color, alpha = 1, snow = false }: { x: number; baseY: number; mtnWidth: number; height: number; color: string; alpha?: number; snow?: boolean; }) => {
      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      targetCtx.fillStyle = color;
      targetCtx.beginPath();
      targetCtx.moveTo(x - mtnWidth, baseY);
      targetCtx.quadraticCurveTo(x - mtnWidth * 0.45, baseY - height * 0.45, x, baseY - height);
      targetCtx.quadraticCurveTo(x + mtnWidth * 0.45, baseY - height * 0.38, x + mtnWidth, baseY);
      targetCtx.closePath();
      targetCtx.fill();

      if (snow) {
        targetCtx.fillStyle = palette.snow;
        targetCtx.beginPath();
        targetCtx.moveTo(x - mtnWidth * 0.2, baseY - height * 0.72);
        targetCtx.lineTo(x, baseY - height);
        targetCtx.lineTo(x + mtnWidth * 0.21, baseY - height * 0.71);
        targetCtx.lineTo(x + mtnWidth * 0.1, baseY - height * 0.63);
        targetCtx.lineTo(x, baseY - height * 0.68);
        targetCtx.lineTo(x - mtnWidth * 0.09, baseY - height * 0.61);
        targetCtx.closePath();
        targetCtx.fill();
      }
      targetCtx.restore();
    };

    const drawHill = (y: number, color: string, amplitude: number, phase: number) => {
      targetCtx.fillStyle = color;
      targetCtx.beginPath();
      targetCtx.moveTo(0, courseHeight);
      targetCtx.lineTo(0, y);
      for (let x = 0; x <= width; x += 15) {
        const curveY = y + Math.sin(x / 55 + phase) * amplitude + Math.sin(x / 93 + phase * 1.7) * amplitude * 0.45;
        targetCtx.lineTo(x, curveY);
      }
      targetCtx.lineTo(width, courseHeight);
      targetCtx.closePath();
      targetCtx.fill();
    };

    const drawTree = (x: number, y: number, scale = 1, variation = 0) => {
      targetCtx.save();
      targetCtx.translate(x, y);
      targetCtx.rotate(variation * 0.025);
      targetCtx.fillStyle = palette.treeTrunk;
      targetCtx.beginPath();
      targetCtx.roundRect(-3.3 * scale, -1 * scale, 6.6 * scale, 28 * scale, 3 * scale);
      targetCtx.fill();

      targetCtx.fillStyle = palette.treeDark;
      targetCtx.beginPath();
      targetCtx.arc(-9 * scale, -15 * scale, 15 * scale, 0, Math.PI * 2);
      targetCtx.arc(9 * scale, -18 * scale, 16 * scale, 0, Math.PI * 2);
      targetCtx.arc(0, -34 * scale, 19 * scale, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.fillStyle = palette.tree;
      targetCtx.beginPath();
      targetCtx.arc(-7 * scale, -18 * scale, 11 * scale, 0, Math.PI * 2);
      targetCtx.arc(8 * scale, -22 * scale, 12 * scale, 0, Math.PI * 2);
      targetCtx.arc(1 * scale, -36 * scale, 13 * scale, 0, Math.PI * 2);
      targetCtx.fill();

      targetCtx.fillStyle = palette.treeLight;
      targetCtx.globalAlpha = 0.55;
      targetCtx.beginPath();
      targetCtx.arc(-2 * scale, -39 * scale, 6 * scale, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.restore();
    };

    const drawRock = (x: number, y: number, scale = 1) => {
      targetCtx.save();
      targetCtx.translate(x, y);
      targetCtx.fillStyle = palette.rock;
      targetCtx.beginPath();
      targetCtx.moveTo(-10 * scale, 4 * scale);
      targetCtx.quadraticCurveTo(-9 * scale, -7 * scale, -2 * scale, -10 * scale);
      targetCtx.quadraticCurveTo(9 * scale, -11 * scale, 11 * scale, 3 * scale);
      targetCtx.closePath();
      targetCtx.fill();

      targetCtx.fillStyle = palette.rockLight;
      targetCtx.globalAlpha = 0.7;
      targetCtx.beginPath();
      targetCtx.ellipse(-2 * scale, -5 * scale, 4 * scale, 2.4 * scale, -0.3, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.restore();
    };

    const drawFlower = (x: number, y: number, scale: number, color: string) => {
      targetCtx.save();
      targetCtx.translate(x, y);
      targetCtx.fillStyle = color;
      for (let i = 0; i < 5; i += 1) {
        const angle = (Math.PI * 2 * i) / 5;
        targetCtx.beginPath();
        targetCtx.arc(Math.cos(angle) * 3 * scale, Math.sin(angle) * 3 * scale, 2.3 * scale, 0, Math.PI * 2);
        targetCtx.fill();
      }
      targetCtx.fillStyle = isNight ? '#b39547' : '#f2c95f';
      targetCtx.beginPath();
      targetCtx.arc(0, 0, 1.6 * scale, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.restore();
    };

    seed = 73129;
    [[18, 70, 0.75, 0.8], [250, 145, 0.7, 0.78], [92, 515, 0.55, 0.62], [285, 740, 0.6, 0.55], [30, 1060, 0.5, 0.45]].forEach(([x, y, scale, alpha]) => {
      drawCloud(x, y, scale, alpha);
    });

    drawMountain({ x: 55, baseY: 355, mtnWidth: 125, height: 150, color: palette.mountainFar, alpha: 0.8, snow: true });
    drawMountain({ x: 265, baseY: 365, mtnWidth: 155, height: 190, color: palette.mountainMid, alpha: 0.88, snow: true });
    drawMountain({ x: 110, baseY: 850, mtnWidth: 150, height: 165, color: palette.mountainFar, alpha: 0.72 });
    drawMountain({ x: 320, baseY: 1160, mtnWidth: 135, height: 170, color: palette.mountainMid, alpha: 0.72 });
    drawMountain({ x: 70, baseY: 1530, mtnWidth: 120, height: 145, color: palette.mountainNear, alpha: 0.5 });

    drawHill(310, palette.grassFar, 22, 0.5);
    drawHill(455, palette.grass, 28, 1.4);
    drawHill(650, palette.grassLight, 24, 2.2);

    targetCtx.save();
    targetCtx.globalAlpha = 0.14;
    targetCtx.strokeStyle = palette.grassDark;
    targetCtx.lineWidth = 1;
    for (let i = 0; i < 260; i += 1) {
      const x = range(0, width);
      const y = range(400, courseHeight);
      const length = range(3, 8);
      targetCtx.beginPath();
      targetCtx.moveTo(x, y);
      targetCtx.lineTo(x + range(-2, 2), y - length);
      targetCtx.stroke();
    }
    targetCtx.restore();

    const roadPath = () => {
      targetCtx.beginPath();
      targetCtx.moveTo(92, 300);
      targetCtx.bezierCurveTo(18, 560, 205, 760, 92, 1030);
      targetCtx.bezierCurveTo(14, 1240, 190, 1440, 118, 1730);
      targetCtx.bezierCurveTo(36, 1980, 196, 2310, 88, courseHeight + 20);
    };

    targetCtx.save();
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.strokeStyle = palette.roadEdge;
    targetCtx.lineWidth = 46;
    roadPath();
    targetCtx.stroke();

    targetCtx.strokeStyle = palette.road;
    targetCtx.lineWidth = 36;
    roadPath();
    targetCtx.stroke();

    targetCtx.strokeStyle = palette.roadHighlight;
    targetCtx.globalAlpha = 0.8;
    targetCtx.lineWidth = 6;
    roadPath();
    targetCtx.stroke();
    targetCtx.restore();

    const riverPath = () => {
      targetCtx.beginPath();
      targetCtx.moveTo(330, 270);
      targetCtx.bezierCurveTo(245, 560, 355, 810, 260, 1090);
      targetCtx.bezierCurveTo(200, 1310, 305, 1480, 220, 1740);
      targetCtx.bezierCurveTo(160, 2010, 315, 2320, 245, courseHeight + 20);
    };

    targetCtx.save();
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.strokeStyle = palette.riverEdge;
    targetCtx.lineWidth = 62;
    riverPath();
    targetCtx.stroke();

    targetCtx.strokeStyle = palette.river;
    targetCtx.lineWidth = 52;
    riverPath();
    targetCtx.stroke();

    targetCtx.strokeStyle = palette.riverHighlight;
    targetCtx.globalAlpha = 0.72;
    targetCtx.lineWidth = 8;
    riverPath();
    targetCtx.stroke();
    targetCtx.restore();

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
      const color = [palette.flowerYellow, palette.flowerPink, palette.flowerWhite][i % 3];
      drawFlower(x, y, range(0.7, 1.35), color);
    }
  };

  drawThemeMap(ctx, colors, false);
  drawThemeMap(nightCtx, nightColors, true);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(canvas.height * COURSE_TEXTURE_ASPECT_RATIO, canvas.height),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  );
  wall.position.set(0, screenToWorldY(canvas.height / 2), wallZ);

  const markerCanvas = document.createElement('canvas');
  markerCanvas.width = width;
  markerCanvas.height = courseHeight;
  const markerContext = markerCanvas.getContext('2d')!;

  const drawStartLine = (targetContext: CanvasRenderingContext2D, lineColor: string, textColor: string, outlineColor: string, fontSize = 17) => {
    targetContext.save();
    targetContext.lineWidth = 5;
    targetContext.strokeStyle = lineColor;
    targetContext.setLineDash([16, 10]);
    targetContext.beginPath();
    targetContext.moveTo(22, startLineY);
    targetContext.lineTo(width - 22, startLineY);
    targetContext.stroke();
    targetContext.setLineDash([]);
    targetContext.font = `900 ${fontSize}px "Noto Sans KR", Pretendard, sans-serif`;
    targetContext.textAlign = 'center';
    targetContext.textBaseline = 'middle';
    targetContext.lineWidth = 7;
    targetContext.strokeStyle = outlineColor;
    // Keep the label in the restricted area below the line so it does not
    // overlap the characters waiting above the start line.
    targetContext.strokeText('출발선', width / 2, startLineY + 22);
    targetContext.fillStyle = textColor;
    targetContext.fillText('출발선', width / 2, startLineY + 22);
    targetContext.restore();
  };

  drawStartLine(markerContext, '#315444', colors.text, '#ffffff');

  const markerTexture = new THREE.CanvasTexture(markerCanvas);
  markerTexture.colorSpace = THREE.SRGBColorSpace;
  const markers = new THREE.Mesh(
    new THREE.PlaneGeometry(width, canvas.height),
    new THREE.MeshBasicMaterial({ map: markerTexture, transparent: true, depthTest: true, depthWrite: false })
  );
  markers.position.set(0, screenToWorldY(canvas.height / 2), wallZ + 0.1);
  markers.renderOrder = -99;
  markers.visible = activeTheme !== 'night';

  const nightMarkerCanvas = document.createElement('canvas');
  nightMarkerCanvas.width = width;
  nightMarkerCanvas.height = courseHeight;
  const nightMarkerContext = nightMarkerCanvas.getContext('2d')!;
  drawStartLine(nightMarkerContext, '#fff3a7', '#fff3a7', '#08111f', 20);

  const nightMarkerTexture = new THREE.CanvasTexture(nightMarkerCanvas);
  nightMarkerTexture.colorSpace = THREE.SRGBColorSpace;
  const nightMarkers = new THREE.Mesh(
    new THREE.PlaneGeometry(width, canvas.height),
    new THREE.MeshBasicMaterial({ map: nightMarkerTexture, transparent: true, depthTest: true, depthWrite: false })
  );
  nightMarkers.position.copy(markers.position);
  nightMarkers.renderOrder = -99;
  nightMarkers.visible = activeTheme === 'night';

  const finishTexture = new THREE.TextureLoader().load(FINISH_LINE_TEXTURE_URL);
  finishTexture.colorSpace = THREE.SRGBColorSpace;
  finishTexture.minFilter = THREE.LinearFilter;
  finishTexture.magFilter = THREE.LinearFilter;
  const finishLineWidth = width * 1.04;
  const finishLineHeight = finishLineWidth / FINISH_LINE_ASPECT_RATIO;
  const finishLine = new THREE.Mesh(
    new THREE.PlaneGeometry(finishLineWidth, finishLineHeight),
    new THREE.MeshBasicMaterial({ map: finishTexture, depthWrite: false })
  );
  finishLine.position.set(0, screenToWorldY(floorY), wallZ + 0.2);

  return { wall, markers, nightMarkers, finishLine };
}
