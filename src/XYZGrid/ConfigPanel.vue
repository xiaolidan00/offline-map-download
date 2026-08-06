<template>
  <div class="config-panel">
    <el-form
      @submit.prevent
      style="height: calc(100% - 136px); overflow: auto; scrollbar-width: none"
    >
      瓦片地址

      <el-input
        placeholder="请输入瓦片地址"
        v-model="state.tileUrl"
        type="text"
        style="width: 100%"
        @change="onChange()"
      />

      <div style="margin-top: 10px">
        瓦片大小

        <el-input
          v-model.number="state.tileSize"
          type="number"
          style="width: 70px"
          @change="onChange()"
        />
        当前等级

        <el-input
          v-model.number="state.zoom"
          type="number"
          style="width: 70px"
          @change="onChange()"
        />
      </div>
      <div style="margin-top: 10px">
        最小等级

        <el-input
          v-model.number="state.minZoom"
          type="number"
          style="width: 70px"
          @change="onChange()"
        />

        最大等级

        <el-input
          v-model.number="state.maxZoom"
          type="number"
          style="width: 70px"
          @change="onChange()"
        />
      </div>
      中心点经度

      <el-input
        v-model.number="state.center[0]"
        type="number"
        style="width: 100%"
        @change="onChange()"
      />

      中心点纬度
      <el-input
        v-model.number="state.center[1]"
        type="number"
        style="width: 100%"
        @change="onChange()"
      />

 <el-form-item label="绘制网格">
        <el-checkbox v-model="state.isGrid" type="checkbox" @change="onChange()" />
      </el-form-item>
      <el-form-item label="自定义投影">
        <el-checkbox v-model="state.isProject" type="checkbox" @change="onChange()" />
      </el-form-item>

      <div v-if="state.isProject">
        投影名称
        <el-input
          placeholder="如EPSG:3857"
          v-model="state.crsName"
          type="text"
          style="width: 100%"
          @change="onChange()"
        />
        投影设置
        <el-input
          placeholder=""
          v-model="state.crsConfig"
          type="text"
          style="width: 100%"
          @change="onChange()"
        />
        投影原点origin
        <el-input
          placeholder="如-5123200, 10002100"
          v-model="state.origin"
          type="text"
          style="width: 100%"
          @change="onChange()"
        />
        缩放等级lods
        <el-input
          placeholder="如132.291931250529, 79.3751587503175, 66.1459656252646"
          v-model="state.resolutions"
          type="text"
          style="width: 100%"
          @change="onChange()"
        />
      </div>
      <div style="font-size: 16px; font-weight: bold">下载设置</div>

      选择区域

      <el-cascader
        v-model="state.currentArea"
        popper-class="cascader-custom-header"
        :options="adcodes"
        placeholder="请选择区域"
        clearable
        :props="{
          label: 'name',
          value: 'adcode',
          children: 'children',
          emitPath: false,
          checkStrictly: true
        }"
        @change="onChange()"
      ></el-cascader>

      <el-form-item label="加载子区域"
        ><el-checkbox v-model="state.isFull" @change="onChange()"
      /></el-form-item>

      <el-form-item label="区域火星坐标">
        <el-checkbox v-model="state.isGc" @change="onChange()" />
      </el-form-item>
      最小等级

      <el-input
        v-model.number="state.minLevel"
        type="number"
        style="width: 70px"
        @change="onChange()"
        :min="state.minZoom"
        :max="state.maxZoom"
      />

      最大等级

      <el-input
        v-model.number="state.maxLevel"
        type="number"
        style="width: 70px"
        @change="onChange()"
        :min="state.minZoom"
        :max="state.maxZoom"
      />

      <div v-if="checkBounds(state.bounds)">
        <div>下载范围</div>
        <div>
          <el-input
            type="number"
            style="width: calc(50% - 5px)"
            v-model.number="state.bounds[0][0]"
            @change="onChange()"
          />
          <el-input
            type="number"
            style="width: calc(50% - 5px); margin-left: 10px"
            v-model.number="state.bounds[0][1]"
            @change="onChange()"
          />
        </div>
        <div style="margin-top: 10px">
          <el-input
            type="number"
            style="width: calc(50% - 5px)"
            v-model.number="state.bounds[1][0]"
            @change="onChange()"
          />
          <el-input
            type="number"
            style="width: calc(50% - 5px); margin-left: 10px"
            v-model.number="state.bounds[1][1]"
            @change="onChange()"
          />
        </div>
      </div>

      <el-form-item
        label="拆分下载"
        style="margin-top: 10px"
        v-if="store.currentAction === 'download'"
      >
        <el-checkbox v-model="state.isSplit" @change="onChange()" />

        <span
          v-if="state.isSplit"
          style="
            margin-left: 10px;
            display: inline-flex;
            align-items: center;
            height: 32px;
            gap: 10px;
          "
        >
          分包数量
          <el-input
            type="number"
            @change="onChange()"
            style="width: 80px"
            v-model.number="state.spliteNum"
          />
        </span>
      </el-form-item>

      <div style="margin-top: 10px" v-if="state.geojsonList.length">
        <div style="font-size: 16px; font-weight: bold">GeoJson设置</div>

        <div class="geojson-item" v-for="(item, i) in state.geojsonList" :key="i">
          <div>
            <i @click="item.show=!item.show" :class="[item.show?'active':'']">›</i>
           <el-checkbox v-model="item.enable"></el-checkbox>
            <span>{{ item.name }}【{{ item.data.features.length }}项】</span>

            <i @click="onDel(i)">×</i>
          </div>
          <div v-show="item.show">
            
            <el-form-item label="是否描边">
              <el-checkbox v-model="item.stroke" @change="onChange()" />
            </el-form-item>
            <el-form-item label="描边颜色" v-if="item.stroke">
              <input type="color" v-model="item.color"/> 
            </el-form-item>
            <el-form-item label="描边宽度" v-if="item.stroke">
              <el-input type="number" v-model.number="item.weight"></el-input>
            </el-form-item>
            <el-form-item label="描边透明度" v-if="item.stroke">
              <el-input type="number" placeholder="默认1" :min="0" :max="1" v-model.number="item.opacity"></el-input>
            </el-form-item>
            <el-form-item label="是否填充">
              <el-checkbox v-model="item.fill"></el-checkbox>
            </el-form-item>
            <el-form-item label="填充颜色" v-if="item.fill">
              <input type="color" v-model="item.fillColor"></input>
            </el-form-item>
            <el-form-item label="填充透明度" v-if="item.fill">
              <el-input
                type="number"
                :min="0"
                :max="1"
                placeholder="默认1"
                v-model.number="item.fillOpacity"
              ></el-input>
            </el-form-item>
            <el-form-item label="显示标签">
              <el-checkbox v-model="item.isText" @change="onChange()" />
            </el-form-item>
            <el-form-item label="标签属性"   v-if="item.isText">
              <el-input
                clearable
                placeholder="默认name|NAME|Name"              
                v-model="item.textProp"
                @change="onChange()"
              />
            </el-form-item>
            <el-form-item label="文本显示层级" v-if="item.isText">
              <el-input type="number"  placeholder="默认0" v-model.number="item.textLevel" :min="state.minZoom" :maxlength="state.maxZoom"></el-input>
            </el-form-item>

            <el-form-item label="文本偏移"  v-if="item.isText">
              <el-input
                type="number"
                v-model.number="item.offsetX"
                placeholder="偏移X"                
                style="width: 80px; margin-right: 5px"
              ></el-input>
              <el-input
                type="number"
                v-model.number="item.offsetY"
                placeholder="偏移Y"
                style="width: 80px"
              ></el-input>
            </el-form-item>
            <el-form-item label="字体颜色"  v-if="item.isText">
              <input type="color" v-model="item.fontColor"/> 
            </el-form-item>
            <el-form-item label="字体大小" v-if="item.isText">
              <el-input type="number" placeholder="默认12" v-model.number="item.fontSize"></el-input>
            </el-form-item>
          </div>
        </div>
      </div>
      <div v-if="store.currentAction==='download'&&state.isSplit" style="font-size: 12px; color: red">
        请关闭浏览器【下载前询问每个文件的保存位置】。请允许网页权限【自动下载项】！
      </div>
    </el-form>

    <div style="display: flex; flex-direction: row; flex-wrap: wrap">
      <div style="font-size: 12px; color: red" v-if="store.currentAction === 'drawrect'">
        左击添加或修改第一个点,右击添加或修改第二个点
      </div>
      <div>当前动作</div>
      <el-select
        style="width: 100%; margin-bottom: 10px"
        v-model="store.currentAction"
        placeholder="请选择动作"
      >
        <el-option v-for="item in actionList" v-bind="item" :key="item.value"></el-option>
      </el-select>
      <el-button style="width: 100%" type="primary" @click="onAction()">触发操作</el-button>
    </div>
  </div>
  <div class="loading" v-if="store.loading">
    下载进度{{ store.current }}/{{ store.total }}({{
      store.total > 0 ? ((100 * store.current) / store.total).toFixed(2) : 0
    }}%)
  </div>
