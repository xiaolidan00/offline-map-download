---
theme: cyanosis
---

简直无语，瓦片地图明明是开放的，不用钱的，竟然有网站和程序要收费，本人绝不当冤大头，自己动手丰衣足食！
其实也有某些免费下载离线地图的良心程序，但因为下载瓦片的请求太频繁了，搞得打开该地图的时候卡死，被人家服务器记住了！

# 1.墨卡托投影

就是将原本在地球（假设是球体）的贴图强行铺平成一张矩形贴图，根据再在经纬度和 xy 坐标做一个转换

![v2-00991c24c72667fccdab88740ad108e4_b.jpg](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7c7bc0fd22934fbcaeddb7ef13f334d3~tplv-k3u1fbpfcp-watermark.image?)

# 2.瓦片地图

根据地图的缩放等级，对应不同贴图大小，根据墨卡托投影分割成不同放个块，就是对应的瓦片地图，可以根据一下公式进行转换，算出该坐标在哪块瓦片里面

```js
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
```

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a444c85cd7a49818c272a939214f26b~tplv-k3u1fbpfcp-watermark.image?)

# 3.使用到的库

- `jszip`用于把瓦片地图写入到压缩包里面，统一下载

- `地图API`自己去官网注册一个 key，我这里以高德地图为例，如果是百度，腾讯等地图的瓦片，最好用他们的地图，避免经纬度转换的问题，注意：高德和腾讯都用的火星 gcj 经纬度，百度自己一套的。

- 相关离线瓦片地图开放地址参考

> https://www.cnblogs.com/feiquan/p/14304660.html > https://blog.csdn.net/qq_19689967/article/details/121221727

# 4.实现步骤

## 1.定位，在地图确认范围

```js
      drawRect() {
        this.clearRect();
        this.mouseTool.rectangle({
          fillColor: '#1e90ff',
          fillOpacity: 0.2,
          strokeColor: '#1e90ff'
        });
        this.mouseTool.on('draw', e => {
          this.rect = e.obj;
          this.mouseTool.close(false);
          this.rectangleEditor = new AMap.RectangleEditor(this.map, this.rect);

          this.rectangleEditor.open();
        });
      },
```

## 2.根据缩放等级范围计算瓦片数量

```js
//获取某个等级的瓦片数量
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
      //获取不同缩放等级的数量
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

```

## 3.根据选择的缩放等级、文件写入规则、瓦片类型，下载写入 zip 包

> 高德地图开放瓦片地图资源

```js
styles: [
  { label: '普通地图', value: '7' },
  { label: '卫星地图', value: '6' },
  { label: '路况地图', value: '8' }
]`http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=${
  this.selectStyle || 7
}&x=${x}&y=${y}&z=${z}`;
```

> 获取高德地图瓦片地图，下载的是 256x256 的 png 图片，如果需要不同的文件写入目录请自行更改`tiles/${z}/${y}/${x}.png`,注意一定要 setTimeout 间隔点时间再请求下一个，避免请求太频繁，被高德地图限制。

```js
writeBlob(x, y, z) {
        return new Promise(resolve => {
          getBlob(
            `http://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=${this.selectStyle ||
              7}&x=${x}&y=${y}&z=${z}`,
            res => {
              this.theZip.file(`tiles/${z}/${y}/${x}.png`, res);
              setTimeout(() => {
                resolve();
              }, 10);
            }
          );
        });
      },
```

> 要先将一个 zip 包放在 public 文件夹下，获取到 zip 包再通过 JSZip 写入瓦片

```js

download() {
        let tiles = this.getTileLayer();
        this.$msgbox({
          title: '是否下载?',
          message: `大概需要${(tiles.length * 0.1).toFixed(2)}秒`,
          showConfirmButton: true,
          showCancelButton: true
        }).then(() => {
          this.isShow = false;
          this.isLoading = true;
          this.process = 0;
          //写入事先准备好的瓦片地图zip包
          getBlob('tiles.zip', res => {
            JSZip.loadAsync(res).then(async zip => {
              this.theZip = zip;

              for (let i = 0; i < tiles.length; i++) {
                let item = tiles[i];
                await this.writeBlob(item.x, item.y, item.z);
                this.process = ((i / tiles.length) * 100).toFixed(2);
              }
              //写入相关信息
              this.theZip.file(
                `README.md`,
                `# 文件夹目录\n${this.rule}\n\n# 当前地图瓦片 \n 范围：${this.rectLngLat}\n中心点:${this.centerLnglat}`
              );
              this.theZip.generateAsync({ type: 'blob' }).then(blob => {
                saveAs(blob, '离线高德地图瓦片' + new Date().format('yyyyMMddhhmmss') + '.zip');
              });
              this.isLoading = false;
            });
          });
        });
      },
