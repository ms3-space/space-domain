import objectAssign = require("object-assign");
import {Event} from './events';
require('reflect-metadata');

export interface ICommand {
  _cmdId:string;
  command():string;
}

export interface IPayload {
  aggregateId?:string;
}

export abstract class BaseCommand implements ICommand {
  _cmdId:string;
  validations:any[];

  command():string {
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

  abstract toJson():any;
}

export class Aggregate {
  aggregate:any;
  id:string;
  fields:any;

  constructor(aggregate?:any) {
    if (aggregate) {
      this.aggregate = aggregate;
      this.id = aggregate.id;
    }
  }

  apply<TEvent extends Event>(event:TEvent) {
    this.aggregate.apply(event.eventName, event);
  }

  get(prop:string) {
    return this.aggregate.get(prop);
  }

  set(prop:string, value:any) {
    this.aggregate.set(prop, value);
  }
}

export abstract class Command extends BaseCommand {
  aggregateId():string {
    return undefined;
  }

  aggregateIdField:string;

  constructor(payload?:any, id?:string) {
    super();
    this._cmdId = id;
    if (payload) {
      for (var i in payload) {
        this[i] = payload[i];
      }
    }
  }

  getAllFieldNames() {

    let fields = this['fields'] || [];

    let fieldNames = Object.getOwnPropertyNames(fields);
    if(this.aggregateIdField && !fields[this.aggregateIdField]){
      fieldNames.push(this.aggregateIdField);
    }

    return fieldNames;
  }

  handleCommand(data:any, aggregate:any, errors?:any) {
    this.handle(data, aggregate, errors);
  }

  abstract handle(data:any, aggregate:Aggregate, errors?:any);

  toJson():any {
    let aggId;

    if (this.aggregateIdField && this[this.aggregateIdField]) {
      aggId = this[this.aggregateIdField];
    } else {
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
      json.aggregate = {id: aggId}
    }

    return json;
  }
}

export function cmd(name:string) {
  return (target:any) => {
    target.prototype.command = () => name;
  };
}

export function aggregate(target:any) {
  // property getter
  var getGetter = function (prop) {
    return function () {
      let val = this.aggregate.get(prop);
      // console.log('getting ' + prop + ' of ' + val);
      return val;
    }
  };

  var getSetter = function (prop) {
    let that = this;
    return function (val) {
      // console.log('setting ' + prop + ' to ' + val);
      return this.aggregate.set(prop, val);
    }
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
    } else {
      console.log('ERROR could not defineProperty');
    }
  }

  return target;
}

export function required(target:any, key:string) {
  target = target || this;
  makeRequired(target, key, true);
}

function makeRequired(target:any, key:string, makeField:boolean) {

  if(makeField)
    field(target, key);

  // copy validations from base class / command
  if(!target.hasOwnProperty('validations')){
    const inheritedValidations = objectAssign({}, target.validations);
    Object.defineProperty(target, 'validations', {value: inheritedValidations});
  }

  let validations = target.validations;

  validations[key] = (obj, field) => {
    let val = obj[field];
    if ((!val && val !== false) || val.length < 1) {
      let err = {};
      err[field] = {error: 'required'};
      return [err];
    }
  };
}

function guessType(key:string, langType:string):string {
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

  if(langType == 'Number'){
    return 'number';
  }

}

export function field(target:any, key:string) {
  let fields = target.fields = target.fields || {};
  let f = {label: key, type: 'shorttext', languageType: undefined};

  const reflect:any = Reflect;
  let langType = reflect.getMetadata("design:type", target, key);

  f.languageType = langType.name;
  f.type = guessType(key, langType.name);

  fields[key] = f;
}

export function aggregateId(target:any, key:string){

  target = target || this;

  if (target.aggregateIdField) {
    throw new Error('Only one field can be specified as aggregateId. Field ' + target.aggregateidfield + ' is already marked as aggregateId');
  }
  // the aggregateId field is always implicitly required
  makeRequired(target, key, false);
  target.aggregateIdField = key;
}
