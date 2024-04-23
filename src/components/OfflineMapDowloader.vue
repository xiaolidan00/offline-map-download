<template>
  <div class="offline-amap-container">
    <div class="search-container">
      <input placeholder="请输入高德地图带Key的URL,例如: https://webapi.amap.com/maps?v=2.0&key=xxx" type="input" v-model="key" style="width: 606px;" />
      <select v-model="selectType" style="margin-right: 1px">
        <option value="area">区域</option>
        <option value="address">地点</option>
      </select>
      <input
        placeholder="请输入搜索关键词"
        type="input"
        v-model="searchKey"
        @change="onSearch()"
        v-show="selectType == 'address'"
      />
      <span v-show="selectType == 'area'" style="display: inline-flex">
        <select v-model="selectProvince" placeholder="请选择省">
          <option>请选择省</option>
          <option v-for="p in province" :key="p.name" :value="p.adcode">{{ p.name }}</option>
        </select>

        <select v-model="selectCity" v-show="selectProvince" placeholder="请选择市">
          <option>请选择市</option>
          <option v-for="p in city" :key="p.name" :value="p.adcode">{{ p.name }}</option>
        </select>

        <select v-model="selectArea" v-show="selectCity && selectProvince" placeholder="请选择区县">
          <option>请选择区县</option>
          <option v-for="p in area" :key="p.name" :value="p.adcode">{{ p.name }}</option>
        </select>
      </span>
      <button @click="onSearch()">搜索</button>
      <button @click="drawRect()">画范围</button>

      <button @click="isShow = true" v-if="rect">下载</button>
    </div>

    <div class="bottom-info" ref="info">
      <span>在地图上拖拉画矩形</span>
      当前缩放级别： {{ zoom }},中心经纬度:{{ lng }},{{ lat }}
      <span v-if="rect">选中范围:{{ rectLngLat }}</span>
    </div>

    <div class="left-tool" v-if="rect">
      <button type="primary" @click="clearRect()">清空范围</button>
      <button type="primary" @click="onEditRectStart()">开始编辑范围</button>
      <button type="primary" @click="onEditRectEnd()">结束编辑范围</button>
    </div>
    <div class="canvas" ref="canvas"></div>

    <el-dialog v-model="isShow" title="下载地图瓦片" width="60%" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="选中范围">
          <el-input :value="rectLngLat" readonly> </el-input>
        </el-form-item>
        <el-form-item label="中心点">
          <el-input :value="centerLnglat" readonly> </el-input>
        </el-form-item>
        <el-form-item label="地图样式">
          <el-select v-model="selectStyle">
            <el-option v-for="item in styleOps" v-bind="item" :key="item.value"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="路径规则">
          <el-input :value="rule" readonly> </el-input>
        </el-form-item>
      </el-form>
      <el-table v-if="rect && tableData" :data="tableData" height="400">
        <el-table-column prop="level" label="缩放级别"></el-table-column>
        <el-table-column prop="num" label="瓦片数量"></el-table-column>
        <el-table-column label="选中">
          <template #default="scope">
            <input type="checkbox" v-if="scope.row" v-model="zoomMap[scope.row.level]" />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div style="text-align: right">
          <el-button type="primary" @click="download()">下载</el-button>
        </div>
      </template>
    </el-dialog>
    <div class="loading" v-show="isLoading">下载进度：{{ process }}%</div>
  </div>
