import {cloneDeep} from 'lodash-es';
import gcoord from 'gcoord';
import {mapstore as state, store} from '../XYZGrid/store';
import JSZip from 'jszip';

export function convertBase64UrlToFile(base64: string, fileName: string) {
  let parts = base64.split(';base64,');
  let contentType = parts[0].split(':')[1];
  let raw = window.atob(parts[1]);
  let rawLength = raw.length;
  let uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; i++) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new File([uInt8Array], fileName, {type: contentType});
}
export const downloadFile = (buffer: Blob | File, filename: string) => {
  const f = buffer instanceof File ? buffer : new File([buffer], filename);
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.style = 'display: none';
  a.download = filename;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
export const sleep = (time: number = 1000) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(time);
    }, time);
  });
};
export const isEmpty = (v: any) => {
  if (v === undefined || v === '' || v === null || Number.isNaN(v)) return true;
  return false;
};
export function getBlob(url: string) {
  return new Promise<Blob>((resolve, reject) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        resolve(blob);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export const writeZip = async (zip: JSZip, url: string, x: number, y: number, z: number) => {
  try {
    const file = await getBlob(url);
    if (file) {
      zip.file(`tiles/${z}/${y}/${x}.png`, file);
    }
  } catch (error) {
    console.log('err', url);
  }
};

export const checkBounds = (b: any[]) => {
  if (b.length === 2 && b[0][0] && b[0][1] && b[1][0] && b[1][1]) return true;
  return false;
};

export const getTime = (t: number) => {
  let time = Math.round(t);

  const str: string[] = [];
  if (time >= 3600) {
    const h = Math.floor(time / 3600);
    time -= h * 3600;
    str.push(h + '小时');
  }
  if (time >= 60) {
    const m = Math.floor(time / 60);
    time -= m * 60;
    str.push(m + '分钟');
  }
  if (time > 0) {
    str.push(time + '秒');
  }
  return str.join('');
};
export type List2TreeConfig = {
  id: string;
  parentId: string;
  children: string;
};
export function list2tree(
  data: any,
  {id, parentId, children}: List2TreeConfig = {
    id: 'id',
    parentId: 'parentId',
    children: 'children'
  }
) {
  const list = cloneDeep(data);
  const map: any = {};
  const root: any[] = [];

  list.forEach((item: any) => {
    if (!item[parentId]) {
      root.push(item);
    } else {
      if (Array.isArray(map[item[parentId]])) {
        map[item[parentId]].push(item);
      } else {
        map[item[parentId]] = [item];
      }
    }
  });

  function toTree(root: any, map: any) {
    for (let k in map) {
      for (let i = 0; i < root.length; i++) {
        if (root[i][id] == k) {
          root[i][children] = map[k];
          delete map[k];
          toTree(root[i][children], map);
        }
      }
    }
  }
  toTree(root, map);
  return root;
}

export function travelGeo(geojson: any, cb: Function) {
  geojson.features.forEach((a: any) => {
    const type = a.geometry.type.toLowerCase();
    if (['multipolygon'].includes(type)) {
      const t = type.replace('multi', '');
      a.geometry.coordinates.forEach((b: any) => {
        b.forEach((c: any) => {
          cb(c, {type: t, data: a.properties});
        });
      });
    } else if (['multipoint', 'multilinestring', 'polygon', 'linestring'].includes(type)) {
      const t = type.replace('multi', '');
      a.geometry.coordinates.forEach((c: any) => {
        cb(c, {type: t, data: a.properties});
      });
    } else if ('point' === type) {
      cb(a.geometry.coordinates, {type: type, data: a.properties});
    } else if ('geometrycollection' === type) {
      travelGeo(
        {
          features: a.geometries
        },
        cb
      );
    }
  });
}
export const uploadFile = (accept: string) => {
  return new Promise<File>((resolve) => {
    const upload = document.createElement('input');
    upload.style.position = 'fixed';
    upload.style.opacity = '0';
    upload.accept = accept;
    upload.type = 'file';
    upload.onchange = () => {
      if (upload.files?.length) {
        resolve(upload.files[0]);
      }
      document.body.removeChild(upload);
    };
    document.body.appendChild(upload);
    upload.click();
  });
};

export const gcTowgs84 = (lng: number, lat: number) => {
  return gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
};

export const downloadZip = (queue: any[], start: number) => {
  return new Promise(async (resolve) => {
    const {minLevel, maxLevel} = state.value;

    const zip = new JSZip();
    //异步加载图片绘制到canvas上，http1.1的同一个域名下TCP并发连接数4-8个，通常6个。
    for (let i = 0; i < queue.length; i += 6) {
      const list = queue.slice(i, i + 6);
      store.value.current = start + i;
      await Promise.all(list.map((a) => writeZip(zip, a.url, a.x, a.y, a.z)));
      await sleep();
    }

    zip
      .generateAsync({type: 'blob'})
      .then(function (content) {
        downloadFile(
          content,
          `瓦片层级[${minLevel}-${maxLevel}][${start}]${new Date().getTime()}.zip`
        );
      })
      .finally(() => {
        resolve(start);
      });
  });
};

export const splitMapCanvas = (
  zip: JSZip,
  canvas: HTMLCanvasElement,
  zoom: number,
  tileSize: number,
  queue: Array<{x: number; y: number}>
) => {
  let idx = 0;
  for (let x = 0; x < canvas.width; x += tileSize) {
    for (let y = 0; y < canvas.height; y += tileSize) {
      const {x: x1, y: y1} = queue[idx];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = tileSize;
      tempCanvas.height = tileSize;
      const tempctx = tempCanvas.getContext('2d')!;
      tempctx.drawImage(canvas, x, y, tileSize, tileSize, 0, 0, tileSize, tileSize);

      const base64 = tempCanvas.toDataURL('image/png');
      const file = convertBase64UrlToFile(base64, zoom + '.png');

      zip.file(`tiles/${zoom}/${y1}/${x1}.png`, file);
      idx++;
    }
  }
};
