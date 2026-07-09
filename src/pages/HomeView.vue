<template>
  <div ref="mapRef" class="map-container"></div>
  <div
    style="
      position: absolute;
      z-index: 999;
      top: 0px;
      left: 0px;
      width: 100%;
      padding: 10px;
      background-color: rgba(255, 255, 255, 0.5);
      display: flex;
      flex-direction: column;
      gap: 10px;
    "
  ></div>
</template>

<script setup lang="ts">
  import 'leaflet/dist/leaflet.css';
  import * as L from 'leaflet';
  import 'proj4leaflet';
  import JSZip from 'jszip';
  import {onBeforeMount, onMounted, reactive, useTemplateRef, watch} from 'vue';
  //@ts-ignore
  //   const CGCS2000 = new L.Proj.CRS(
  //     'EPSG:4547',
  //     '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',
  //     {
  //       origin: [-5123200, 10002100],
  //       resolutions: [
  //         132.291931250529, 79.3751587503175, 66.1459656252646, 31.750063500127,
  //         15.8750317500635, 7.93751587503175, 3.96875793751588, 2.11667090000847,
  //         1.05833545000423, 0.529167725002117, 0.264583862501058,
  //         0.132291931250529, 0.0529167725002117, 0.0330729828126323,
  //         0.0264583862501058, 0.0198437896875794
  //       ]
  //     }
  //   );

  const mapRef = useTemplateRef<HTMLDivElement>('mapRef');

  let map: any;

  const setTile = () => {
    map.eachLayer((layer: any) => {
      map.removeLayer(layer);
    });
    if (state.tileUrlList.length) {
      state.tileUrlList.forEach((url) => {
        L.tileLayer(url).addTo(map);
      });
    }
  };
  watch(
    () => state.tileUrlList,
    () => {
      setTile();
    }
  );
  watch(
    () => state,
    () => {
      localStorage.setItem('mapconfig', JSON.stringify(state));
    }
  );

  const downloadGrid = () => {
    const zip = new JSZip();
    for (let z = state.minZoom; z <= state.maxZoom; z++) {}
  };
  onMounted(() => {
    map = L.map(mapRef.value!, {
      zoom: state.zoom,
      center: state.center,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
      preferCanvas: true
    });

    setTile();
    map.on('zoomend moveend resize', () => {
      const center = map.getCenter();
      state.center = [center.lat, center.lng];
      state.zoom = map.getZoom();
    });
  });
  onBeforeMount(() => {
    if (map) {
      map.eachLayer((layer: any) => {
        map.removeLayer(layer);
      });
      map.clearAllEventListeners();
      map.remove();
    }
  });
</script>

<style scoped></style>
