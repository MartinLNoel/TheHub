// The Fighter character: an SVG that evolves over the 10 stages. getCharacterSVG is copied
// unchanged from gainz-tracker (app.js, "FIGHTER / PROGRESSION SYSTEM"). Its output is built only
// from numbers and fixed colours (never from stored text), so parsing it as SVG markup is safe.

export function getCharacterSVG(stageId, powered) {
  const s = stageId;
  const glow = powered ? `filter="url(#glow)"` : '';
  const glowDef = powered ? `<defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : '<defs></defs>';

  // Subtle but consistent progression
  const bodyW = 28 + s * 5;
  const shoulderW = 38 + s * 7;
  const armW = 5 + s * 1.2;
  const neckW = 8 + s * 0.8;
  const headR = 18 + s * 0.5;
  const legW = 10 + s * 1.5;

  // Clearly distinct shirt colors per stage to confirm evolution
  const skinColors = ['#c8a882','#c8a882','#bf9e72','#bf9e72','#a88060','#a88060','#8c6640','#8c6640','#7a5530','#7a5530'];
  const shirtColors = ['#2a2a2a','#1a3a6b','#c0392b','#7d3c98','#1a6b3a','#e8ff47','#ff6b35','#e74c3c','#1a1a8b','#ffd700'];
  const accentColors = ['#444','#3a6aab','#e74c3c','#9b59b6','#27ae60','#d4e847','#ff5722','#c0392b','#4a4adb','#ffa500'];
  const skin = skinColors[s] || '#7a5530';
  const shirt = shirtColors[s] || '#ffd700';
  const accent = accentColors[s] || '#ffd700';

  const cx = 100;
  const headY = 55;
  const neckY = headY + headR;
  const shoulderY = neckY + 10;
  const bodyBottom = shoulderY + 70;
  const hipY = bodyBottom;
  const kneeY = hipY + 50;
  const footY = kneeY + 50;

  // Left/right shoulder positions
  const lShoulder = cx - shoulderW/2;
  const rShoulder = cx + shoulderW/2;

  // Arm endpoints (progressively more defined flex pose from stage 4+)
  const armPose = s >= 4 ? 0.85 : 1;
  const lElbow = { x: lShoulder - 18 - s*2, y: shoulderY + 35 * armPose };
  const rElbow = { x: rShoulder + 18 + s*2, y: shoulderY + 35 * armPose };
  const lHand  = { x: lElbow.x + (s >= 4 ? 8 : -4), y: lElbow.y + 30 };
  const rHand  = { x: rElbow.x - (s >= 4 ? 8 : -4), y: rElbow.y + 30 };

  let extras = '';

  // Stage 3+: wristbands
  if (s >= 3) {
    extras += `<rect x="${lHand.x-7}" y="${lHand.y-8}" width="14" height="7" rx="3" fill="${accent}" opacity="0.9"/>`;
    extras += `<rect x="${rHand.x-7}" y="${rHand.y-8}" width="14" height="7" rx="3" fill="${accent}" opacity="0.9"/>`;
  }
  // Stage 5+: belt
  if (s >= 5) {
    extras += `<rect x="${cx - bodyW/2 - 2}" y="${hipY - 10}" width="${bodyW+4}" height="10" rx="3" fill="${accent}" opacity="0.85"/>`;
    extras += `<rect x="${cx - 7}" y="${hipY - 12}" width="14" height="14" rx="2" fill="${accent}"/>`;
  }
  // Stage 6+: shoulder pads
  if (s >= 6) {
    extras += `<ellipse cx="${lShoulder}" cy="${shoulderY}" rx="14" ry="8" fill="${accent}" opacity="0.7"/>`;
    extras += `<ellipse cx="${rShoulder}" cy="${shoulderY}" rx="14" ry="8" fill="${accent}" opacity="0.7"/>`;
  }
  // Stage 7+: scar/tattoo detail on arm
  if (s >= 7) {
    extras += `<path d="M${lElbow.x+2},${lElbow.y+5} l4,8 l-4,5" stroke="${accent}" stroke-width="1.5" fill="none" opacity="0.8"/>`;
  }
  // Stage 8+: crown-like headband
  if (s >= 8) {
    extras += `<path d="M${cx-14},${headY-headR+4} l4,-8 l5,6 l5,-10 l5,10 l5,-6 l4,8" stroke="${accent}" stroke-width="2" fill="none"/>`;
  }
  // Stage 9: crown + aura lines
  if (s >= 9) {
    extras += `<path d="M${cx-14},${headY-headR+2} l4,-10 l5,7 l5,-12 l5,12 l5,-7 l4,10" fill="${accent}" opacity="0.9"/>`;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r1 = headR + 12, r2 = headR + 22;
      extras += `<line x1="${cx + Math.cos(angle)*r1}" y1="${headY + Math.sin(angle)*r1}" x2="${cx + Math.cos(angle)*r2}" y2="${headY + Math.sin(angle)*r2}" stroke="${accent}" stroke-width="1.5" opacity="0.6"/>`;
    }
  }

  // Powered aura (streak bonus)
  let aura = '';
  if (powered) {
    aura = `<ellipse cx="${cx}" cy="${hipY+20}" rx="${shoulderW*0.8}" ry="15" fill="${accent}" opacity="0.07"/>
    <ellipse cx="${cx}" cy="${headY}" rx="${headR+15}" ry="${headR+15}" fill="${accent}" opacity="0.04"/>`;
  }

  // Muscle definition lines (from stage 4+)
  let muscles = '';
  if (s >= 4) {
    // bicep curve hint
    muscles += `<path d="M${lElbow.x+armW},${lElbow.y} q-4,10 -2,20" stroke="${skin}" stroke-width="1" fill="none" opacity="0.5"/>`;
    muscles += `<path d="M${rElbow.x-armW},${rElbow.y} q4,10 2,20" stroke="${skin}" stroke-width="1" fill="none" opacity="0.5"/>`;
  }
  if (s >= 6) {
    // chest line
    muscles += `<path d="M${cx-8},${shoulderY+15} q8,8 0,20 q-8,8 0,0" stroke="${skin}" stroke-width="1" fill="none" opacity="0.3"/>`;
  }

  return `<svg width="200" height="260" viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
  ${glowDef}
  <g ${glow}>
  ${aura}
  <!-- Shadow -->
  <ellipse cx="${cx}" cy="${footY+6}" rx="${shoulderW*0.6}" ry="6" fill="#000" opacity="0.3"/>
  <!-- Legs -->
  <rect x="${cx - legW - 4}" y="${hipY}" width="${legW}" height="${kneeY-hipY}" rx="5" fill="${shirt}" opacity="0.85"/>
  <rect x="${cx + 4}" y="${hipY}" width="${legW}" height="${kneeY-hipY}" rx="5" fill="${shirt}" opacity="0.85"/>
  <!-- Lower legs -->
  <rect x="${cx - legW - 4}" y="${kneeY}" width="${legW}" height="${footY-kneeY}" rx="4" fill="#222"/>
  <rect x="${cx + 4}" y="${kneeY}" width="${legW}" height="${footY-kneeY}" rx="4" fill="#222"/>
  <!-- Feet -->
  <ellipse cx="${cx - legW/2 - 4}" cy="${footY+4}" rx="${legW*0.8}" ry="5" fill="#111"/>
  <ellipse cx="${cx + legW/2 + 4}" cy="${footY+4}" rx="${legW*0.8}" ry="5" fill="#111"/>
  <!-- Left arm (behind body) -->
  <path d="M${lShoulder},${shoulderY} L${lElbow.x},${lElbow.y} L${lHand.x},${lHand.y}" 
    stroke="${skin}" stroke-width="${armW*2}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Body -->
  <path d="M${cx - bodyW/2},${bodyBottom} L${lShoulder},${shoulderY} L${cx - neckW/2},${neckY} L${cx + neckW/2},${neckY} L${rShoulder},${shoulderY} L${cx + bodyW/2},${bodyBottom} Z" fill="${shirt}"/>
  <!-- Shirt detail -->
  <line x1="${cx}" y1="${shoulderY+5}" x2="${cx}" y2="${bodyBottom-10}" stroke="${accent}" stroke-width="1.5" opacity="0.5"/>
  ${muscles}
  ${extras}
  <!-- Right arm (front) -->
  <path d="M${rShoulder},${shoulderY} L${rElbow.x},${rElbow.y} L${rHand.x},${rHand.y}" 
    stroke="${skin}" stroke-width="${armW*2}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Neck -->
  <rect x="${cx - neckW/2}" y="${headY}" width="${neckW}" height="${neckY-headY+4}" rx="3" fill="${skin}"/>
  <!-- Head -->
  <circle cx="${cx}" cy="${headY}" r="${headR}" fill="${skin}"/>
  <!-- Eyes -->
  <circle cx="${cx-6}" cy="${headY-2}" r="${s >= 7 ? 3.5 : 2.5}" fill="${powered ? accent : '#222'}"/>
  <circle cx="${cx+6}" cy="${headY-2}" r="${s >= 7 ? 3.5 : 2.5}" fill="${powered ? accent : '#222'}"/>
  ${s >= 7 ? `<circle cx="${cx-6}" cy="${headY-2}" r="1.5" fill="#000"/><circle cx="${cx+6}" cy="${headY-2}" r="1.5" fill="#000"/>` : ''}
  <!-- Mouth — neutral early, determined later -->
  ${s < 5 ? `<path d="M${cx-5},${headY+7} q5,3 10,0" stroke="#555" stroke-width="1.5" fill="none"/>` :
             `<path d="M${cx-6},${headY+8} q6,-4 12,0" stroke="#333" stroke-width="2" fill="none"/>`}
  <!-- Hair grows from stage 2 -->
  ${s >= 2 ? `<path d="M${cx-headR+4},${headY-8} q${headR*0.5},-${8+s*1.5} ${headR*2-8},${-4-s}" stroke="${s>=8?accent:'#222'}" stroke-width="${2+s*0.3}" fill="none" stroke-linecap="round"/>` : ''}
  </g>
</svg>`;
}

/** The character as an SVG element, ready to insert into the page. */
export function characterElement(stageId, powered, doc = globalThis.document) {
  const parsed = new DOMParser().parseFromString(getCharacterSVG(stageId, powered), 'image/svg+xml');
  const svg = doc.importNode(parsed.documentElement, true);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Your fighter at stage ' + (stageId + 1));
  return svg;
}
