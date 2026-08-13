import * as THREE from 'three';

export function createCourse({ width, courseHeight, startLineY, floorY, wallZ, activeTheme, screenToWorldY }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = courseHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create map canvas context');
  }

  // ------------------------------------------------------------
  // Palette
  // ------------------------------------------------------------
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

    treeTrunk: '#79563c',
    treeDark: '#327552',
    tree: '#419262',
    treeLight: '#6ab673',

    rock: '#839a90',
    rockLight: '#b3c6b8',

    flowerPink: '#ef9caf',
    flowerYellow: '#f2ca62',
    flowerWhite: '#fff8e8',

    text: '#315444'
  };

  // ------------------------------------------------------------
  // Deterministic pseudo random
  // 화면을 다시 열어도 배치가 계속 바뀌지 않도록 seed 사용
  // ------------------------------------------------------------
  let seed = 73129;

  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const range = (min, max) => min + (max - min) * random();

  // ------------------------------------------------------------
  // Sky
  // ------------------------------------------------------------
  const skyGradient = ctx.createLinearGradient(
    0,
    0,
    0,
    courseHeight
  );

  skyGradient.addColorStop(0, colors.skyTop);
  skyGradient.addColorStop(0.32, colors.skyBottom);
  skyGradient.addColorStop(1, colors.grassLight);

  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, courseHeight);

  // ------------------------------------------------------------
  // Drawing helpers
  // ------------------------------------------------------------
  const drawCloud = (
    x,
    y,
    scale = 1,
    alpha = 0.85
  ) => {
    ctx.save();

    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.ellipse(
      x + 28 * scale,
      y + 10 * scale,
      43 * scale,
      13 * scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = '#f9ffff';
    ctx.beginPath();

    ctx.arc(
      x,
      y,
      15 * scale,
      Math.PI,
      0
    );

    ctx.arc(
      x + 19 * scale,
      y - 9 * scale,
      22 * scale,
      Math.PI,
      0
    );

    ctx.arc(
      x + 43 * scale,
      y,
      16 * scale,
      Math.PI,
      0
    );

    ctx.lineTo(
      x + 43 * scale,
      y + 10 * scale
    );

    ctx.lineTo(
      x,
      y + 10 * scale
    );

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const drawMountain = ({
    x,
    baseY,
    width,
    height,
    color,
    alpha = 1,
    snow = false
  }) => {
    ctx.save();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    ctx.beginPath();

    ctx.moveTo(
      x - width,
      baseY
    );

    ctx.quadraticCurveTo(
      x - width * 0.45,
      baseY - height * 0.45,
      x,
      baseY - height
    );

    ctx.quadraticCurveTo(
      x + width * 0.45,
      baseY - height * 0.38,
      x + width,
      baseY
    );

    ctx.closePath();
    ctx.fill();

    if (snow) {
      ctx.fillStyle = colors.snow;

      ctx.beginPath();

      ctx.moveTo(
        x - width * 0.2,
        baseY - height * 0.72
      );

      ctx.lineTo(
        x,
        baseY - height
      );

      ctx.lineTo(
        x + width * 0.21,
        baseY - height * 0.71
      );

      ctx.lineTo(
        x + width * 0.1,
        baseY - height * 0.63
      );

      ctx.lineTo(
        x,
        baseY - height * 0.68
      );

      ctx.lineTo(
        x - width * 0.09,
        baseY - height * 0.61
      );

      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  const drawHill = (
    y,
    color,
    amplitude,
    phase
  ) => {
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.moveTo(0, courseHeight);

    ctx.lineTo(0, y);

    for (let x = 0; x <= width; x += 15) {
      const curveY =
        y
        + Math.sin(
          x / 55 + phase
        ) * amplitude
        + Math.sin(
          x / 93 + phase * 1.7
        ) * amplitude * 0.45;

      ctx.lineTo(
        x,
        curveY
      );
    }

    ctx.lineTo(
      width,
      courseHeight
    );

    ctx.closePath();
    ctx.fill();
  };

  const drawTree = (
    x,
    y,
    scale = 1,
    variation = 0
  ) => {
    ctx.save();

    ctx.translate(
      x,
      y
    );

    ctx.rotate(variation * 0.025);

    ctx.fillStyle = colors.treeTrunk;

    ctx.beginPath();

    ctx.roundRect(
      -3.3 * scale,
      -1 * scale,
      6.6 * scale,
      28 * scale,
      3 * scale
    );

    ctx.fill();

    ctx.fillStyle = colors.treeDark;

    ctx.beginPath();

    ctx.arc(
      -9 * scale,
      -15 * scale,
      15 * scale,
      0,
      Math.PI * 2
    );

    ctx.arc(
      9 * scale,
      -18 * scale,
      16 * scale,
      0,
      Math.PI * 2
    );

    ctx.arc(
      0,
      -34 * scale,
      19 * scale,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = colors.tree;

    ctx.beginPath();

    ctx.arc(
      -7 * scale,
      -18 * scale,
      11 * scale,
      0,
      Math.PI * 2
    );

    ctx.arc(
      8 * scale,
      -22 * scale,
      12 * scale,
      0,
      Math.PI * 2
    );

    ctx.arc(
      1 * scale,
      -36 * scale,
      13 * scale,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = colors.treeLight;
    ctx.globalAlpha = 0.55;

    ctx.beginPath();

    ctx.arc(
      -2 * scale,
      -39 * scale,
      6 * scale,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  };

  const drawRock = (
    x,
    y,
    scale = 1
  ) => {
    ctx.save();

    ctx.translate(
      x,
      y
    );

    ctx.fillStyle = colors.rock;

    ctx.beginPath();

    ctx.moveTo(
      -10 * scale,
      4 * scale
    );

    ctx.quadraticCurveTo(
      -9 * scale,
      -7 * scale,
      -2 * scale,
      -10 * scale
    );

    ctx.quadraticCurveTo(
      9 * scale,
      -11 * scale,
      11 * scale,
      3 * scale
    );

    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.rockLight;
    ctx.globalAlpha = 0.7;

    ctx.beginPath();

    ctx.ellipse(
      -2 * scale,
      -5 * scale,
      4 * scale,
      2.4 * scale,
      -0.3,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  };

  const drawFlower = (
    x,
    y,
    scale,
    color
  ) => {
    ctx.save();

    ctx.translate(
      x,
      y
    );

    ctx.fillStyle = color;

    for (let i = 0; i < 5; i += 1) {
      const angle =
        (Math.PI * 2 * i) / 5;

      ctx.beginPath();

      ctx.arc(
        Math.cos(angle) * 3 * scale,
        Math.sin(angle) * 3 * scale,
        2.3 * scale,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.fillStyle = '#f2c95f';

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      1.6 * scale,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  };

  // ------------------------------------------------------------
  // Clouds
  // ------------------------------------------------------------
  [
    [18, 70, 0.75, 0.8],
    [250, 145, 0.7, 0.78],
    [92, 515, 0.55, 0.62],
    [285, 740, 0.6, 0.55],
    [30, 1060, 0.5, 0.45]
  ].forEach(
    ([x, y, scale, alpha]) => {
      drawCloud(
        x,
        y,
        scale,
        alpha
      );
    }
  );

  // ------------------------------------------------------------
  // Mountains
  // ------------------------------------------------------------
  drawMountain({
    x: 55,
    baseY: 355,
    width: 125,
    height: 150,
    color: colors.mountainFar,
    alpha: 0.8,
    snow: true
  });

  drawMountain({
    x: 265,
    baseY: 365,
    width: 155,
    height: 190,
    color: colors.mountainMid,
    alpha: 0.88,
    snow: true
  });

  drawMountain({
    x: 110,
    baseY: 850,
    width: 150,
    height: 165,
    color: colors.mountainFar,
    alpha: 0.72
  });

  drawMountain({
    x: 320,
    baseY: 1160,
    width: 135,
    height: 170,
    color: colors.mountainMid,
    alpha: 0.72
  });

  drawMountain({
    x: 70,
    baseY: 1530,
    width: 120,
    height: 145,
    color: colors.mountainNear,
    alpha: 0.5
  });

  // ------------------------------------------------------------
  // Layered hills
  // ------------------------------------------------------------
  drawHill(
    310,
    colors.grassFar,
    22,
    0.5
  );

  drawHill(
    455,
    colors.grass,
    28,
    1.4
  );

  drawHill(
    650,
    colors.grassLight,
    24,
    2.2
  );

  // ------------------------------------------------------------
  // Tiny grass texture
  // ------------------------------------------------------------
  ctx.save();

  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = colors.grassDark;
  ctx.lineWidth = 1;

  for (let i = 0; i < 260; i += 1) {
    const x = range(0, width);
    const y = range(
      400,
      courseHeight
    );

    const length = range(
      3,
      8
    );

    ctx.beginPath();

    ctx.moveTo(
      x,
      y
    );

    ctx.lineTo(
      x + range(-2, 2),
      y - length
    );

    ctx.stroke();
  }

  ctx.restore();

  // ------------------------------------------------------------
  // Road
  // ------------------------------------------------------------
  const roadPath = () => {
    ctx.beginPath();

    ctx.moveTo(
      92,
      300
    );

    ctx.bezierCurveTo(
      18,
      560,
      205,
      760,
      92,
      1030
    );

    ctx.bezierCurveTo(
      14,
      1240,
      190,
      1440,
      118,
      1730
    );

    ctx.bezierCurveTo(
      36,
      1980,
      196,
      2310,
      88,
      courseHeight + 20
    );
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

  // ------------------------------------------------------------
  // River
  // ------------------------------------------------------------
  const riverPath = () => {
    ctx.beginPath();

    ctx.moveTo(
      330,
      270
    );

    ctx.bezierCurveTo(
      245,
      560,
      355,
      810,
      260,
      1090
    );

    ctx.bezierCurveTo(
      200,
      1310,
      305,
      1480,
      220,
      1740
    );

    ctx.bezierCurveTo(
      160,
      2010,
      315,
      2320,
      245,
      courseHeight + 20
    );
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

  // ------------------------------------------------------------
  // Trees
  // ------------------------------------------------------------
  const treeRows = [
    430,
    610,
    815,
    1020,
    1260,
    1460,
    1680,
    1890,
    2100,
    2300,
    2530,
    2710
  ];

  treeRows.forEach(
    (baseY, rowIndex) => {
      const positions =
        rowIndex % 2 === 0
          ? [22, 65, 337, 378]
          : [12, 52, 350];

      positions.forEach(
        (baseX, index) => {
          const x =
            baseX
            + range(-11, 11);

          const y =
            baseY
            + range(-30, 30);

          const scale =
            range(0.58, 0.9);

          drawTree(
            x,
            y,
            scale,
            index - 1.5
          );
        }
      );
    }
  );

  // ------------------------------------------------------------
  // Rocks
  // ------------------------------------------------------------
  for (let i = 0; i < 30; i += 1) {
    const leftSide =
      random() > 0.5;

    const x =
      leftSide
        ? range(8, 72)
        : range(318, 384);

    const y =
      range(480, courseHeight - 60);

    drawRock(
      x,
      y,
      range(0.45, 0.9)
    );
  }

  // ------------------------------------------------------------
  // Flowers
  // ------------------------------------------------------------
  const flowerColors = [
    colors.flowerPink,
    colors.flowerYellow,
    colors.flowerWhite
  ];

  for (let i = 0; i < 75; i += 1) {
    const x =
      random() > 0.5
        ? range(8, 78)
        : range(310, 382);

    const y =
      range(430, courseHeight - 40);

    drawFlower(
      x,
      y,
      range(0.45, 0.75),
      flowerColors[
        Math.floor(
          random()
          * flowerColors.length
        )
      ]
    );
  }

  // ------------------------------------------------------------
  // Start line
  // ------------------------------------------------------------
  ctx.clearRect(0, 0, width, courseHeight);
  const markerWidth = width - 36;
  const markerX = (width - markerWidth) / 2;

  ctx.textAlign = 'center';
  ctx.font = '800 15px Jua, system-ui';
  ctx.lineCap = 'round';

  ctx.fillStyle = 'rgba(255, 238, 166, 0.9)';
  ctx.strokeStyle = 'rgba(64, 83, 68, 0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(width / 2 - 27, startLineY - 34, 54, 23, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#405344';
  ctx.fillText('출발', width / 2, startLineY - 17);

  ctx.save();
  ctx.strokeStyle = 'rgba(64, 83, 68, 0.75)';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(markerX, startLineY);
  ctx.lineTo(markerX + markerWidth, startLineY);
  ctx.stroke();
  ctx.strokeStyle = '#f6cf62';
  ctx.lineWidth = 5;
  ctx.setLineDash([13, 9]);
  ctx.stroke();
  ctx.restore();

  // ------------------------------------------------------------
  // Finish line
  // ------------------------------------------------------------
  const finishCell = markerWidth / 12;
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      ctx.fillStyle = (row + column) % 2 ? '#f8e6aa' : '#405344';
      ctx.fillRect(markerX + column * finishCell, floorY - 8 + row * 8, finishCell, 8);
    }
  }
  ctx.strokeStyle = 'rgba(64, 83, 68, 0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(markerX, floorY - 8, markerWidth, 16);
  ctx.fillStyle = '#405344';
  ctx.fillText('도착', width / 2, floorY - 18);

  // ------------------------------------------------------------
  // Three.js texture
  // ------------------------------------------------------------
  const textureLoader = new THREE.TextureLoader();
  const dayCourseTexture = textureLoader.load(new URL('./assets/backgrounds/rolling-course.webp', import.meta.url).href);
  const nightCourseTexture = textureLoader.load(new URL('./assets/backgrounds/rolling-course-night.webp', import.meta.url).href);
  for (const texture of [dayCourseTexture, nightCourseTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  }

  const wall =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        width * 2,
        canvas.height
      ),
      new THREE.MeshBasicMaterial({
        map: activeTheme === 'night' ? nightCourseTexture : dayCourseTexture,
        depthTest: false,
        depthWrite: false
      })
    );

  wall.position.set(
    0,
    screenToWorldY(
      canvas.height / 2
    ),
    wallZ - 2.1
  );

  wall.renderOrder = -100;

  const markers = new THREE.Mesh(
    new THREE.PlaneGeometry(width, canvas.height),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: true,
      depthWrite: false
    })
  );
  markers.position.set(0, wall.position.y, wallZ - 2);
  markers.renderOrder = -99;
  markers.visible = activeTheme !== 'night';

  const nightMarkerCanvas = document.createElement('canvas');
  nightMarkerCanvas.width = width;
  nightMarkerCanvas.height = canvas.height;
  const nightMarkerContext = nightMarkerCanvas.getContext('2d');
  nightMarkerContext.textAlign = 'center';
  nightMarkerContext.font = '800 15px Jua, system-ui';
  nightMarkerContext.lineCap = 'round';

  nightMarkerContext.save();
  nightMarkerContext.shadowColor = '#b9ddff';
  nightMarkerContext.shadowBlur = 12;
  nightMarkerContext.strokeStyle = 'rgba(185, 221, 255, 0.34)';
  nightMarkerContext.lineWidth = 10;
  nightMarkerContext.beginPath();
  nightMarkerContext.moveTo(markerX, startLineY);
  nightMarkerContext.lineTo(markerX + markerWidth, startLineY);
  nightMarkerContext.stroke();
  nightMarkerContext.strokeStyle = '#d9efff';
  nightMarkerContext.lineWidth = 3;
  nightMarkerContext.setLineDash([7, 10]);
  nightMarkerContext.stroke();
  nightMarkerContext.restore();

  nightMarkerContext.fillStyle = '#17264bdd';
  nightMarkerContext.strokeStyle = '#d9efff';
  nightMarkerContext.lineWidth = 2;
  nightMarkerContext.beginPath();
  nightMarkerContext.roundRect(width / 2 - 27, startLineY - 34, 54, 23, 8);
  nightMarkerContext.fill();
  nightMarkerContext.stroke();
  nightMarkerContext.fillStyle = '#fff6ca';
  nightMarkerContext.fillText('출발', width / 2, startLineY - 17);

  nightMarkerContext.save();
  nightMarkerContext.shadowColor = '#fff4a8';
  nightMarkerContext.shadowBlur = 13;
  nightMarkerContext.strokeStyle = 'rgba(219, 232, 255, 0.35)';
  nightMarkerContext.lineWidth = 2;
  nightMarkerContext.beginPath();
  nightMarkerContext.moveTo(markerX, floorY);
  nightMarkerContext.lineTo(markerX + markerWidth, floorY);
  nightMarkerContext.stroke();
  nightMarkerContext.fillStyle = '#fff4a8';
  for (let index = 0; index < 13; index += 1) {
    const x = markerX + index * markerWidth / 12;
    const radius = index % 2 ? 3 : 5;
    nightMarkerContext.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const distance = point % 2 ? radius * 0.42 : radius;
      const px = x + Math.cos(angle) * distance;
      const py = floorY + Math.sin(angle) * distance;
      if (point === 0) nightMarkerContext.moveTo(px, py);
      else nightMarkerContext.lineTo(px, py);
    }
    nightMarkerContext.closePath();
    nightMarkerContext.fill();
  }
  nightMarkerContext.restore();
  nightMarkerContext.fillStyle = '#fff6ca';
  nightMarkerContext.fillText('도착', width / 2, floorY - 15);

  const nightMarkerTexture = new THREE.CanvasTexture(nightMarkerCanvas);
  nightMarkerTexture.colorSpace = THREE.SRGBColorSpace;
  const nightMarkers = new THREE.Mesh(
    new THREE.PlaneGeometry(width, canvas.height),
    new THREE.MeshBasicMaterial({ map: nightMarkerTexture, transparent: true, depthTest: true, depthWrite: false })
  );
  nightMarkers.position.copy(markers.position);
  nightMarkers.renderOrder = -99;
  nightMarkers.visible = activeTheme === 'night';

  return { wall, markers, nightMarkers, dayCourseTexture, nightCourseTexture };
}
