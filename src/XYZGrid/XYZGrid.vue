<script setup lang="ts">
  import './style.scss';
  import {MyMap} from '../utils/map';
  import ConfigPanel from './ConfigPanel.vue';
  import {mapstore as state, defaultmapconfig, store} from './store';

  import {cloneDeep} from 'lodash-es';

  import type {LngLatXY} from '../utils/projection';
  import {
    checkBounds,
    convertBase64UrlToFile,
    downloadFile,
    downloadZip,
    gcTowgs84,
    getTime,
    isEmpty,
    splitMapCanvas,
    travelGeo
  } from '../utils/utils';
  import JSZip from 'jszip';

  const mapRef = useTemplateRef('mapRef');
  const pointStyle = {
    stroke: true,
    color: 'white',
    weight: 2,
    opacity: 1,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 10,
    fill: true,
    fillColor: 'blue',
    fillOpacity: 1,
    radius: 9
  };
  let map: MyMap;

  const cacheGeo: Record<string, any> = {};
  let areaIds: string[] = [];
  let theGeojson: any;

  const drawRect = () => {
    const b = state.value.bounds;

    if (checkBounds(b as [LngLatXY, LngLatXY])) {
      map.addShape({
        id: 'bounds',
        type: 'rect',
        bounds: b,
        style: {
          stroke: true,
          color: 'blue',
          opacity: 1,
          weight: 2
        }
      });

      map.addShape({
        id: 'p1',
        type: 'point',
        lnglat: b[0],
        style: {...pointStyle, fillColor: 'red'}
      });
      map.addShape({
        id: 'p2',
        type: 'point',
        lnglat: b[1],
        style: {...pointStyle, fillColor: 'orange'}
      });
    }
  };

  const saveConfig = () => {
    localStorage.setItem('mapconfig', JSON.stringify(state.value));
  };

  let geojsonIds: string[] = [];
  const actionList: Record<string, Function> = {
    drawGeojson: () => {
      if (geojsonIds.length) {
        geojsonIds.forEach((id) => {
          map.removeShape(id);
        });
        geojsonIds = [];
      }
      let idx = 0;
      const zoom = map.getZoom();
      state.value.geojsonList.forEach((item) => {
        if (!item.enable) return;
        const nameMap: Record<
          string,
          {
            minLat: number;
            maxLat: number;
            minLng: number;
            maxLng: number;
          }
        > = {};
        travelGeo(item.data, (points: any, a: any) => {
          const id = a.type + idx;
          const obj = {
            minLat: 90,
            maxLat: -90,
            minLng: 180,
            maxLng: -180
          };
          switch (a.type) {
            case 'point':
              {
                map.addShape({
                  id,
                  style: {
                    radius: 6,
                    fill: item.fill,
                    stroke: item.stroke,
                    color: item.color,
                    weight: item.weight,
                    opacity: item.opacity,
                    fillColor: item.fillColor,
                    fillOpacity: item.fillOpacity,
                    shadowColor: 'rgba(0,0,0,0.5)',
                    shadowBlur: 10
                  },
                  type: 'point',
                  lnglat: points
                });
                obj.minLng = points[0];
                obj.maxLng = points[0];
                obj.minLat = points[1];
                obj.maxLat = points[1];
              }
              break;
            case 'linestring':
              {
                map.addShape({
                  id,
                  style: {
                    stroke: item.stroke,
                    color: item.color,
                    weight: item.weight,
                    opacity: item.opacity,

                    shadowColor: 'rgba(0,0,0,0.5)',
                    shadowBlur: 10
                  },
                  type: 'line',
                  path: points
                });
              }
              break;

            case 'polygon':
              {
                map.addShape({
                  id,
                  type: 'polygon',
                  path: points,
                  style: {
                    stroke: item.stroke,
                    color: item.color,
                    weight: item.weight,
                    opacity: item.opacity,
                    fill: item.fill,
                    fillColor: item.fillColor,
                    fillOpacity: item.fillOpacity,
                    shadowColor: 'rgba(0,0,0,0.5)',
                    shadowBlur: 10
                  }
                });

                points.forEach(([lng, lat]: any) => {
                  obj.minLat = Math.min(obj.minLat, lat);
                  obj.maxLat = Math.max(obj.maxLat, lat);
                  obj.minLng = Math.min(obj.minLng, lng);
                  obj.maxLng = Math.max(obj.maxLng, lng);
                });
              }
              break;
          }
          if (item.isText && (isEmpty(item.textLevel) || zoom >= item.textLevel)) {
            const text = item.textProp
              ? a.data[item.textProp]
              : a.data['name'] || a.data['NAME'] || a.data['Name'];

            if (text) {
              const o = nameMap[text];
              if (o) {
                obj.minLat = Math.min(obj.minLat, o.minLat);
                obj.maxLat = Math.max(obj.maxLat, o.maxLat);
                obj.minLng = Math.min(obj.minLng, o.minLng);
                obj.maxLng = Math.max(obj.maxLng, o.maxLng);
              }
              nameMap[text] = obj;
            }
          }
          geojsonIds.push(id);
          idx++;
        });
        if (item.isText && (isEmpty(item.textLevel) || zoom >= item.textLevel)) {
          for (const k in nameMap) {
            const obj = nameMap[k];

            const textPoint = [0.5 * (obj.maxLng + obj.minLng), 0.5 * (obj.maxLat + obj.minLat)];

            map.addShape({
              id: 'text' + idx,
              type: 'text',
              text: k,
              lnglat: textPoint,
              offsetX: item.offsetX || 0,
              offsetY: item.offsetY || 0,
              style: {
                fontSize: item.fontSize,
                color: item.fontColor,
                shadowColor: 'rgba(0,0,0,0.5)',
                shadowBlur: 10
              }
            });
            geojsonIds.push('text' + idx);

            idx++;
          }
        }
      });
    },
    downloadarea: async () => {
      const {minLevel, maxLevel} = state.value;
      if (minLevel > maxLevel) {
        ElMessage.error('下载的最小等级必须小于等于最大等级！');
        return;
      }

      let tag = false;
      const zip = new JSZip();
      const tileSize = map.tileSize;
      for (let i = minLevel; i <= maxLevel; i++) {
        try {
          const {canvas, queue} = await map.drawAreaCanvas(
            theGeojson,
            state.value.areaBounds,
            i,
            true
          );
          splitMapCanvas(zip, canvas, i, tileSize, queue);
          tag = true;
        } catch (error) {
          console.log(error);
          ElMessage.error(`层级${i}生成canvas错误`);
        }
      }
      if (tag) {
        zip.generateAsync({type: 'blob'}).then(function (content) {
          downloadFile(content, `行政区域瓦片[${minLevel}-${maxLevel}].zip`);
        });
      }
    },
    areaimage: async () => {
      const {minLevel, maxLevel} = state.value;
      if (minLevel > maxLevel) {
        ElMessage.error('下载的最小等级必须小于等于最大等级！');
        return;
      }
      let tag = false;
      const zip = new JSZip();
      for (let i = minLevel; i <= maxLevel; i++) {
        try {
          const {canvas} = await map.drawAreaCanvas(theGeojson, state.value.areaBounds, i);
          const base64 = canvas.toDataURL('image/png');
          const file = convertBase64UrlToFile(base64, i + '.png');
          zip.file(`${i}.png`, file);
          tag = true;
        } catch (error) {
          console.log(error);
          ElMessage.error(`层级${i}生成canvas错误`);
        }
      }

      if (tag) {
        zip.generateAsync({type: 'blob'}).then(function (content) {
          downloadFile(content, `行政区域图[${minLevel}-${maxLevel}].zip`);
        });
      }
    },

    capture: () => {
      const base64 = map.canvas.toDataURL('image/png');
      const f = new Date().getTime() + '.png';
      const file = convertBase64UrlToFile(base64, f);
      downloadFile(file, f);
    },
    reset: () => {
      state.value = cloneDeep(defaultmapconfig);

      actionList.redraw();
    },
    download: async () => {
      const {minLevel, maxLevel} = state.value;
      if (minLevel > maxLevel) {
        ElMessage.error('下载的最小等级必须小于等于最大等级！');
        return;
      }
      const b = state.value.bounds;

      if (checkBounds(b as [LngLatXY, LngLatXY])) {
        const queue: any[] = [];
        try {
          const rect = b as [LngLatXY, LngLatXY];
          for (let z = minLevel; z <= maxLevel; z++) {
            const q = map.getTileList(rect, z);
            queue.push(...q);
          }
        } catch (error) {
          ElMessage.error('数量太多，请分层级下载');
          return;
        }

        if (
          !window.confirm(
            `需下载${new Intl.NumberFormat().format(queue.length)}张瓦片底图，预计下载时间${getTime(queue.length * 0.5)}秒`
          )
        )
          return;
        store.value.current = 0;
        store.value.total = queue.length;
        store.value.loading = true;
        //分包下载
        if (state.value.isSplit) {
          const n = state.value.spliteNum;
          for (let i = 0; i < queue.length; i = i + n) {
            const list = queue.slice(i, i + n);
            console.log(i, i + n, list.length);
            await downloadZip(list, i);
          }
        } else {
          await downloadZip(queue, 0);
        }
        store.value.loading = false;
      } else {
        ElMessage.error('请选择范围');
      }
    },
    drawrect: drawRect,
    redraw: () => {
      if (map) {
        map.dispose();
      }
      if (state.value.tileSize && state.value.tileUrl) {
        let projConfig: any;
        if (state.value.isProject && state.value.crsName && state.value.crsConfig) {
          projConfig = {
            name: state.value.crsName,
            config: state.value.crsConfig
          };
          if (state.value.origin && /([\-0-9\.]+),([\-0-9\.]+)/.test(state.value.origin)) {
            projConfig.origin = state.value.origin.split(',').map((a) => parseFloat(a));
          }
          if (state.value.resolutions && /([\-0-9\.,]+)/.test(state.value.resolutions)) {
            projConfig.resolutions = state.value.resolutions.split(',').map((a) => parseFloat(a));
          }
        }

        map = new MyMap({
          container: mapRef.value!,
          zoom: state.value.zoom,
          center: state.value.center,
          minZoom: state.value.minZoom,
          maxZoom: state.value.maxZoom,
          tileUrl: state.value.tileUrl,
          tileSize: state.value.tileSize,

          projConfig
        });
        map.isGrid = state.value.isGrid;
        //@ts-ignore
        window.theMap = map;
        map.on(
          'zoomend',
          debounce(() => {
            state.value.zoom = map.getZoom();
            saveConfig();
          }, 100)
        );
        map.on(
          'moveend',
          debounce(() => {
            state.value.center = map.getCenter();
            saveConfig();
          }, 100)
        );

        map.on('click', ({event, lngLat}: any) => {
          // console.log(event, lngLat);
          if (store.value.currentAction === 'drawrect') {
            if (event.button === 2) {
              state.value.bounds[1] = lngLat;
            } else {
              state.value.bounds[0] = lngLat;
            }
            drawRect();
          }
        });
        drawRect();

        if (state.value.currentArea) actionList.drawarea(true);
        if (state.value.geojsonList.length) actionList.drawGeojson();
      }
    },
    maprect: () => {
      state.value.bounds = map.getBounds();
      drawRect();
    },

    drawarea: (noFit: boolean) => {
      const code = state.value.currentArea;

      if (!code) {
        ElMessage.error('请选择区域');
        return;
      }
      const drawArea = (res: any) => {
        if (areaIds.length) {
          areaIds.forEach((id) => {
            map.removeShape(id);
          });
          areaIds = [];
        }
        let count = 0,
          id = 0;
        let lng = 0,
          lat = 0;
        const bounds = [
          [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
          [0, 0]
        ] as [LngLatXY, LngLatXY];
        theGeojson = res;
        map.isGc = state.value.isGc;
        travelGeo(res, (path: any) => {
          id++;
          const ps: any[] = [];
          path.forEach((a: any) => {
            const b = state.value.isGc ? a : gcTowgs84(a[0], a[1]);

            ps.push(b);
            count++;
            lng += b[0];
            lat += b[1];
            bounds[0][0] = Math.min(bounds[0][0], b[0]);
            bounds[0][1] = Math.min(bounds[0][1], b[1]);
            bounds[1][0] = Math.max(bounds[1][0], b[0]);
            bounds[1][1] = Math.max(bounds[1][1], b[1]);
          });
          const s = code + '_' + id;
          areaIds.push(s);
          map.addShape({
            id: s,
            type: 'polygon',
            path: ps,
            style: {
              stroke: true,
              color: 'blue',
              opacity: 1,
              weight: 2,
              fill: true,
              fillColor: 'blue',
              fillOpacity: 0.1
            }
          });
        });
        state.value.areaBounds = bounds;
        state.value.areaCenter = [lng / count, lat / count];
        if (!noFit) map.fitBounds({bounds, paddingLeft: 300});
        state.value.center = map.getCenter();
        state.value.zoom = map.getZoom();
        state.value.currentArea = code;
      };
      const id = `${code}${state.value.isFull ? '_full' : ''}`;
      if (cacheGeo[id]) {
        drawArea(cacheGeo[id]);
        return;
      }

      fetch(`http://geo.datav.aliyun.com/areas_v3/bound/${id}.json`)
        .then((res) => res.json())
        .then((res) => {
          cacheGeo[id] = res;
          drawArea(res);
        })
        .catch(() => {
          ElMessage.error('获取区域边界失败,请重新选择');
        });
    },
    areabound: () => {
      const b = state.value.areaBounds;
      if (state.value.currentArea && checkBounds(b)) {
        state.value.bounds = cloneDeep(b);
        drawRect();
      }
    }
  };
  watch(
    () => state.value.isGrid,
    (v) => {
      if (map) {
        map.isGrid = v;
        map.drawLayer();
      }
    }
  );
  const onAction = (action: string) => {
    if (actionList[action]) {
      actionList[action]();
    }
  };
  onMounted(() => {
    actionList.redraw();
  });
  onBeforeUnmount(() => {
    if (map) {
      map.dispose();
    }
  });
</script>

<template>
  <div class="map-container" ref="mapRef"></div>

  <ConfigPanel @action="onAction"></ConfigPanel>
</template>
