import {config} from "space-config";
import {getPartitionKey} from "./domain";

import domain = require('cqrs-domain');
import denormalizer = require('cqrs-eventdenormalizer');
import objectAssign = require("object-assign");

export const define = {
  defineCommand: function(handler:(data, aggregate) => any) {
    return domain.defineCommand({}, handler);
  },
  defineEvent: function(handler?) {
    var handler = handler || function() {};
    return domain.defineEvent({}, handler);
  },
  defineViewBuilder: function (handler, metadata?) {
    let meta = objectAssign({}, {
        id: 'payload.id', // if not defined or not found it will generate a new viewmodel with new id
        payload: 'payload', // optional, if not defined it will pass the whole event...
      }, metadata);

    return denormalizer.defineViewBuilder(
      meta,
      function (data, vm) { // instead of function you can define a string with default handling ('create', 'update', 'delete')
        let partitionKey = getPartitionKey();
        vm.set('PartitionKey', partitionKey);
        handler(data, vm);
      });
  },
  defineCollection: function(name){
    return denormalizer.defineCollection(
      {
        name: config.get("tablePrefix") + name
      }
    )
  }
};
