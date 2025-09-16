import { getCardColors } from "../common/utils.js";

/**
 * Render the streak card SVG.
 * @param {string} username - GitHub username
 * @param {{
 *   currentStreak: number,
 *   longestStreak: number,
 *   totalContributions: number,
 *   currentStreakStart?: string,
 *   currentStreakEnd?: string,
 *   longestStreakStart?: string,
 *   longestStreakEnd?: string,
 *   firstContribution?: string,
 * }} streak - Streak statistics
 * @param {{
 *   theme: string,
 *   hide_border?: boolean,
 *   title_color?: string,
 *   text_color?: string,
 *   bg_color?: string,
 *   border_color?: string
 * }} options - Card customization options
 * @returns {string} SVG card markup
 */
export function renderStreakCard(username, streak, options) {
  const { textColor, bgColor, borderColor } = getCardColors({
    title_color: options.title_color,
    text_color: options.text_color,
    bg_color: options.bg_color,
    border_color: options.border_color,
    theme: options.theme || "default",
  });

  const formatRange = (start, end) => {
    if (!start || !end) { return ""; }
    if (start === end) { return start; }
    return `${start} - ${end}`;
  };

  // Move everything up since title is removed
  const statsY = 85;        // Was 100
  const labelsY = 115;      // Was 130
  const rangeY = 135;       // Was 150
  const circleY = 79;       // Was 110
  const circleNumberY = 84; // Was 115
  const circleLabelY = 144;  // Was 170
  const circleRangeY = 164;  // Was 189
  const fireIconY = 23.5;    // Was 49.5
  
  // Divider line coordinates - also moved up
  const lineTop = 30;       // Was 45
  const lineBottom = 165;   // Was 180
  const line1X = 171;       // Position of first vertical line (between Total and Current)
  const line2X = 324;       // Position of second vertical line (between Current and Longest)
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195">
      <defs>
        <!-- Glow filter -->
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- Mask to hide part of the ring behind the fire -->
        <mask id="mask_out_ring_behind_fire">
          <rect width="495" height="195" fill="white"/>
          <ellipse cx="247.5" cy="${fireIconY + 12.5}" rx="13" ry="18" fill="black"/>
        </mask>
      </defs>
      <style>
        @keyframes fadein {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes glowPulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @keyframes currstreak {
          0% { font-size: 3px; opacity: 0.2; }
          80% { font-size: 34px; opacity: 1; }
          100% { font-size: 28px; opacity: 1; }
        }
        .header-fire { font: 600 20px 'Segoe UI', Ubuntu, Sans-Serif; fill: orange; filter: url(#glow); animation: glowPulse 2s infinite; }
        .header-text { font: 600 20px 'Segoe UI', Ubuntu, Sans-Serif; fill: black; }
        .stat { font: 700 28px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${textColor}; text-anchor: middle; animation: fadein 0.6s forwards; }
        .label { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${textColor}; text-anchor: middle; opacity: 0; animation: fadein 0.8s forwards; }
        .range { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${textColor}; text-anchor: middle; opacity: 0; animation: fadein 1s forwards; }
        .circle-label { font: 700 28px 'Segoe UI', Ubuntu, Sans-Serif; fill: orange; text-anchor: middle; dominant-baseline: middle; filter: url(#glow); animation: currstreak 0.6s forwards; }
        .ring { stroke: orange; filter: url(#glow); animation: glowPulse 2s infinite; }
        .divider { stroke: ${textColor}; stroke-opacity: 0.4; stroke-width: 1; }
      </style>
      
      <rect width="100%" height="100%" fill="${bgColor}" stroke="${
        options.hide_border ? "none" : borderColor
      }" rx="4.5"/>
      
      <!-- Divider lines -->
      <line x1="${line1X}" y1="${lineTop}" x2="${line1X}" y2="${lineBottom}" class="divider" />
      <line x1="${line2X}" y1="${lineTop}" x2="${line2X}" y2="${lineBottom}" class="divider" />

      <!-- Total Contributions -->
      <text x="95" y="${statsY}" class="stat">${streak.totalContributions.toLocaleString()}</text>
      <text x="95" y="${labelsY}" class="label">Total Contributions</text>
      <text x="95" y="${rangeY}" class="range">${
        streak.firstContribution ? `${streak.firstContribution} - Present` : ""
      }</text>

      <!-- Current Streak with glowing circle -->
      <g mask="url(#mask_out_ring_behind_fire)">
        <circle cx="247.5" cy="${circleY}" r="40" stroke-width="5" class="ring" fill="none"/>
      </g>
      
      <!-- Fire icon with glow -->
      <g transform="translate(247.5, ${fireIconY})" style="opacity: 0; animation: fadein 0.5s linear forwards 0.6s">
        <path d="M -12 -0.5 L 15 -0.5 L 15 23.5 L -12 23.5 Z" fill="none"/>
        <path d="M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z" 
          fill="orange" filter="url(#glow)"/>
      </g>

      <!-- Current Streak number -->
      <text x="247.5" y="${circleNumberY}" class="circle-label">${streak.currentStreak}</text>
      <text x="247.5" y="${circleLabelY}" class="label"  style="fill: orange">Current Streak</text>
      <text x="247.5" y="${circleRangeY}" class="range">${
        streak.currentStreakStart && streak.currentStreakEnd
          ? formatRange(streak.currentStreakStart, streak.currentStreakEnd)
          : ""
      }</text>

      <!-- Longest Streak -->
      <text x="400" y="${statsY}" class="stat">${streak.longestStreak}</text>
      <text x="400" y="${labelsY}" class="label">Longest Streak</text>
      <text x="400" y="${rangeY}" class="range">${
        streak.longestStreakStart && streak.longestStreakEnd
          ? formatRange(streak.longestStreakStart, streak.longestStreakEnd)
          : ""
      }</text>
    </svg>
  `;
}