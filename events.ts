export abstract class Event {
  eventName: string;

  apply(aggregate: any) { }

  applyEvent(aggregate: any) {
    this.apply(aggregate);
  }

  constructor(payload?: any) {
    if (payload) {
      for (var i in payload) {
        if (payload.hasOwnProperty(i)) {
          this[i] = payload[i];
        }
      }
    }
  }
}

export function evt(name: string) {
  return (target: any) => {
    target.prototype.evt = () => name;
  };
}
