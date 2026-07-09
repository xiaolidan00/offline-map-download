<template>
  <div class="config-panel">
    <div
      style="height: calc(100% - 234px); overflow: auto; scrollbar-width: none"
    >
      瓦片地址

      <input
        placeholder="请输入瓦片地址"
        v-model="state.tileUrl"
        type="text"
        style="width: 100%"
        @change="onAction('change')"
      />

      <div style="margin-top: 10px">
        瓦片大小

        <input
          v-model.number="state.tileSize"
          type="number"
          style="width: 70px"
          @change="onAction('change')"
        />
        当前等级

        <input
          v-model.number="state.zoom"
          type="number"
          style="width: 70px"
          @change="onAction('change')"
        />
      </div>
      <div style="margin-top: 10px">
        最小等级

        <input
          v-model.number="state.minZoom"
          type="number"
          style="width: 70px"
          @change="onAction('change')"
        />

        最大等级

        <input
          v-model.number="state.maxZoom"
          type="number"
          style="width: 70px"
          @change="onAction('change')"
        />
      </div>
      中心点经度<input
        v-model.number="state.center[0]"
        type="number"
        style="width: 100%"
        @change="onAction('change')"
      />

      中心点纬度
      <input
        v-model.number="state.center[1]"
        type="number"
        style="width: 100%"
        @change="onAction('change')"
      />

      自定义投影
      <input
        v-model="state.isProject"
        type="checkbox"
        @change="onAction('change')"
      />

      <div v-if="state.isProject">
        投影名称
        <input
          placeholder="如EPSG:3857"
          v-model="state.crsName"
          type="text"
          style="width: 100%"
          @change="onAction('change')"
        />
        投影设置
        <input
          placeholder=""
          v-model="state.crsConfig"
          type="text"
          style="width: 100%"
          @change="onAction('change')"
        />
        投影原点
        <input
          placeholder="如-5123200, 10002100"
          v-model="state.origin"
          type="text"
          style="width: 100%"
          @change="onAction('change')"
        />
        缩放等级
        <input
          placeholder="如132.291931250529, 79.3751587503175, 66.1459656252646"
          v-model="state.resolutions"
          type="text"
          style="width: 100%"
          @change="onAction('change')"
        />
      </div>
      <div>下载设置</div>

      选择区域
      <div style="display: flex; flex-direction: column; gap: 10px">
        <select
          v-for="(item, idx) in areaOptions"
          style="width: 100%"
          :key="idx"
          v-model="store.areaList[idx]"
          @change="onAreaChange(idx)"
        >
          <option value=""></option>
          <option v-for="it in item" :key="it.adcode" :value="it.adcode">
            {{ it.name }}
          </option>
        </select>
      </div>
      <div>加载子区域<input type="checkbox" v-model="store.isFull" /></div>

      最小等级

      <input
        v-model.number="store.minLevel"
        type="number"
        style="width: 70px"
        @change="onAction('change')"
      />

      最大等级

      <input
        v-model.number="store.maxLevel"
        type="number"
        style="width: 70px"
        @change="onAction('change')"
      />

      <div v-if="checkBounds(store.bounds)">
        <div>下载范围</div>
        <div>
          <input
            type="number"
            style="width: calc(50% - 5px)"
            v-model.number="store.bounds[0][0]"
          />
          <input
            type="number"
            style="width: calc(50% - 5px); margin-left: 10px"
            v-model.number="store.bounds[0][1]"
          />
        </div>
        <div style="margin-top: 10px">
          <input
            type="number"
            style="width: calc(50% - 5px)"
            v-model.number="store.bounds[1][0]"
          />
          <input
            type="number"
            style="width: calc(50% - 5px); margin-left: 10px"
            v-model.number="store.bounds[1][1]"
          />
        </div>
      </div>
    </div>

    <div style="font-size: 12px; color: red" v-if="store.isDraw">
      左击添加或修改第一个点,右击添加或修改第二个点
    </div>
    <div
      style="
        display: flex;
        margin-top: 10px;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 10px;
      "
    >
      <button @click="onAction('reset')">重置配置</button>
      <button @click="onAction('redraw')">重绘地图</button>

      <button @click="onAction('download')">下载瓦片</button>
      <button :class="[store.isDraw ? 'active' : '']" @click="onAction('draw')">
        绘制范围
      </button>
      <button @click="onAction('area')">绘制区域</button>
      <button @click="onAction('rect')">地图范围</button>
      <button @click="onAction('areabound')">区域范围</button>
      <button @click="onAction('import')">导入配置</button>
      <button @click="onAction('export')">导出配置</button>
    </div>
  </div>
  <div class="loading" v-if="store.loading">
    下载进度{{ store.current }}/{{ store.total }}({{
      store.total > 0 ? ((100 * store.current) / store.total).toFixed(2) : 0
    }}%)
  </div>
</template>

<script setup lang="ts">
  import {ref, computed} from 'vue';
  import {defaultStore, mapstore as state, store} from './store';
  import {checkBounds, downloadFile, uploadFile} from '../utils/utils';
  import {adcodes} from '../utils/adcodeData';
  import {cloneDeep} from 'lodash-es';

  const areaOptions = ref<any[]>([]);
  const onAreaChange = (idx: number) => {
    if (idx < store.value.areaList.length - 1) {
      store.value.areaList = store.value.areaList.slice(0, idx + 1);
      console.log();
    }
    const list: any[] = [adcodes];

    if (store.value.areaList.length) {
      let current = adcodes;
      for (let i = 0; i < store.value.areaList.length; i++) {
        for (let j = 0; j < current.length; j++) {
          if (store.value.areaList[i] === current[j].adcode) {
            if (current[j].children?.length) {
              list.push(current[j].children);
              current = current[j].children;
            }
            break;
          }
        }
      }
    }
    areaOptions.value = list;
  };
  onAreaChange(0);
  const emit = defineEmits([
    'change',
    'redraw',
    'download',
    'reset',
    'draw',
    'rect',
    'area',
    'areabound'
  ]);

  const onAction = (
    action:
      | 'change'
      | 'redraw'
      | 'download'
      | 'reset'
      | 'draw'
      | 'rect'
      | 'area'
      | 'import'
      | 'export'
      | 'areabound'
  ) => {
    if (action === 'change') {
      localStorage.setItem('mapconfig', JSON.stringify(state.value));
    }
    if (action === 'reset') {
      store.value = cloneDeep(defaultStore);
      onAreaChange(0);
    }
    if (action === 'import') {
      uploadFile('.json').then((file) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const str = reader.result?.toString();
          if (str) {
            try {
              const data = JSON.parse(str) as any;
              for (const k in data) {
                //@ts-ignore
                state.value[k] = data[k];
              }
            } catch (error) {}
          }
        };
      });
      return;
    }
    if (action === 'area') {
      const a = store.value.areaList;
      let code = '';
      for (let i = 0; i < a.length; i++) {
        if (a[i]) {
          code = a[i];
        } else {
          break;
        }
      }
      store.value.currentArea = code;
    }
    if (action === 'export') {
      downloadFile(
        new Blob([JSON.stringify(state.value)], {type: 'application/json'}),
        `mapconfig${new Date().getTime()}.json`
      );
      return;
    }
    emit(action);
  };
</script>

<style scoped></style>