</template>
<script>
  function getBlob(url, cb) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function () {
      if (xhr.status === 200) {
        cb(xhr.response);
      }
    };
    xhr.onerror = function (err) {
      console.log(err);
      cb();
    };
    xhr.send();
  }
  function lon2tilex(lon, zoom) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  }
  function lat2tiley(lat, zoom) {
    return Math.floor(
      ((1 -
        Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
  }
  let zooms = [];
  for (let i = 3; i <= 18; i++) {
    zooms.push(i);
  }
  import JSZip from 'jszip';
  import { saveAs } from 'file-saver-fixed';
  export default {
    name: 'OfflineAMap',
    data: () => ({
      process: 0,
      selectStyle: '7',
      styleOps: [
        { label: '普通地图', value: '7' },
        { label: '卫星地图', value: '6' },
        { label: '路况地图', value: '8' }
      ],
      rule: `tiles/[z]/[y]/[x].png`,
      zoomMap: {},
      isShow: false,
      zooms,
      map: null,
      zoom: 11,
      searchKey: '',
      selectType: 'address',
      mouseTool: null,
      geocoder: null,
      marker: null,
      lat: 39.90923,
      lng: 116.397428,
      district: null,
      polygon: null,
      isLock: false,
      rect: null,
      theZip: null,
      selectProvince: '',
      province: [],
      selectCity: '',
      city: [],
      selectArea: '',
      area: [],
      key: '',
      isLoading: false,
    }),
    computed: {
      tableData() {
        if (this.rect) {
          let list = [];
          this.zooms.forEach((z) => {
            list.push({ level: z, num: this.getTileCount(z) });
          });
          return list;
        }
        return [];
      },
      centerLnglat() {
        if (this.rect) {
          return this.rect.getOptions().bounds.getCenter().toString();
        }
        return '';
      },
      rectLngLat() {
        if (this.rect) {
          return this.rect.getOptions().bounds.toString();
        }
        return null;
      },

      currentAdcode() {
        if (this.selectArea) {
          return this.selectArea;
        }
        if (this.selectCity) {
          return this.selectCity;
        }
        if (this.selectProvince) {
          return this.selectProvince;
        }
      },
      currentLevel() {
        if (this.selectArea) {
          return 'district';
        }
        if (this.selectCity) {
          return 'city';
        }
        if (this.selectProvince) {
          return 'province';
        }
      }
    },
    watch: {
      selectProvince() {
        if (this.province) {
          this.getDistrict('city', this.selectProvince);
        } else {
          this.selectCity = '';
          this.selectArea = '';
        }
      },
      selectCity() {
        if (this.selectCity) {
          this.getDistrict('district', this.selectCity);
        } else {
          this.selectArea = '';
        }
      },
      key() {
        if (this.key.includes('key=') && this.key.includes('v=2.0')) {
				let script = document.createElement('script');
				script.src = this.key;
				document.head.appendChild(script);
				script.onload = () => {
					this.initMap();
				};
			}
      }
    },
    methods: {
      initMap() {
			this.map = new AMap.Map(this.$refs.canvas, {
				resizeEnable: true,
				zoom: this.zoom,
				center: [this.lng, this.lat]
			});
			this.marker = new AMap.Marker();
			this.marker.setPosition([this.lng, this.lat]);
			this.map.add(this.marker);
			this.map.on('zoomend', () => {
				this.zoomCenter();
			});
			this.map.on('moveend', () => {
				this.zoomCenter();
			});

			AMap.plugin(
				['AMap.MouseTool', 'AMap.Geocoder', 'AMap.DistrictSearch', 'AMap.RectangleEditor'],
				() => {
					this.mouseTool = new AMap.MouseTool(this.map);
					this.geocoder = new AMap.Geocoder({});

					this.getDistrict('province', '100000');
				}
			);
		},
      onEditRectEnd() {
        this.rectangleEditor.close();
      },
      onEditRectStart() {
        this.rectangleEditor.open();
      },
      getTileCount(zoom) {
        let b = this.rect.getOptions().bounds;
        let x = lon2tilex(b.northEast.lng, zoom);
        let y = lat2tiley(b.northEast.lat, zoom);

        let x1 = lon2tilex(b.southWest.lng, zoom);
        let y1 = lat2tiley(b.southWest.lat, zoom);

        let startx = Math.min(x, x1),
          endx = Math.max(x, x1);
        let starty = Math.min(y, y1),
          endy = Math.max(y, y1);

        return (endx - startx + 1) * (endy - starty + 1);
      },
      getDistrict(type, adcode) {
        var districtSearch = new AMap.DistrictSearch({
          level: type,

          subdistrict: 1
        });

        // 搜索所有省/直辖市信息
        districtSearch.search(adcode, (status, result) => {
          console.log(result);
          let list = result.districtList[0].districtList;
          switch (type) {
            case 'province':
              this.province = list;
              break;
            case 'city':
              this.city = list;
              break;
            case 'district':
              this.area = list;
              break;
            default:
              break;
          }
        });
      },
      writeBlob(x, y, z) {
        return new Promise((resolve) => {
          getBlob(
            `http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=${
              this.selectStyle || 7
            }&x=${x}&y=${y}&z=${z}`,
            (res) => {
              this.theZip.file(`tiles/${z}/${y}/${x}.png`, res);
              resolve();
            }
          );
        });
      },
      getTileLayer() {
        let b = this.rect.getOptions().bounds;
        let list = [];
        for (let k in this.zoomMap) {
          if (this.zoomMap[k]) {
            let z = parseInt(k);
            let x = lon2tilex(b.northEast.lng, z);
            let y = lat2tiley(b.northEast.lat, z);

            let x1 = lon2tilex(b.southWest.lng, z);
            let y1 = lat2tiley(b.southWest.lat, z);

            let startx = Math.min(x, x1),
              endx = Math.max(x, x1);
            let starty = Math.min(y, y1),
              endy = Math.max(y, y1);

            for (let i = startx; i <= endx; i++) {
              for (let j = starty; j <= endy; j++) {
                list.push({ x: i, y: j, z });
              }
            }
          }
        }
        return list;
      },
      download() {
        let tiles = this.getTileLayer();
        this.$msgbox({
          title: '是否下载?',
          message: `大概需要${(tiles.length * 0.1 / 6).toFixed(2)}秒`,
          showConfirmButton: true,
          showCancelButton: true
        }).then(() => {
          this.isShow = false;
          this.isLoading = true;
          this.process = 0;
          getBlob('tiles.zip', (res) => {
            JSZip.loadAsync(res).then(async (zip) => {
              this.theZip = zip;

              // 同时下载6个，因为高德地图服务器http1.1的限制,并发数为通常为6
              for (let i = 0; i < tiles.length; i += 6) {

                if (i + 5 >= tiles.length) {
                  for (let j = i; j < tiles.length; j++) {
                    await this.writeBlob(tiles[j].x, tiles[j].y, tiles[j].z);
                  }
                  this.process = 100;
                  break;
                }

                await Promise.all([
                  this.writeBlob(tiles[i].x, tiles[i].y, tiles[i].z),
                  this.writeBlob(tiles[i + 1].x, tiles[i + 1].y, tiles[i + 1].z),
                  this.writeBlob(tiles[i + 2].x, tiles[i + 2].y, tiles[i + 2].z),
                  this.writeBlob(tiles[i + 3].x, tiles[i + 3].y, tiles[i + 3].z),
                  this.writeBlob(tiles[i + 4].x, tiles[i + 4].y, tiles[i + 4].z),
                  this.writeBlob(tiles[i + 5].x, tiles[i + 5].y, tiles[i + 5].z)
                ]);
                this.process = (((i + 5) / tiles.length) * 100).toFixed(2);
              }

              this.theZip.file(
                `README.md`,
                `# 文件夹目录\n${this.rule}\n\n# 当前地图瓦片 \n 范围：${this.rectLngLat}\n中心点:${this.centerLnglat}`
              );
              this.theZip.generateAsync({ type: 'blob' }).then((blob) => {
                saveAs(blob, '离线高德地图瓦片' + new Date().getTime() + '.zip');
              });
              this.isLoading = false;
            });
          });
        });
      },
      onSearch() {
        if (this.selectType == 'address') {
          if (this.searchKey) {
            this.geocoder.getLocation(this.searchKey, (status, result) => {
              if (status === 'complete' && result.geocodes.length) {
                var lnglat = result.geocodes[0].location;

                this.marker.setPosition(lnglat);

                this.map.setCenter(lnglat);
              } else {
                this.$message.error('根据地址查询位置失败');
              }
            });
          } else {
            this.$message.error('请输入搜索关键词');
          }
        } else {
          this.district = new AMap.DistrictSearch({
            subdistrict: 0, //获取边界不需要返回下级行政区
            extensions: 'all', //返回行政区边界坐标组等具体信息
            level: 'district' //查询行政级别为 市
          });
          console.log(this.currentAdcode);
          this.district.search(this.currentAdcode, (status, result) => {
            if (status === 'complete' && result.districtList.length) {
              console.log(result.districtList);
              var bounds = result.districtList[0].boundaries;
              if (bounds) {
                //生成行政区划polygon
                for (var i = 0; i < bounds.length; i += 1) {
                  //构造MultiPolygon的path
                  bounds[i] = [bounds[i]];
                }
                if (!this.polygon) {
                  this.polygon = new AMap.Polygon({
                    strokeWeight: 1,
                    path: bounds,
                    fillOpacity: 0.4,
                    fillColor: '#80d8ff',
                    strokeColor: '#0091ea'
                  });
                } else {
                  this.polygon.setPath(bounds);
                }

                this.map.add(this.polygon);
                this.map.setCenter(this.polygon.getBounds().getCenter());
                this.map.setFitView(this.polygon);
              }
            } else {
              this.$message.error('根据地址查询位置失败');
            }
          });
        }
      },
      clearRect() {
        if (this.rectangleEditor) {
          this.rectangleEditor.close();
          this.map.remove(this.rectangleEditor);
        }
        if (this.rect) {
          this.map.remove(this.rect);
        }

        this.rect = null;
      },
      drawRect() {
        this.clearRect();
        this.$nextTick(() => {
          this.mouseTool.rectangle({
            fillColor: '#1e90ff',
            fillOpacity: 0.2,
            strokeColor: '#1e90ff'
          });
          this.mouseTool.on('draw', (e) => {
            this.rect = e.obj;
            this.mouseTool.close(false);
            this.rectangleEditor = new AMap.RectangleEditor(this.map, this.rect);

            this.rectangleEditor.open();
          });
        });
      },

      zoomCenter() {
        if (!this.isLock) {
          this.isLock = true;
          setTimeout(() => {
            this.zoom = Math.round(this.map.getZoom());
            let center = this.map.getCenter();
            this.lat = center.lat;
            this.lng = center.lng;
            this.isLock = false;
          }, 1000);
        }
      }
    },
    mounted() {
      if (window.AMap) {
        this.initMap();
      }
    }
  };
</script>
<style lang="scss" scoped>
  .loading {
    position: fixed;
    z-index: 99999;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    height: 100%;
    width: 100%;
    top: 0px;
    left: 0px;
  }
  .offline-amap-container {
    position: absolute;
    height: 100%;
    width: 100%;
    color: black;
    button {
      border: none;
      background-color: dodgerblue;
      min-width: 100px;
      color: white;
      height: 40px;
      &:active {
        filter: brightness(1.3);
      }
    }
    .left-tool {
      position: fixed;
      top: 40%;
      left: 0px;
      z-index: 3;
      display: inline-flex;

      flex-direction: column;
      width: 100px;
      > button {
        width: 100%;
        margin: 0px;
      }
      > button:not(:last-child) {
        margin-bottom: 10px;
      }
    }
    .bottom-info {
      position: fixed;
      bottom: 0px;
      display: block;
      width: 100%;
      height: 32px;
      line-height: 32px;
      font-size: 14px;
      color: white;
      text-align: center;
      z-index: 2;
      background-color: black;
    }
    .search-container {
      position: fixed;
      top: 100px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      height: 40px;
      button {
        margin: 0 4px;
      }
      input,
      select {
        background-color: white;
        border: solid #1e90ff 1px;
        height: 40px;
        padding: 0 8px;
        line-height: 1;
        outline: none;
        font-size: 16px;
        &::placeholder,
        &::-webkit-input-placeholder,
        &::-moz-placeholder {
          color: gray;
        }
      }
    }
    .canvas {
      height: 100%;
      width: 100%;
    }
  }
</style>