```

## 完整代码地址

> https://github.com/xiaolidan00/offline-map-download

# 5.使用瓦片地图

## 画个范围

![搜狗截图20230421212506.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2f30d74dee8e45a1b5abecc8dc9d8650~tplv-k3u1fbpfcp-watermark.image?)

## 再选择下载缩放等级，然后等待下载的 zip 包就好

![搜狗截图20230421212924.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a2fef3d7856e4e2e9e03e6d912a40b85~tplv-k3u1fbpfcp-watermark.image?)

## zip 包目录:README.md 就是下载时的相关信息

```
README.md
# 文件夹目录
tiles/[z]/[y]/[x].png

# 当前地图瓦片
 范围：113.353114,23.02803;113.43286,23.074142
中心点:113.392987,23.051086

```

## 对应瓦片的地址,把 zip 包的 tiles 解压放在一个访问的地址

tiles/z/y/x/1234.png

## 使用离线高德地图 maps.js 验证下载的瓦片地图

> mapBox，mapTalks,Leafle 等常用离线地图验证都行，但是他们都一个通病，就是加载瓦片地图的时候巨卡，而且会出现莫名其妙缺一块的情况（就是你打开文件夹有图片，它就是叛逆不加载的情况）。然后我选择了直接利用离线的高德地图 maps.js，流畅度甩别人一条街！而且那些高德地图的 API 你也可以用了！这简直太优秀了！

**注意：**

1. `getTileUrl`瓦片地图地址，一定要用 function,直接字符串，默认走 https 就 404 了

2. 不要用 defaultLayer 来加载地图，会加载不了瓦片地图，要叠加一层 layer

3. 避免加载空白一定要限定缩放范围 zooms 和边界方位 bounds

文件地址：public/offlineMap.html 可测试验证离线地图

```html
<div id="container"></div>
<script>
  function initMap() {
    var map = new AMap.Map('container', {
      zoom: 15,
      //下载范围的中心点
      center: [113.392987, 23.051086],
      zooms: [14, 15]
    });
    //一定要全地址，瓦片不走相对地址的
    let tileUrl = 'http://127.0.0.1:5500/public/tiles/[z]/[y]/[x].png';
    let xyzLayer = new AMap.TileLayer({
      // 瓦片地图地址，一定要用function,直接字符串，默认走https就404了
      getTileUrl: function (x, y, z) {
        return tileUrl.replace('[x]', x).replace('[y]', y).replace('[z]', z);
      },
      //限制缩放等级为下载的等级
      zooms: [14, 15],
      zIndex: 10,
      tileSize: 256
    });
    map.add(xyzLayer);
    let b = [113.353114, 23.02803, 113.43286, 23.074142];
    //限制范围，避免加载到空瓦片
    let bounds = new AMap.Bounds([b[2], b[3]], [b[0], b[1]]);

    map.setBounds(bounds);
    map.setLimitBounds(bounds);
  }
</script>
```

## 效果

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/28877df10dbf4c52a458f76d4e80019f~tplv-k3u1fbpfcp-watermark.image?)

- 上图是高德地图瓦片地图，下图是原来的高德地图，可以看到上面的字比平时使用的矢量高德地图大，颜色也有所不同的。

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/308cd29f06b046fd894f8c526de1ca3d~tplv-k3u1fbpfcp-watermark.image?)

> 目前高德地图开放的瓦片地图样式只有卫星，交通，普通三种，样式上满足不了你的需求，这时候你只能手动 css,通过 filter 属性对地图瓦片进行魔改。但是这个东东有点副作用，就是把地图上加载的矩形等其他元素也魔改了，因此改动样式需谨慎。

```css
.amap-layer {
  filter: invert(100%);
}
```

![搜狗截图20230421220531.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b58578c1d2c341ae9f4f5e0bd185a555~tplv-k3u1fbpfcp-watermark.image?)

> 如果有耐心的 UI,可以让 UI 批量手改样式（前提是你瓦片真的不多，否则会被 UI 爆头）
