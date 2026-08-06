import {cloneDeep} from 'lodash-es';
import {ref} from 'vue';
import type {LngLatXY} from '../utils/projection';

export const defaultStore = {
  loading: false,
  current: 0,
  total: 0,
  currentAction: ''
};
export const store = ref(cloneDeep(defaultStore));
export const defaultmapconfig = {
  isGc: false,
  isGrid: false,
  zoom: 10,
  center: [114.15092762998268, 22.65201671703231] as [number, number],

  maxZoom: 18,
  minZoom: 3,

  tileSize: 256,
  tileUrl: 'http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}',
  isProject: false,
  crsName: 'EPSG:3857',
  crsConfig:
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',

  origin: '',
  resolutions: '',
  minLevel: 6,
  maxLevel: 8,
  bounds: [] as any[],
  isFull: false,
  isSplit: false,
  spliteNum: 1000,
  areaBounds: [
    [0, 0],
    [0, 0]
  ] as [LngLatXY, LngLatXY],
  currentArea: '',
  areaCenter: [0, 0] as LngLatXY,
  isGeosjonText: false,
  geojsonList: [] as any[],
  geojsonBounds: [
    [0, 0],
    [0, 0]
  ] as [LngLatXY, LngLatXY]
};
let mapc = cloneDeep(defaultmapconfig);
const mapconfig = localStorage.getItem('mapconfig');
if (mapconfig) {
  try {
    const obj: any = JSON.parse(mapconfig);
    for (const k in obj) {
      //@ts-ignore
      mapc[k] = obj[k];
    }
  } catch (error) {}
}
export const mapstore = ref(mapc);
