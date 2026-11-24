import { DriverStatus } from '@fleet-pulse/shared';
import { STATUS_COLORS } from '../../lib/constants';

export function createDriverMarkerElement(
  status: DriverStatus,
  heading: number,
  name: string,
  speed?: number,
  isSelected = false,
  hasActiveOrder = false,
  customerName?: string,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'fleet-driver-marker group relative cursor-pointer flex items-center justify-center select-none';
  container.style.zIndex = isSelected ? '9999' : '1';

  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;

  // 1. Radar Ping Ring (Pulsing wave active when selected)
  const ping = document.createElement('div');
  ping.className = 'radar-ping absolute rounded-full bg-amber-400/40 pointer-events-none transition-all duration-300';
  ping.style.width = '76px';
  ping.style.height = '76px';
  ping.style.animation = 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite';
  ping.style.display = isSelected ? 'block' : 'none';
  container.appendChild(ping);

  // 1b. Glowing Halo Ring
  const halo = document.createElement('div');
  halo.className = 'radar-halo absolute rounded-full bg-amber-400/30 blur-sm pointer-events-none transition-all duration-300';
  halo.style.width = '64px';
  halo.style.height = '64px';
  halo.style.display = isSelected ? 'block' : 'none';
  container.appendChild(halo);

  // 2. Main Vehicle Circle (Expands from w-8 h-8 to w-14 h-14 when selected)
  const outer = document.createElement('div');
  outer.className = `marker-circle rounded-full flex items-center justify-center transition-all duration-300 shadow-xl relative ${
    isSelected
      ? 'w-14 h-14 border-4 border-amber-400 ring-4 ring-amber-400/60 shadow-amber-500/50 scale-105'
      : 'w-8 h-8 border-2 border-slate-950 shadow-md'
  } ${color.bg}`;

  // Vehicle Direction Arrow SVG
  const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowSvg.setAttribute('viewBox', '0 0 24 24');
  arrowSvg.setAttribute(
    'class',
    `direction-arrow fill-white text-white drop-shadow transition-all duration-300 ${
      isSelected ? 'w-7 h-7' : 'w-4 h-4'
    }`,
  );
  arrowSvg.style.transform = `rotate(${heading}deg)`;
  arrowSvg.style.transition = 'transform 0.4s ease-out, width 0.3s, height 0.3s';
  arrowSvg.innerHTML = `<polygon points="12,2 19,21 12,17 5,21" />`;
  outer.appendChild(arrowSvg);

  // 3. Package Badge (if carrying active parcel)
  const packageBadge = document.createElement('div');
  packageBadge.className = `parcel-badge absolute rounded-full bg-amber-400 border-2 border-slate-950 text-slate-950 flex items-center justify-center shadow-lg font-bold select-none ${
    isSelected ? 'w-6 h-6 text-xs -top-2 -right-2' : 'w-4 h-4 text-[9px] -top-1 -right-1'
  }`;
  packageBadge.textContent = '📦';
  packageBadge.style.display = hasActiveOrder ? 'flex' : 'none';
  outer.appendChild(packageBadge);

  container.appendChild(outer);

  // 4. Floating Bold Header Pill (Above marker, always visible when selected)
  const pill = document.createElement('div');
  pill.className =
    'marker-pill absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex-col items-center pointer-events-none z-50 whitespace-nowrap transition-all duration-200';
  pill.style.display = isSelected ? 'flex' : 'none';
  pill.innerHTML = `
    <div class="px-3 py-1.5 rounded-full bg-slate-950/95 border-2 border-amber-400 text-white shadow-2xl flex items-center gap-2 font-bold text-xs tracking-tight">
      <span class="w-2.5 h-2.5 rounded-full ${color.bg} animate-pulse"></span>
      <span class="text-white font-bold">${name}</span>
      ${
        hasActiveOrder
          ? `<span class="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
              📦 ${customerName ? `Delivering to ${customerName}` : 'Holding Parcel'}
            </span>`
          : ''
      }
    </div>
    <div class="w-2.5 h-2.5 bg-slate-950 border-r-2 border-b-2 border-amber-400 rotate-45 -mt-1.5"></div>
  `;
  container.appendChild(pill);

  // 5. Hover Tooltip Badge (Shown on hover when NOT selected)
  const tooltip = document.createElement('div');
  tooltip.className =
    'marker-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-40 whitespace-nowrap';
  tooltip.style.display = isSelected ? 'none' : '';
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
  name?: string,
  speed?: number,
  isSelected = false,
  hasActiveOrder = false,
  customerName?: string,
): void {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  el.style.zIndex = isSelected ? '9999' : '1';

  // 1. Radar Ping & Halo
  const ping = el.querySelector('.radar-ping') as HTMLElement | null;
  if (ping) {
    ping.style.display = isSelected ? 'block' : 'none';
  }
  const halo = el.querySelector('.radar-halo') as HTMLElement | null;
  if (halo) {
    halo.style.display = isSelected ? 'block' : 'none';
  }

  // 2. Main Marker Circle
  const outer = el.querySelector('.marker-circle') as HTMLElement | null;
  if (outer) {
    outer.className = `marker-circle rounded-full flex items-center justify-center transition-all duration-300 shadow-xl relative ${
      isSelected
        ? 'w-14 h-14 border-4 border-amber-400 ring-4 ring-amber-400/60 shadow-amber-500/50 scale-105'
        : 'w-8 h-8 border-2 border-slate-950 shadow-md'
    } ${color.bg}`;
  }

  // Direction Arrow SVG
  const svg = el.querySelector('.direction-arrow') as SVGElement | null;
  if (svg) {
    svg.style.transform = `rotate(${heading}deg)`;
    svg.setAttribute(
      'class',
      `direction-arrow fill-white text-white drop-shadow transition-all duration-300 ${
        isSelected ? 'w-7 h-7' : 'w-4 h-4'
      }`,
    );
  }

  // 3. Package Badge
  const packageBadge = el.querySelector('.parcel-badge') as HTMLElement | null;
  if (packageBadge) {
    packageBadge.className = `parcel-badge absolute rounded-full bg-amber-400 border-2 border-slate-950 text-slate-950 flex items-center justify-center shadow-lg font-bold select-none ${
      isSelected ? 'w-6 h-6 text-xs -top-2 -right-2' : 'w-4 h-4 text-[9px] -top-1 -right-1'
    }`;
    packageBadge.style.display = hasActiveOrder ? 'flex' : 'none';
  }

  // 4. Floating Bold Pill
  const pill = el.querySelector('.marker-pill') as HTMLElement | null;
  if (pill) {
    pill.style.display = isSelected ? 'flex' : 'none';
    if (name) {
      pill.innerHTML = `
        <div class="px-3 py-1.5 rounded-full bg-slate-950/95 border-2 border-amber-400 text-white shadow-2xl flex items-center gap-2 font-bold text-xs tracking-tight">
          <span class="w-2.5 h-2.5 rounded-full ${color.bg} animate-pulse"></span>
          <span class="text-white font-bold">${name}</span>
          ${
            hasActiveOrder
              ? `<span class="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  📦 ${customerName ? `Delivering to ${customerName}` : 'Holding Parcel'}
                </span>`
              : ''
          }
        </div>
        <div class="w-2.5 h-2.5 bg-slate-950 border-r-2 border-b-2 border-amber-400 rotate-45 -mt-1.5"></div>
      `;
    }
  }

  // 5. Hover Tooltip
  const tooltip = el.querySelector('.marker-tooltip') as HTMLElement | null;
  if (tooltip) {
    tooltip.style.display = isSelected ? 'none' : '';
    const nameSpan = tooltip.querySelector('.font-medium');
    if (nameSpan && name) {
      nameSpan.textContent = name;
    }
    const speedSpan = tooltip.querySelector('.text-slate-400');
    if (speedSpan && speed !== undefined) {
      speedSpan.textContent = `(${speed} km/h)`;
    }
  }
}
