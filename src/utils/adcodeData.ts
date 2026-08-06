import adcodeList from './adcode.json';
import {list2tree} from './utils';
export const adcodemap: {[n: string]: {full: 1 | 0; parent: string}} = {};
export const area2adcode: Record<string, string> = {};
adcodeList.forEach((it) => {
  area2adcode[it.name] = it.adcode + '';

  adcodemap[it.adcode + ''] = {
    full: it.full == 1 ? 1 : 0,
    parent: it.parent + ''
  };
});
export const adcodes = list2tree(adcodeList, {
  children: 'children',
  id: 'adcode',
  parentId: 'parent'
});
