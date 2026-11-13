import { useEffect } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

const iconoCd = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:4px;background:#041E42;border:3px solid #FFC220;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function Ajustar({
  lat,
  lng,
  radio,
  punto,
}: {
  lat: number;
  lng: number;
  radio: number;
  punto?: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    const b = L.latLng(lat, lng).toBounds(radio * 2.2);
    if (punto) b.extend([punto.lat, punto.lng]);
    map.fitBounds(b, { padding: [20, 20] });
  }, [map, lat, lng, radio, punto]);
  return null;
}

function Clic({ onMover }: { onMover: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMover(e.latlng.lat, e.latlng.lng) });
  return null;
}

interface Props {
  lat: number;
  lng: number;
  radioValido: number;
  radioAlerta: number;
  alto?: number;
  /** Lugar donde marcó el guardia (alertas). */
  punto?: { lat: number; lng: number } | null;
  editable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  etiqueta?: string;
}

/** Mapa OpenStreetMap con la geocerca: círculo válido (azul) y círculo de alerta (rojo punteado). */
export function MapaCd({
  lat,
  lng,
  radioValido,
  radioAlerta,
  alto = 300,
  punto,
  editable,
  onMover,
  etiqueta,
}: Props) {
  return (
    <div
      style={{ height: alto }}
      className="relative z-0 w-full"
      role="region"
      aria-label={etiqueta ?? 'Mapa de la geocerca del CD'}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Ajustar lat={lat} lng={lng} radio={radioAlerta} punto={punto} />
        <Circle
          center={[lat, lng]}
          radius={radioAlerta}
          pathOptions={{ color: '#C0392B', weight: 2, dashArray: '6 6', fill: false }}
        >
          <Tooltip sticky>
            Alerta a más de {radioAlerta >= 1000 ? `${radioAlerta / 1000} km` : `${radioAlerta} m`}
          </Tooltip>
        </Circle>
        <Circle
          center={[lat, lng]}
          radius={radioValido}
          pathOptions={{ color: '#0071CE', weight: 2, fillColor: '#0071CE', fillOpacity: 0.18 }}
        >
          <Tooltip sticky>Marca válida hasta {radioValido} m</Tooltip>
        </Circle>
        <Marker
          position={[lat, lng]}
          icon={iconoCd}
          draggable={!!editable}
          keyboard={!!editable}
          eventHandlers={
            editable && onMover
              ? {
                  dragend: (e) => {
                    const p = (e.target as L.Marker).getLatLng();
                    onMover(p.lat, p.lng);
                  },
                }
              : undefined
          }
        />
        {editable && onMover && <Clic onMover={onMover} />}
        {punto && (
          <CircleMarker
            center={[punto.lat, punto.lng]}
            radius={9}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#D93A26', fillOpacity: 1 }}
          >
            <Tooltip permanent direction="right">
              Marca
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
