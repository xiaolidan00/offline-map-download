<script setup lang="ts">
  import './style.scss';
  import {onMounted, useTemplateRef, ref} from 'vue';
  import {MyMap} from '../utils/map';
  import ConfigPanel from './ConfigPanel.vue';
  import {
    mapstore as state,
    defaultmapconfig,
    store,
    defaultStore
  } from './store';
  import JSZip from 'jszip';
  import {cloneDeep} from 'lodash-es';

  import type {LngLatXY} from '../utils/projection';
  import {
    checkBounds,
    downloadFile,
    getTime,
    sleep,
    travelGeo,
    writeZip
  } from '../utils/utils';
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

  const onReset = () => {
    state.value = cloneDeep(defaultmapconfig);

    setMap();
  };
  const downloadZip = async () => {
    const b = store.value.bounds;

    if (checkBounds(b as [LngLatXY, LngLatXY])) {
      const {minLevel, maxLevel} = store.value;
      const queue: any[] = [];
      try {
        const rect = b as [LngLatXY, LngLatXY];
        for (let z = minLevel; z <= maxLevel; z++) {
          const q = map.getTileList(rect, z);
          queue.push(...q);
        }
      } catch (error) {
        alert('数量太多，请分批下载');
        return;
      }

      if (
        !window.confirm(
          `需下载${new Intl.NumberFormat().format(queue.length)}张瓦片底图，预计下载时间${getTime(queue.length * 0.5)}秒`
        )
      )
        return;
      store.value.total = queue.length;
      store.value.loading = true;
      const zip = new JSZip();
      //异步加载图片绘制到canvas上，http1.1的同一个域名下TCP并发连接数4-8个，通常6个。
      for (let i = 0; i < queue.length; i += 6) {
        const list = queue.slice(i, i + 6);
        store.value.current = i;
        await Promise.all(list.map((a) => writeZip(zip, a.url, a.x, a.y, a.z)));
        await sleep();
      }

      zip
        .generateAsync({type: 'blob'})
        .then(function (content) {
          downloadFile(
            content,
            `瓦片层级[${minLevel}-${maxLevel}]${new Date().getTime()}'.zip`
          );
        })
        .finally(() => {
          store.value.loading = false;
        });
    } else {
      alert('请选择范围');
    }
  };
  const cacheGeo: Record<string, any> = {};
  let areaIds: string[] = [];
  const onAreaBound = () => {
    const b = store.value.areaBounds;
    if (store.value.currentArea && checkBounds(b)) {
      store.value.bounds = cloneDeep(b);
    }
  };
  const onArea = () => {
    const code = store.value.currentArea;
    console.log('adcode', code);
    if (!code) {
      alert('请选择区域');
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
      travelGeo(res, (path: any) => {
        id++;
        path.forEach((b: any) => {
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
          path: path,
          style: {
            stroke: true,
            color: 'red',
            opacity: 1,
            weight: 2
          }
        });
      });
      store.value.areaBounds = bounds;
      store.value.areaCenter = [lng / count, lat / count];
      map.fitBounds({bounds});
      store.value.currentArea = code;
    };
    if (cacheGeo[code]) {
      drawArea(cacheGeo[code]);
      return;
    }
    fetch(
      `https://geo.datav.aliyun.com/areas_v3/bound/${code}${store.value.isFull ? '_full' : ''}.json`
    )
      .then((res) => res.json())
      .then((res) => {
        cacheGeo[code] = res;
        drawArea(res);
      })
      .catch((err) => {
        alert('获取区域边界失败');
      });
  };
  const onDraw = () => {
    store.value.isDraw = !store.value.isDraw;
  };
  const drawRect = () => {
    const b = store.value.bounds;

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
        bounds: b,
        style: pointStyle
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
  const onRect = () => {
    store.value.bounds = map.getBounds();
    drawRect();
  };
  const saveConfig = () => {
    localStorage.setItem('mapconfig', JSON.stringify(state.value));
  };
  const setMap = () => {
    if (map) {
      map.dispose();
    }
    if (state.value.tileSize && state.value.tileUrl) {
      let projConfig: any;
      if (
        state.value.isProject &&
        state.value.crsName &&
        state.value.crsConfig
      ) {
        projConfig = {
          name: state.value.crsName,
          config: state.value.crsConfig
        };
        if (
          state.value.origin &&
          /([\-0-9\.]+),([\-0-9\.]+)/.test(state.value.origin)
        ) {
          projConfig.origin = state.value.origin
            .split(',')
            .map((a) => parseFloat(a));
        }
        if (
          state.value.resolutions &&
          /([\-0-9\.,]+)/.test(state.value.resolutions)
        ) {
          projConfig.resolutions = state.value.resolutions
            .split(',')
            .map((a) => parseFloat(a));
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
      //@ts-ignore
      window.theMap = map;
      map.on('zoomend', () => {
        state.value.zoom = map.getZoom();
        saveConfig();
      });
      map.on('moveend', () => {
        state.value.center = map.getCenter();
        saveConfig();
      });

      map.on('click', ({event, lngLat}: any) => {
        // console.log(event, lngLat);
        if (store.value.isDraw) {
          if (event.button === 2) {
            store.value.bounds[1] = lngLat;
          } else {
            store.value.bounds[0] = lngLat;
          }
          drawRect();
        }
      });
      drawRect();

      if (store.value.currentArea) onArea();
    }
  };
  onMounted(() => {
    setMap();
  });
</script>

<template>
  <div class="map-container" ref="mapRef"></div>
  <ConfigPanel
    @download="downloadZip"
    @reset="onReset"
    @draw="onDraw"
    @redraw="setMap"
    @rect="onRect"
    @area="onArea"
    @areabound="onAreaBound"
  ></ConfigPanel>
</template>
