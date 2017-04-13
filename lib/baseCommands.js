"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const objectAssign = require("object-assign");
require('reflect-metadata');
class BaseCommand {
    command() {
        return null;
    }
    getFields() {
        return this['fields'];
    }
    validate() {
        let errors = [];
        for (let i in this.validations) {
            let v = this.validations[i];
            let fieldErrors = v(this, i);
            if (fieldErrors) {
                errors = errors.concat(fieldErrors);
            }
        }
        return errors;
    }
}
exports.BaseCommand = BaseCommand;
class Aggregate {
    constructor(aggregate) {
        if (aggregate) {
            this.aggregate = aggregate;
        }
    }
    apply(event) {
        this.aggregate.apply(event.eventName, event);
    }
    get(prop) {
        return this.aggregate.get(prop);
    }
    set(prop, value) {
        this.aggregate.set(prop, value);
    }
}
exports.Aggregate = Aggregate;
class Command extends BaseCommand {
    aggregateId() {
        return undefined;
    }
    constructor(payload, id) {
        super();
        this._cmdId = id;
        if (payload) {
            for (var i in payload) {
                this[i] = payload[i];
            }
        }
    }
    getAggregateId() {
        if (this.aggregateIdField && this[this.aggregateIdField]) {
            return this[this.aggregateIdField];
        }
        return undefined;
    }
    getAllFieldNames() {
        let fields = this['fields'] || [];
        let fieldNames = Object.getOwnPropertyNames(fields);
        if (this.aggregateIdField && !fields[this.aggregateIdField]) {
            fieldNames.push(this.aggregateIdField);
        }
        return fieldNames;
    }
    handleCommand(data, aggregate, errors) {
        this.handle(data, aggregate, errors);
    }
    toJson() {
        let aggId;
        if (this.aggregateIdField && this[this.aggregateIdField]) {
            aggId = this[this.aggregateIdField];
        }
        else {
            aggId = this.aggregateId();
        }
        let payload = objectAssign({}, this);
        let json = {
            id: this._cmdId || 'cmd-' + Date.now(),
            command: this.command(),
            payload,
            aggregate: null
        };
        if (aggId) {
            json.aggregate = { id: aggId };
        }
        return json;
    }
}
exports.Command = Command;
function cmd(name) {
    return (target) => {
        target.prototype.command = () => name;
    };
}
exports.cmd = cmd;
function aggregate(target) {
    // property getter
    var getGetter = function (prop) {
        return function () {
            let val = this.aggregate.get(prop);
            // console.log('getting ' + prop + ' of ' + val);
            return val;
        };
    };
    var getSetter = function (prop) {
        let that = this;
        return function (val) {
            // console.log('setting ' + prop + ' to ' + val);
            return this.aggregate.set(prop, val);
        };
    };
    for (let prop in target.prototype.fields) {
        if (delete target.prototype[prop]) {
            // Create new property with getter and setter
            Object.defineProperty(target.prototype, prop, {
                get: getGetter(prop),
                set: getSetter(prop),
                enumerable: true,
                configurable: true
            });
        }
        else {
            console.log('ERROR could not defineProperty');
        }
    }
    return target;
}
exports.aggregate = aggregate;
function required(target, key) {
    target = target || this;
    makeRequired(target, key, true);
}
exports.required = required;
function makeRequired(target, key, makeField) {
    if (makeField)
        field(target, key);
    // copy validations from base class / command
    if (!target.hasOwnProperty('validations')) {
        const inheritedValidations = objectAssign({}, target.validations);
        Object.defineProperty(target, 'validations', { value: inheritedValidations });
    }
    let validations = target.validations;
    validations[key] = (obj, field) => {
        let val = obj[field];
        if ((!val && val !== false) || val.length < 1) {
            let err = {};
            err[field] = { error: 'required' };
            return [err];
        }
    };
}
function guessType(key, langType) {
    if (key == 'description' || /.*notes/.test(key)) {
        return 'longtext';
    }
    else if (/.*amount$/i.test(key)) {
        return 'amount';
    }
    else if (/.*date$/i.test(key)) {
        return 'date';
    }
    else if (/.*month$/i.test(key)) {
        return 'month';
    }
    if (langType == 'Number') {
        return 'number';
    }
}
function field(target, key) {
    let fields = target.fields = target.fields || {};
    let f = { label: key, type: 'shorttext', languageType: undefined };
    const reflect = Reflect;
    let langType = reflect.getMetadata("design:type", target, key);
    f.languageType = langType.name;
    f.type = guessType(key, langType.name);
    fields[key] = f;
}
exports.field = field;
function aggregateId(target, key) {
    target = target || this;
    if (target.aggregateIdField) {
        throw new Error('Only one field can be specified as aggregateId. Field ' + target.aggregateidfield + ' is already marked as aggregateId');
    }
    // the aggregateId field is always implicitly required
    makeRequired(target, key, false);
    target.aggregateIdField = key;
}
exports.aggregateId = aggregateId;
//# sourceMappingURL=baseCommands.js.map