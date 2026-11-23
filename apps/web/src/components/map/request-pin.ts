export function createRequestPinElement(
  type: 'pickup' | 'dropoff',
  id: string,
  customerName?: string,
  neighborhood?: string,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'fleet-request-pin cursor-pointer relative group';

  const isPickup = type === 'pickup';
  const bgClass = isPickup ? 'bg-blue-600' : 'bg-purple-600';
  const label = isPickup ? 'P' : 'D';
  const roleTitle = isPickup ? 'Pickup' : 'Dropoff';
  const locationTag = neighborhood ? ` (${neighborhood})` : '';
  const customerTag = customerName ? `${customerName} • ` : '';

  container.innerHTML = `
    <div class="w-6 h-6 rounded-full ${bgClass} text-white font-bold text-[11px] flex items-center justify-center shadow-md border border-white">
      ${label}
    </div>
    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap">
      <div class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-md">
        <span class="font-semibold text-emerald-400">${roleTitle}:</span> ${customerTag}${id.slice(0, 6)}${locationTag}
      </div>
    </div>
  `;

  return container;
}
