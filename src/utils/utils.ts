import type JSZip from 'jszip';
import type {LngLatXY} from './projection';
import {cloneDeep} from 'lodash-es';

export const downloadFile = (buffer: Blob, filename: string) => {
  const url = URL.createObjectURL(new File([buffer], filename));
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

export const writeZip = async (
  zip: JSZip,
  url: string,
  x: number,
  y: number,
  z: number
) => {
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
  rootId: any;
};
export function list2tree(
  data: any,
  {id, parentId, children, rootId}: List2TreeConfig = {
    id: 'id',
    parentId: 'parentId',
    children: 'children',
    rootId: undefined
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
    if (a.geometry.type === 'MultiPolygon') {
      a.geometry.coordinates.forEach((b: any) => {
        b.forEach((c: any) => {
          cb(c, a.properties);
        });
      });
    } else {
      a.geometry.coordinates.forEach((c: any) => {
        cb(c, a.properties);
      });
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