</template>

<script setup lang="ts">
  import {defaultStore, mapstore as state, store} from './store';
  import {checkBounds, downloadFile, uploadFile} from '../utils/utils';
  import {adcodes} from '../utils/adcodeData';
  import {cloneDeep} from 'lodash-es';
  import {dayjs} from 'element-plus';

  const actionList = computed(() => {
    const list = [
      {label: '导入配置', value: 'import'},
      {label: '导出配置', value: 'export'},
      {label: '重绘地图', value: 'redraw'},
      {label: '恢复默认配置', value: 'reset'},
      {label: '手动绘制范围', value: 'drawrect'},
      {label: '下载当前截图', value: 'capture'},
      {label: '获取当前地图范围', value: 'maprect'}
    ];
    if (checkBounds(state.value.bounds)) {
      list.push({label: '下载地图瓦片', value: 'download'});
    }
    if (state.value.currentArea) {
      list.push({label: '绘制行政区域', value: 'drawarea'});
      if (checkBounds(state.value.areaBounds)) {
        list.push(
          {label: '获取行政区域范围', value: 'areabound'},
          {label: '下载行政区域图', value: 'areaimage'},
          {label: '下载行政区域瓦片', value: 'downloadarea'}
        );
      }
    }
    list.push({label: '导入GeoJson数据', value: 'importGeojson'});
    if (state.value.geojsonList.length) {
      list.push({label: '绘制GeoJson数据', value: 'drawGeojson'});
      if (checkBounds(state.value.geojsonBounds)) {
        list.push({label: '下载GeoJson数据瓦片', value: 'downloadGeojson'});
      }
    }
    // [{label: '下载转换新坐标系后的瓦片', value: 'downloadproj'}];
    return list;
  });

  const emit = defineEmits(['action']);
  const onDel = (i: number) => {
    state.value.geojsonList.splice(i, 1);
  };
  const onChange = () => {
    localStorage.setItem('mapconfig', JSON.stringify(state.value));
  };
  const onAction = () => {
    const action = store.value.currentAction;

    if (action === 'reset') {
      store.value = cloneDeep(defaultStore);
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
    if (action === 'importGeojson') {
      uploadFile('.json,.geojson').then((file) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
          const str = reader.result?.toString();
          if (str) {
            try {
              const data = JSON.parse(str) as any;
              state.value.geojsonList.push({enable:true,name: file.name, data,show:true, stroke: false, fill: false});
            } catch (error) {
              console.log(error);
            }
          }
        };
      });
      return;
    }

    if (action === 'export') {
      downloadFile(
        new Blob([JSON.stringify(state.value)], {type: 'application/json'}),
        `瓦片配置${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.json`
      );
      return;
    }

    emit('action', action);
  };
</script>

<style scoped></style>
