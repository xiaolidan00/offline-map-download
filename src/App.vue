<script setup>
  import OfflineMapDowloader from './components/OfflineMapDowloader.vue';
</script>

<template>
  <OfflineMapDowloader></OfflineMapDowloader>
</template>
<style>
  body,
  #app {
    height: 100%;
    width: 100%;
    position: absolute;
    overflow: hidden;
    padding: 0;
    margin: 0;
  }
  * {
    box-sizing: border-box !important;
  }
</style>
