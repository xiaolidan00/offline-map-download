import proj4 from 'proj4';
export type LngLatXY = [number, number];
class Transformation {
  private _a: number;
  private _b: number;
  private _c: number;
  private _d: number;
  constructor(a: number, b: number, c: number, d: number) {
    this._a = a;
    this._b = b;
    this._c = c;
    this._d = d;
  }
  untransform(xy: LngLatXY, scale: number): LngLatXY {
    scale = scale || 1;
    const x = (xy[0] / scale - this._b) / this._a;
    const y = (xy[1] / scale - this._d) / this._c;
    return [x, y];
  }
  transform(xy: LngLatXY, scale: number): LngLatXY {
    scale = scale || 1;
    const x = scale * (this._a * xy[0] + this._b);
    const y = scale * (this._c * xy[1] + this._d);
    return [x, y];
  }
}

function closestElement(array: number[], element: number) {
  let low;
  for (let i = array.length; i--; ) {
    if (array[i] <= element && (low === undefined || low < array[i])) {
      low = array[i];
    }
  }
  return low;
}
export type ProjConfigType = {
  name: string;
  config: string;
  origin?: LngLatXY;
  resolutions?: number[];
};
const EARTH_R = 6378137;
export const getProjection = (projConfig: ProjConfigType, tileSize = 256) => {
  const {name, config, origin, resolutions} = projConfig;
  //定义投影
  proj4.defs(name, config);

  const scales: number[] = [];
  //lods配置
  if (resolutions?.length) {
    for (let i = resolutions.length - 1; i >= 0; i--) {
      if (resolutions[i]) {
        scales[i] = 1 / resolutions[i];
      }
    }
  }
  return {
    origin,
    name,
    config,
    resolutions,
    _scales: scales,
    //坐标偏移
    transformation: (function () {
      //原点位置偏移
      if (origin?.length) {
        return new Transformation(1, -origin[0], -1, origin[1]);
      }
      const scale = 0.5 / (Math.PI * EARTH_R);
      return new Transformation(scale, 0.5, -scale, 0.5);
    })(),
    //投影坐标
    project(lnglat: LngLatXY): LngLatXY {
      return proj4(name).forward(lnglat);
    },
    //逆投影坐标
    unproject(xy: LngLatXY): LngLatXY {
      return proj4(name).inverse(xy);
    },
    //该缩放等级的像素大小
    scale(zoom: number) {
      //lods等级的像素大小
      if (resolutions?.length) {
        let iZoom = Math.floor(zoom),
          baseScale,
          nextScale,
          scaleDiff,
          zDiff;
        if (zoom === iZoom) {
          return scales[zoom];
        } else {
          // Non-integer zoom, interpolate
          baseScale = scales[iZoom];
          nextScale = scales[iZoom + 1];
          scaleDiff = nextScale - baseScale;
          zDiff = zoom - iZoom;
          return baseScale + scaleDiff * zDiff;
        }
      }
      return tileSize * Math.pow(2, zoom);
    },
    //该像素大小的缩放等级
    zoom(scale: number) {
      //lods缩放等级
      if (resolutions?.length) {
        // Find closest number in this._scales, down
        let downScale = closestElement(scales, scale);
        let downZoom = scales.indexOf(downScale!),
          nextScale,
          nextZoom,
          scaleDiff;
        // Check if scale is downScale => return array index
        if (scale === downScale) {
          return downZoom;
        }
        if (downScale === undefined) {
          return -Infinity;
        }
        // Interpolate
        nextZoom = downZoom + 1;
        nextScale = scales[nextZoom];
        if (nextScale === undefined) {
          return Infinity;
        }
        scaleDiff = nextScale - downScale;
        return (scale - downScale) / scaleDiff + downZoom;
      }
      return Math.log(scale / tileSize) / Math.LN2;
    },
    //经纬度转像素坐标
    lnglat2px(lnglat: LngLatXY, zoom: number): LngLatXY {
      const p = this.project(lnglat);
      const scale = this.scale(zoom);
      return this.transformation.transform(p, scale);
    },
    //像素坐标转经纬度
    px2lnglat(xy: LngLatXY, zoom: number): LngLatXY {
      const scale = this.scale(zoom);
      const p = this.transformation.untransform(xy, scale);
      return this.unproject(p);
    },
    //米转像素
    meter2px(meters: number, zoom: number) {
      const center: LngLatXY = [114, 39];
      const centerPoint = this.lnglat2px(center, zoom);

      const offsetPoint = this.lnglat2px([center[0], center[1] - 1], zoom);
      const distance = 102688.1965260058;

      // 计算像素距离
      const r = Math.round(
        meters *
          (Math.sqrt(
            Math.pow(offsetPoint[0] - centerPoint[0], 2) +
              Math.pow(offsetPoint[1] - centerPoint[1], 2)
          ) /
            distance)
      );

      return r;
    }
  };
};
