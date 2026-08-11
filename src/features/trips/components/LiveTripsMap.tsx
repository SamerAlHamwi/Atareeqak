import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LiveTrip } from '../hooks/useLiveTrips';

interface LiveTripsMapProps {
  trips: LiveTrip[];
  selectedTripId: number | null;
  isLoading: boolean;
  /** Timestamp of the last successful /admin/trips/live poll. */
  updatedAt?: Date | null;
}

// Palette hexes mirror tailwind.config.js (primary / secondary / error) —
// Leaflet vector layers take raw color strings, not CSS classes.
const COLORS = {
  route: '#000666',
  routeSelected: '#006a6a',
  pickup: '#006a6a',
  destination: '#ba1a1a',
};

// Syria-centered default view for the empty map
const DEFAULT_CENTER: [number, number] = [35.0, 38.5];
const DEFAULT_ZOOM = 7;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export const LiveTripsMap: React.FC<LiveTripsMapProps> = ({
  trips,
  selectedTripId,
  isLoading,
  updatedAt = null,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const updatedLabel = updatedAt
    ? updatedAt.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Redraw trip layers whenever data or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const bounds = L.latLngBounds([]);

    trips.forEach((trip) => {
      const isSelected = trip.id === selectedTripId;
      const popupHtml = `
        <div dir="${isRtl ? 'rtl' : 'ltr'}" style="font-family: inherit; min-width: 180px;">
          <strong>${escapeHtml(trip.tripRef)}</strong><br/>
          ${escapeHtml(t('trips.map_popup_driver'))}: ${escapeHtml(trip.driverName)}<br/>
          ${escapeHtml(trip.from)} ← ${escapeHtml(trip.to)}<br/>
          ${escapeHtml(t('trips.map_popup_eta'))}: ${
            trip.etaMinutes != null
              ? escapeHtml(t('trips.eta_value', { count: trip.etaMinutes }))
              : '--'
          }<br/>
          ${escapeHtml(t('trips.map_popup_passengers'))}: ${trip.passengerCount}
        </div>`;

      if (trip.path.length >= 2) {
        const line = L.polyline(trip.path, {
          color: isSelected ? COLORS.routeSelected : COLORS.route,
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 0.95 : 0.6,
        }).addTo(layers);
        line.bindPopup(popupHtml);
        bounds.extend(line.getBounds());
      }

      if (trip.pickupCoords) {
        const pickup = L.circleMarker([trip.pickupCoords.lat, trip.pickupCoords.lng], {
          radius: isSelected ? 8 : 6,
          color: '#ffffff',
          weight: 2,
          fillColor: COLORS.pickup,
          fillOpacity: 1,
        }).addTo(layers);
        pickup.bindPopup(popupHtml);
        bounds.extend([trip.pickupCoords.lat, trip.pickupCoords.lng]);
      }

      if (trip.destinationCoords) {
        const destination = L.circleMarker(
          [trip.destinationCoords.lat, trip.destinationCoords.lng],
          {
            radius: isSelected ? 8 : 6,
            color: '#ffffff',
            weight: 2,
            fillColor: COLORS.destination,
            fillOpacity: 1,
          }
        ).addTo(layers);
        destination.bindPopup(popupHtml);
        bounds.extend([trip.destinationCoords.lat, trip.destinationCoords.lng]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [trips, selectedTripId, isRtl, t]);

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Live badge + last-poll timestamp */}
      <div className="absolute top-4 start-4 z-[500] pointer-events-none flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md">
          <span className="relative flex w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-error"></span>
          </span>
          <span data-testid="live-trips-badge" className="text-xs font-bold text-on-surface">
            {t('trips.live_now', { count: trips.length })}
          </span>
        </div>
        {updatedLabel && (
          <div
            data-testid="live-updated-at"
            className="bg-surface-container-lowest/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md text-[10px] font-bold text-on-surface-variant"
            title={t('trips.map_update_freq')}
          >
            {t('trips.updated_at', { time: updatedLabel })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 start-4 z-[500] pointer-events-none">
        <div className="bg-surface-container-lowest/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-md flex items-center gap-4 text-[10px] font-bold text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
            {t('trips.map_pickup')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error inline-block"></span>
            {t('trips.map_destination')}
          </span>
        </div>
      </div>

      {/* Empty / loading overlay */}
      {(isLoading || trips.length === 0) && (
        <div className="absolute inset-0 z-[500] bg-surface/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-surface-container-lowest px-6 py-3 rounded-2xl shadow-md text-sm font-bold text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">
              {isLoading ? 'progress_activity' : 'explore_off'}
            </span>
            {isLoading ? t('common.loading') : t('trips.no_live_trips')}
          </div>
        </div>
      )}
    </div>
  );
};
