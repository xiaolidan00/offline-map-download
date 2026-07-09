import {onMounted, onBeforeUnmount} from 'vue';

type EventCallbacks = Map<Function, number>;
type EventMap = Map<string, EventCallbacks>;
export class EventEmitter {
  eventMap: EventMap = new Map();

  on(event: string, fn: Function) {
    if (typeof fn === 'function') {
      const fns = this.eventMap.get(event) as EventCallbacks;
      if (fns) {
        if (!fns.has(fn)) {
          fns.set(fn, 1);
        }
      } else {
        //采用map可以更加快速增删改查
        const fns = new Map<Function, number>();
        fns.set(fn, 1);
        this.eventMap.set(event, fns.set(fn, 1));
      }
    }
  }
  off(event: string, fn: Function) {
    if (typeof fn === 'function') {
      const fns = this.eventMap.get(event) as EventCallbacks;
      if (fns?.has(fn)) {
        fns.delete(fn);
      }
    }
  }
  emit(event: string, ...args: any[]) {
    const fns = this.eventMap.get(event) as EventCallbacks;
    if (fns) {
      fns.forEach((i: number, fn: Function) => {
        fn(...args);
      });
    }
  }
  once(event: string, fn: Function) {
    //包裹一层function，一旦触发就销毁
    const fun = (...args: any[]) => {
      fn(...args);
      this.off(event, fun);
    };
    this.on(event, fun);
  }
  clear() {
    this.eventMap.clear();
  }
}
export const EventBus = new EventEmitter();
export const useEventBus = (eventName: string, cb: Function) => {
  onMounted(() => {
    EventBus.on(eventName, cb);
  });
  onBeforeUnmount(() => {
    EventBus.off(eventName, cb);
  });
};
