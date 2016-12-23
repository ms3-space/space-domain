export class ViewBuilder {
}

export class ViewModel {

  vm:any;
  fields:any;

  constructor(vm?:any) {
    this.vm = vm || {};

    for (let prop in this.fields) {
      if (delete this[prop]) {
        // Create new property with getter and setter
        Object.defineProperty(this, prop, {
          get: () => {
            if (this.vm.get) {
              return this.vm.get(prop)
            } else {
              return this.vm[prop];
            }
          },
          set: (val) => {
            if (this.vm.set) {
              this.vm.set(prop, val)
            } else {
              this.vm[prop] = val;
            }
          },
          enumerable: true,
          configurable: true
        });
      } else {
        console.log('ERROR could not defineProperty on viewmodel ' + this);
      }
    }
  }

  getData() {
    return this.vm;
  }

  destroy() {
    this.vm.destroy();
  }
}

export function create(target:any, key:string, value:any) {
}

export function update(target:any, key:string, value:any) {
}

export function collection(name:string, viewBuilderMetadata?:any) {
  return (target:any) => {
    target.prototype.collection = () => name;
    target.prototype.viewBuilderMetadata = () => viewBuilderMetadata;
  };
}
