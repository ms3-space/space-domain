"use strict";
class ViewBuilder {
}
exports.ViewBuilder = ViewBuilder;
class ViewModel {
    constructor(vm) {
        this.vm = vm || {};
        for (let prop in this.fields) {
            if (delete this[prop]) {
                // Create new property with getter and setter
                Object.defineProperty(this, prop, {
                    get: () => {
                        if (this.vm.get) {
                            return this.vm.get(prop);
                        }
                        else {
                            return this.vm[prop];
                        }
                    },
                    set: (val) => {
                        if (this.vm.set) {
                            this.vm.set(prop, val);
                        }
                        else {
                            this.vm[prop] = val;
                        }
                    },
                    enumerable: true,
                    configurable: true
                });
            }
            else {
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
exports.ViewModel = ViewModel;
function create(target, key, value) {
}
exports.create = create;
function update(target, key, value) {
}
exports.update = update;
function collection(name, viewBuilderMetadata) {
    return (target) => {
        target.prototype.collection = () => name;
        target.prototype.viewBuilderMetadata = () => viewBuilderMetadata;
    };
}
exports.collection = collection;
//# sourceMappingURL=viewbuilder.js.map