// API pública da feature de mapa (o que outras features podem importar).
export { floorKeys, useFloorPins, useFloors, useMapPoints } from "./api";
export { FloorElevator } from "./components/FloorElevator";
export {
  clamp,
  FloorPlanImage,
  MapCanvas,
  MapPointMark,
  MapShapeView,
  SHAPE_KIND_LABEL,
  StorePinMark,
  snap,
  useSvgPoint,
  VIEW_H,
  VIEW_W,
} from "./components/map-canvas";
