import type { MapStyleElement } from 'react-native-maps';

/**
 * Soft blue-gray dark theme for Google Maps (Android). Low contrast, muted labels.
 */
export const SOOTHING_DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#2a2d35' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#2a2d35' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3d424d' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#31353f' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#363b47' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2c3834' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5c6d66' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#404550' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2a2d35' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#4f5664' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#353945' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#363b47' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e2a33' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a6b78' }] },
];
