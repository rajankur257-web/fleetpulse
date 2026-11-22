import { DriverStatus } from '@fleet-pulse/shared';
import { STATUS_COLORS } from '../../lib/constants';

export function createDriverMarkerElement(
  status: DriverStatus,
  heading: number,
  name: string,
  speed?: number,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'fleet-driver-marker group relative cursor-pointer';

  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;

  // Outer ring / pulse
  const outer = document.createElement('div');
  outer.className = `w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-950 transition-transform duration-300 ${color.bg}`;

  // Vehicle Direction Arrow SVG
  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowSvg.setAttribute('viewBox', '0 0 24 24');
  arrowSvg.setAttribute('class', 'w-4 h-4 fill-white text-white drop-shadow');
  arrowSvg.style.transform = `rotate(${heading}deg)`;
  arrowSvg.style.transition = 'transform 0.4s ease-out';
  arrowSvg.innerHTML = `<polygon points="12,2 19,21 12,17 5,21" />`;

  outer.appendChild(arrowSvg);
  container.appendChild(outer);

  // Hover Tooltip Badge
  const tooltip = document.createElement('div');
  tooltip.className =
    'absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap';
  tooltip.innerHTML = `
    <div class="px-2 py-1 rounded bg-slate-900/95 border border-slate-700 text-[11px] text-slate-100 shadow-xl flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full ${color.bg}"></span>
      <span class="font-medium">${name}</span>
      ${speed !== undefined ? `<span class="text-slate-400 font-mono">(${speed} km/h)</span>` : ''}
    </div>
    <div class="w-1.5 h-1.5 bg-slate-900 border-r border-b border-slate-700 rotate-45 -mt-1"></div>
  `;
  container.appendChild(tooltip);

  return container;
}

export function updateDriverMarkerElement(
  el: HTMLElement,
  status: DriverStatus,
  heading: number,
  speed?: number,
): void {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const outer = el.querySelector('div') as HTMLElement | null;
  if (outer) {
    outer.className = `w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-950 transition-transform duration-300 ${color.bg}`;
  }

  const svg = el.querySelector('svg') as HTMLElement | null;
  if (svg) {
    svg.style.transform = `rotate(${heading}deg)`;
  }

  const speedSpan = el.querySelector('.text-slate-400') as HTMLElement | null;
  if (speedSpan && speed !== undefined) {
    speedSpan.textContent = `(${speed} km/h)`;
  }
}
