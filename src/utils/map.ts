import {debounce} from 'lodash-es';
import proj4 from 'proj4';
import {EventEmitter} from './EventEmitter';
import {getProjection, type ProjConfigType, type LngLatXY} from './projection';
import {gcTowgs84, travelGeo} from './utils';
type MapOptions = {
  projConfig?: ProjConfigType;
  center: LngLatXY;
  zoom: number;
  container: HTMLElement;
  minZoom: number;
  maxZoom: number;
  tileUrl?: string;
  tileSize?: number;
};

export class MyMap {
  tileSize = 256;
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  center: LngLatXY = [116.407387, 39.904179];
  zoom = 4;
  wheelCount = 0;
  defaultProjectConfig: ProjConfigType = {
    name: 'EPSG:3857',
    config:
      '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs'
  };

  projection;

  tileStart: LngLatXY = [0, 0];
  tileEnd: LngLatXY = [0, 0];

  cacheTiles: {[n: string]: HTMLImageElement | null} = {};

  options: MapOptions;
  events: EventEmitter = new EventEmitter();
  isGc = false;
  tileUrl = 'http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}';
  constructor(options: MapOptions) {
    this.options = options;
    if (options.tileSize) {
      this.tileSize = options.tileSize;
    }
    if (options.tileUrl) {
      this.tileUrl = options.tileUrl;
    }

    this.projection = getProjection(options.projConfig || this.defaultProjectConfig, this.tileSize);
    this.center = options.center;
    this.zoom = Math.ceil(options.zoom);
    this.container = options.container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.container.appendChild(this.canvas);

    //监听
    this.onListener();
    //绘制图层
    this.debounceDrawLayer = debounce(this.drawLayer.bind(this), 100);
  }
  on(eventName: string, cb: Function) {
    this.events.on(eventName, cb);
  }
  off(eventName: string, cb: Function) {
    this.events.off(eventName, cb);
  }
  debounceDrawLayer: Function = () => {};
  onWheel: Function = () => {};
  onResize: Function = () => {};
  onClick: Function = () => {};
  onListener() {
    this.onWheel = debounce((ev: WheelEvent) => {
      if (ev.deltaY > 0) {
        //down
        this.setZoom(this.zoom - 1);
      } else {
        //up
        this.setZoom(this.zoom + 1);
      }
      this.events.emit('zoomend', this.zoom);
    }, 100);
    const resize = () => {
      const size = this.getMapSize();

      this.canvas.width = size[0];
      this.canvas.height = size[1];
      this.drawLayer();
    };
    this.onResize = debounce(resize, 100);
    resize();
    this.onClick = debounce(this.onMouseClick.bind(this), 100);
    window.addEventListener('resize', this.onResize.bind(this));
    if (this.canvas) {
      this.canvas.oncontextmenu = (ev) => {
        this.onClick(ev);
        ev.preventDefault();
        return false;
      };
      // this.canvas.addEventListener('click', this.onClick.bind(this));
      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    }

    window.addEventListener('unload', this.offListener.bind(this));
  }
  dispose() {
    this.shape = [];
    this.events.clear();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offListener();
    this.container.removeChild(this.canvas);
  }
  offListener() {
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.canvas) {
      this.canvas.oncontextmenu = null;
      this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
      // this.canvas.removeEventListener('click', this.onClick.bind(this));
      this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
      this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
    }
    this.events.clear();
  }
  onMouseClick(ev: MouseEvent) {
    //根据新的中心点像素坐标计算出新的经纬度坐标
    const point = this.canvas2lnglat([ev.offsetX, ev.offsetY]);
    // console.log(point);
    this.events.emit('click', {
      event: ev,
      lngLat: point
    });
  }

  state = {
    offsetx: 0,
    offsety: 0,
    x: 0,
    y: 0,
    startx: 0,
    starty: 0,
    endx: 0,
    endy: 0,
    enable: false,
    move: false,
    minMove: 5,
    clickable: false
  };
  onMouseDown(ev: MouseEvent) {
    if (ev.target !== this.canvas) return;
    const state = this.state;
    state.x = ev.pageX;
    state.y = ev.pageY;
    state.startx = ev.offsetX;
    state.starty = ev.offsetY;
    state.endx = ev.offsetX;
    state.endy = ev.offsetY;
    state.offsetx = 0;
    state.offsety = 0;
    state.enable = true;
    state.move = false;

    this.events.emit('movestart');
  }
  onMouseMove(ev: MouseEvent) {
    const state = this.state;
    if (state.enable) {
      state.offsetx += ev.pageX - state.x;
      state.offsety += ev.pageY - state.y;
      state.x = ev.pageX;
      state.y = ev.pageY;
      state.endx = state.startx + state.offsetx;
      state.endy = state.starty + state.offsety;
      if (Math.abs(state.offsetx) >= state.minMove || Math.abs(state.offsety) >= state.minMove) {
        state.move = true;
        this.events.emit('move');
      }
    }
  }
  toWgs84(lnglat: LngLatXY) {
    return proj4(this.projection.config, '+proj=longlat +datum=WGS84 +no_defs', lnglat);
  }

  onMouseUp(ev: MouseEvent) {
    const state = this.state;

    if (state.enable && state.move) {
      //新的中心点像素坐标=旧的中心点像素坐标-鼠标移动距离
      const newtileCenter: LngLatXY = [
        this.tileCenter[0] - state.offsetx,
        this.tileCenter[1] - state.offsety
      ];
      //根据新的中心点像素坐标计算出新的经纬度坐标
      const center = this.xy2lnglat(newtileCenter);
      this.setCenter(center);

      this.events.emit('moveend'); //cb
    } else {
      this.onClick(ev);
    }
    state.move = false;
    state.enable = false;
  }
  setZoom(z: number) {
    let zz = Math.round(z);
    if (zz < this.options.minZoom) {
      zz = this.options.minZoom;
    } else if (zz > this.options.maxZoom) {
      zz = this.options.maxZoom;
    }
    this.zoom = zz;
    this.debounceDrawLayer();
  }
  getCenter() {
    return this.center;
  }
  getZoom() {
    return this.zoom;
  }
  setCenter(center: LngLatXY) {
    this.center = center;
    this.debounceDrawLayer();
  }
  setView(center: LngLatXY, z: number) {
    this.center = center;
    let zz = Math.round(z);
    if (zz < this.options.minZoom) {
      zz = this.options.minZoom;
    } else if (zz > this.options.maxZoom) {
      zz = this.options.maxZoom;
    }
    this.zoom = zz;
    this.debounceDrawLayer();
  }

  //适配屏幕大小和边距
  fitBounds({
    bounds,
    zoomRange,

    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight
  }: {
    bounds: [LngLatXY, LngLatXY];
    zoomRange?: [number, number];

    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
  }) {
    const [startPoint, endPoint] = bounds;
    const w = this.container.offsetWidth,
      h = this.container.offsetHeight;
    const viewWidth = w - (paddingLeft || 0) - (paddingRight || 0);
    const viewHeight = h - (paddingTop || 0) - (paddingBottom || 0);
    const start: LngLatXY = [
      Math.min(startPoint[0], endPoint[0]),
      Math.min(startPoint[1], endPoint[1])
    ];
    const end: LngLatXY = [
      Math.max(startPoint[0], endPoint[0]),
      Math.max(startPoint[1], endPoint[1])
    ];
    const center: LngLatXY = [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5];
    let zoom: number = 3;
    let ww = 0,
      hh = 0;
    let flag = false;
    let minZoom = this.options.minZoom;
    let maxZoom = this.options.maxZoom;
    if (zoomRange) {
      minZoom = zoomRange[0];
      maxZoom = zoomRange[1];
    }

    for (zoom = minZoom; zoom <= maxZoom; zoom++) {
      const p = this.lnglat2xy(start, zoom);

      const p1 = this.lnglat2xy(end, zoom);

      ww = Math.abs(p1[0] - p[0]);
      hh = Math.abs(p1[1] - p[1]);
      if (ww >= viewWidth && hh >= viewHeight) {
        flag = true;
        zoom = zoom - 1;
        break;
      }
    }
    if (!flag) {
      zoom = maxZoom;
    }

    const move = [
      ((paddingLeft || 0) - (paddingRight || 0)) * 0.5,
      ((paddingTop || 0) - (paddingBottom || 0)) * 0.5
    ];
    const c = this.projection.lnglat2px(center, zoom);
    const newCenter = this.xy2lnglat([c[0] - move[0], c[1] - move[1]], zoom);
    this.setView(newCenter, zoom);
    return {zoom, center: newCenter};
  }
  shape: any[] = [];
  addShape(item: any) {
    const idx = this.shape.findIndex((a: any) => a.id === item.id);
    if (idx >= 0) {
      this.shape[idx] = item;
    } else {
      this.shape.push(item);
    }
    this.debounceDrawLayer();
  }
  removeShape(id: string) {
    const idx = this.shape.findIndex((a) => a.id === id);
    if (idx >= 0) {
      this.shape.splice(idx, 1);
    }
    this.debounceDrawLayer();
  }
  drawShape(ctx1?: CanvasRenderingContext2D, pointFun?: Function) {
    const pFun = pointFun ?? this.lnglat2Canvas.bind(this);
    const ctx = ctx1 ?? this.ctx;
    const setBlur = (style: any) => {
      // 1. 设置阴影样式
      ctx.shadowColor = style.shadowColor || 'transparent';
      ctx.shadowBlur = style.shadowBlur || 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };
    const unBlur = () => {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };
    const setShape = (style: any) => {
      let tag = false;
      if (style.fill) {
        setBlur(style);
        ctx.globalAlpha = style.fillOpacity ?? 1;
        ctx.fillStyle = style.fillColor;
        ctx.fill();
        tag = true;
        unBlur();
      }

      if (style.stroke && style.weight !== 0) {
        if (!tag) {
          setBlur(style);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = style.opacity ?? 1;
        ctx.lineWidth = style.weight;
        ctx.strokeStyle = style.color;
        ctx.stroke();
        unBlur();
      }
    };
    const reset = () => {
      ctx.fillStyle = 'transparent';
      ctx.strokeStyle = 'transparent';
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 0;
      ctx.globalAlpha = 1;
    };
    this.shape.forEach((item: any) => {
      ctx.beginPath();

      const style = item.style;
      if (item.type === 'rect') {
        let tag = false;
        const p1 = pFun(item.bounds[0]);
        const p2 = pFun(item.bounds[1]);

        if (style.fill) {
          setBlur(style);
          ctx.globalAlpha = style.fillOpacity ?? 1;
          ctx.fillStyle = style.fillColor;
          ctx.fillRect(
            Math.min(p1[0], p2[0]),
            Math.min(p1[1], p2[1]),
            Math.abs(p2[0] - p1[0]),
            Math.abs(p2[1] - p1[1])
          );
          unBlur();
          tag = true;
        }

        if (style.stroke && style.weight !== 0) {
          if (!tag) {
            setBlur(style);
          }
          ctx.globalAlpha = style.opacity ?? 1;
          ctx.lineWidth = style.weight;
          ctx.strokeStyle = style.color;
          ctx.strokeRect(
            Math.min(p1[0], p2[0]),
            Math.min(p1[1], p2[1]),
            Math.abs(p2[0] - p1[0]),
            Math.abs(p2[1] - p1[1])
          );
          unBlur();
        }
      } else if (item.type === 'point') {
        const [x, y] = pFun(item.lnglat);
        ctx.arc(x, y, style.radius, 0, 2 * Math.PI);
        setShape(style);
      } else if (item.type === 'text') {
        const [x, y] = pFun(item.lnglat);
        setBlur(style);
        ctx.font = `${style.fontSize || 12}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = style.color ?? 'black';
        ctx.fillText(item.text, x + (item.offsetX || 0), y + (item.offsetY || 0));
        unBlur();
      } else if (item.type === 'polygon' && item.path?.length) {
        item.path.forEach((lnglat: LngLatXY, i: number) => {
          const [x, y] = pFun(lnglat);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();

        setShape(style);
      } else if (item.type === 'line' && item.path?.length) {
        item.path.forEach((lnglat: LngLatXY, i: number) => {
          const [x, y] = pFun(lnglat);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        setShape(style);
      }
      reset();
    });
  }

  getMapSize() {
    return [this.container.clientWidth, this.container.clientHeight];
  }
  //经纬度转canvas上的像素坐标
  lnglat2Canvas(lnglat: LngLatXY): LngLatXY {
    const [x, y] = this.lnglat2xy(lnglat);
    return [x - this.tileStart[0], y - this.tileStart[1]];
  }
  canvas2lnglat(xy: LngLatXY) {
    return this.xy2lnglat([xy[0] + this.tileStart[0], xy[1] + this.tileStart[1]]);
  }
  xy2lnglat(xy: LngLatXY, zoom?: number) {
    return this.projection.px2lnglat(xy, zoom ?? this.zoom);
  }
  lnglat2xy(lnglat: LngLatXY, zoom?: number) {
    return this.projection.lnglat2px(lnglat, zoom ?? this.zoom);
  }
  getBounds() {
    //中心经纬度转像素坐标
    const tileCenter = this.lnglat2xy(this.center);
    //canvas大小
    const mapSize = this.getMapSize();
    //取一半，获取左上点和右下点相对于中心点的像素坐标
    const halfWidth = mapSize[0] * 0.5;
    const halfHeight = mapSize[1] * 0.5;
    const start: LngLatXY = [tileCenter[0] - halfWidth, tileCenter[1] - halfHeight];
    const end: LngLatXY = [tileCenter[0] + halfWidth, tileCenter[1] + halfHeight];
    return [this.xy2lnglat(start), this.xy2lnglat(end)];
  }
  getTileBounds(center?: LngLatXY, zoom?: number) {
    //中心经纬度转像素坐标
    const tileCenter = this.lnglat2xy(center ?? this.center, zoom ?? this.zoom);
    //canvas大小
    const mapSize = this.getMapSize();
    //取一半，获取左上点和右下点相对于中心点的像素坐标
    const halfWidth = mapSize[0] * 0.5;
    const halfHeight = mapSize[1] * 0.5;
    const start: LngLatXY = [tileCenter[0] - halfWidth, tileCenter[1] - halfHeight];
    const end: LngLatXY = [tileCenter[0] + halfWidth, tileCenter[1] + halfHeight];
    //瓦片底图是tileSize x tileSize大小的图片，计算瓦片范围
    const bounds = [
      [Math.floor(start[0] / this.tileSize), Math.floor(start[1] / this.tileSize)],
      [Math.ceil(end[0] / this.tileSize), Math.ceil(end[1] / this.tileSize)]
    ];
    return {
      tileCenter,
      bounds,
      start,
      end,
      //瓦片开始像素坐标相对canvas可视范围的左上点像素坐标偏移
      offset: [bounds[0][0] * this.tileSize - start[0], bounds[0][1] * this.tileSize - start[1]]
    };
  }
  getTileImage(x: number, y: number, z: number) {
    return new Promise<HTMLImageElement | null>((resolve, reject) => {
      const id = `${x}-${y}-${z}`;
      //缓存瓦片底图
      if (this.cacheTiles[id] !== undefined) {
        resolve(this.cacheTiles[id]);
      } else {
        //加载瓦片底图
        const url = this.tileUrl
          .replace('{x}', String(x))
          .replace('{y}', String(y))
          .replace('{z}', String(z));
        const image = new Image();
        image.src = url;
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          this.cacheTiles[id] = image;
          resolve(image);
        };
        image.onerror = () => {
          this.cacheTiles[id] = null;
          reject(image);
        };
      }
    });
  }
  isGrid = false;
  async drawTileImage(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    z: number,
    imageX: number,
    imageY: number,
    noGrid?: boolean
  ) {
    try {
      const image = await this.getTileImage(x, y, z);
      if (image) {
        ctx.drawImage(image, imageX, imageY);
      }
    } catch (error) {}
    if (noGrid) return;
    if (this.isGrid) {
      const h = this.tileSize * 0.5;
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '20px Arial';
      ctx.fillText(`${z}/${y}/${x}`, imageX + h, imageY + h);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(imageX, imageY, this.tileSize, this.tileSize);
    }
  }
  getTileInfo(rect: [LngLatXY, LngLatXY], zoom: number) {
    const p1: LngLatXY = this.lnglat2xy(rect[0], zoom);
    const p2: LngLatXY = this.lnglat2xy(rect[1], zoom);
    const start = [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1])];
    const end = [Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])];
    // 计算瓦片范围
    const bounds = [
      [Math.floor(start[0] / this.tileSize), Math.floor(start[1] / this.tileSize)],
      [Math.ceil(end[0] / this.tileSize), Math.ceil(end[1] / this.tileSize)]
    ];
    return {
      start,
      end,
      bounds,

      offset: [bounds[0][0] * this.tileSize - start[0], bounds[0][1] * this.tileSize - start[1]]
    };
  }
  getTileList(rect: [LngLatXY, LngLatXY], zoom: number) {
    const {bounds} = this.getTileInfo(rect, zoom);

    const queue: any[] = [];
    for (let x = bounds[0][0], i = 0; x < bounds[1][0]; x++, i++) {
      for (let y = bounds[0][1], j = 0; y < bounds[1][1]; y++, j++) {
        const url = this.tileUrl
          .replace('{x}', String(x))
          .replace('{y}', String(y))
          .replace('{z}', String(zoom));
        queue.push({
          x,
          y,
          z: zoom,
          url
        });
      }
    }
    return queue;
  }

  async drawAreaCanvas(geojson: any, rect: [LngLatXY, LngLatXY], zoom: number, isTile?: boolean) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const tileSize = this.tileSize;
    const {bounds, offset, start, end} = this.getTileInfo(rect, zoom);
    if (isTile) {
      canvas.width = (bounds[1][0] - bounds[0][0]) * tileSize;
      canvas.height = (bounds[1][1] - bounds[0][1]) * tileSize;
    } else {
      canvas.width = end[0] - start[0];
      canvas.height = end[1] - start[1];
    }
    //绘制遮罩
    const maskPath = new Path2D();
    travelGeo(geojson, (paths: Array<[number, number]>) => {
      const r = new Path2D();
      paths.forEach((a, index: number) => {
        const b = this.isGc ? a : gcTowgs84(a[0], a[1]);
        const p = this.lnglat2xy(b, zoom);
        const point = isTile
          ? [p[0] - start[0] - offset[0], p[1] - start[1] - offset[1]]
          : [p[0] - start[0], p[1] - start[1]];
        if (index === 0) r.moveTo(point[0], point[1]);
        else r.lineTo(point[0], point[1]);
      });
      r.closePath();
      maskPath.addPath(r);
    });

    const queue = [];
    for (let x = bounds[0][0], i = 0; x < bounds[1][0]; x++, i++) {
      for (let y = bounds[0][1], j = 0; y < bounds[1][1]; y++, j++) {
        queue.push({
          x,
          y,
          imageX: isTile ? i * tileSize : i * tileSize + offset[0],
          imageY: isTile ? j * tileSize : j * tileSize + offset[1]
        });
      }
    }
    if (!isTile) {
      //排序优先绘制有缓存的瓦片
      queue.sort((a: any, b: any) => {
        const id1 = `${a.x}-${a.y}-${zoom}`;
        const id2 = `${b.x}-${b.y}-${zoom}`;
        if (this.cacheTiles[id1]) return -1;
        if (this.cacheTiles[id2]) return 1;
        return 0;
      });
    }
    //异步加载图片绘制到canvas上，http1.1的同一个域名下TCP并发连接数4-8个，通常6个。
    for (let i = 0; i < queue.length; i = i + 6) {
      const list = queue.slice(i, i + 6);
      await Promise.all(
        list.map((a) => this.drawTileImage(ctx, a.x, a.y, zoom, a.imageX, a.imageY, true))
      );
    }
    //截取行政区域内
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.fill(maskPath);
    console.log(queue);
    return {canvas, queue};
  }

  tileCenter: LngLatXY = [0, 0];

  async drawLayer() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const {offset, bounds, start, end, tileCenter} = this.getTileBounds();
    this.tileCenter = tileCenter;
    //开始像素坐标
    this.tileStart = start;
    //结束像素坐标
    this.tileEnd = end;
    //收集需要绘制的瓦片索引和瓦片在canvas上的位置
    const queue = [];
    for (let x = bounds[0][0], i = 0; x < bounds[1][0]; x++, i++) {
      for (let y = bounds[0][1], j = 0; y < bounds[1][1]; y++, j++) {
        queue.push({
          x,
          y,
          imageX: i * this.tileSize + offset[0],
          imageY: j * this.tileSize + offset[1]
        });
      }
    }
    //排序优先绘制有缓存的瓦片
    queue.sort((a: any, b: any) => {
      const id1 = `${a.x}-${a.y}-${this.zoom}`;
      const id2 = `${b.x}-${b.y}-${this.zoom}`;
      if (this.cacheTiles[id1]) return -1;
      if (this.cacheTiles[id2]) return 1;
      return 0;
    });
    //异步加载图片绘制到canvas上，http1.1的同一个域名下TCP并发连接数4-8个，通常6个。
    for (let i = 0; i < queue.length; i = i + 6) {
      const list = queue.slice(i, i + 6);
      await Promise.all(
        list.map((a) => this.drawTileImage(ctx, a.x, a.y, this.zoom, a.imageX, a.imageY))
      );
    }
    //绘制形状
    this.drawShape();
  }
}
