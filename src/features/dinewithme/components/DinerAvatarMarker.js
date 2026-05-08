/**
 * DinerAvatarMarker — Leaflet custom marker showing a diner's avatar
 * with a pulsing ring color-coded by status.
 *
 * Status colors:
 *   looking   → emerald/green
 *   eating    → blue
 *   heading_to → amber
 */
import L from 'leaflet'

const STATUS_COLORS = {
    looking: '#10b981',    // emerald-500
    eating: '#3b82f6',     // blue-500
    heading_to: '#f59e0b', // amber-500
}

/**
 * Create a Leaflet divIcon for a diner avatar marker.
 *
 * @param {Object} diner
 * @param {string} diner.avatarUrl - Avatar image URL
 * @param {string} diner.displayName - e.g. "Anna K."
 * @param {string} diner.venueName - e.g. "Pod Aniolem"
 * @param {'looking'|'eating'|'heading_to'} diner.status
 * @param {number} diner.pingOffset - 0..1 offset for desynchronized pulse animation
 * @returns {L.DivIcon}
 */
export function createDinerMarkerIcon({ avatarUrl, displayName, venueName, status = 'looking', pingOffset = 0, isOwn = false }) {
    const color = STATUS_COLORS[status] || STATUS_COLORS.looking

    // Desynchronized ping animation (0.7s stagger per diner)
    const animDelay = `${(pingOffset * 2.1).toFixed(1)}s`
    const size = isOwn ? 48 : 40
    const borderW = isOwn ? 3.5 : 2.5
    const fontSize = isOwn ? 16 : 13

    const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
           <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:${color};color:white;font-size:${fontSize}px;font-weight:700;">${displayName[0]}</div>`
        : `<div style="width:100%;height:100%;align-items:center;justify-content:center;background:${color};color:white;font-size:${fontSize}px;font-weight:700;display:flex;">${displayName[0]}</div>`

    // Own marker gets a double ring (white + color) to stand out
    const ownRing = isOwn ? `
        <div style="
            position:absolute;
            inset:-8px;
            border-radius:50%;
            border:3px solid white;
            opacity:0.7;
            z-index:1;
       "></div>` : ''

    return L.divIcon({
        className: '',
        html: `
            <div style="position:relative;width:${size}px;height:${size}px;">
                <!-- Pulse ring -->
                <div style="
                    position:absolute;
                    inset:-6px;
                    border-radius:50%;
                    border:2px solid ${color};
                    animation:diner-ping 3s cubic-bezier(0,0,0.2,1) infinite;
                    animation-delay:${animDelay};
                    opacity:0;
                "></div>
                ${ownRing}
                <!-- Avatar circle -->
                <div style="
                    width:${size}px;height:${size}px;
                    border-radius:50%;
                    border:${borderW}px solid ${color};
                    overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.3);
                    position:relative;
                    z-index:2;
                ">
                    ${avatarHtml}
                </div>
            </div>
            <style>
                @keyframes diner-ping {
                    0% { transform:scale(1); opacity:0.4; }
                    50% { transform:scale(1.6); opacity:0; }
                    100% { transform:scale(1); opacity:0; }
                }
            </style>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2 + 4)],
    })
}

export default createDinerMarkerIcon
