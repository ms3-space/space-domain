import {config} from "space-config";
let debug = require('debug')('space-domain');

import {BaseCommand} from "./baseCommands";
import objectAssign = require("object-assign");

let path = require('path');
let fs = require('fs');
let _ = require('lodash');
var events = require('events');
require('reflect-metadata');

export let eventDenormalizer = undefined;
let cqrsDomain = undefined;

let domainHelper = require('cqrs-domain');
let denormalizerHelper = require('cqrs-eventdenormalizer');


let getCurrentUser = (request:any) => 'anonymous';

let commands = {};
let viewBuilders = {};

let errors = new events.EventEmitter();
let denormalizerStatus = new events.EventEmitter();

let partitionKeyResolver = () => undefined;
export let getPartitionKey = () => partitionKeyResolver();

export let domain = {
  getCommands: () => commands,

  init: function (options, cb) {

    getCurrentUser = options.getCurrentUser;
    partitionKeyResolver = options.getPartitionKey;

    cqrsDomain = require('cqrs-domain')({
      domainPath: options.domainPath || process.cwd() + '/app/domain',
      eventStore: options.eventStore,
      snapshotThreshold: 100000
    });

    cqrsDomain.defineCommand({
      id: 'id',
      name: 'command',
      aggregateId: 'aggregate.id',
      payload: 'payload',
      revision: 'head.revision'
    });
    cqrsDomain.defineEvent({
      correlationId: 'commandId',
      id: 'id',
      name: 'event',
      aggregateId: 'aggregate.id',
      payload: 'payload',
      revision: 'head.revision'
    });

    let denormalizer = require('cqrs-eventdenormalizer')({
      denormalizerPath: options.denormalizerPath || process.cwd() + '/app/domain',
      repository: options.readModelStore
    });

    denormalizer.defineEvent({
      correlationId: 'correlationId',
      id: 'id',
      name: 'event',
      aggregateId: 'aggregate.id',
      context: 'context.name',
      aggregate: 'aggregate.name',
      payload: 'payload',
      revision: 'revision',
      version: 'version',
      meta: 'meta'
    });

    eventDenormalizer = denormalizer;

    denormalizer.init(function (denormError) {

      if (denormError) {
        console.log('error in denormailzer.init', denormError);
        cb(denormError);
        return debug(denormError);
      }

      denormalizer.tree.getCollections().map(c => c.viewBuilders = []);
      viewBuilders = {};

      cqrsDomain.init(function (err) {

        if (err) {
          console.log('error in domain.init', err);
          cb(err);
          return debug(err);
        }

        let context = cqrsDomain.tree.getContexts()[0];

        let glob = require('glob');
        const domainPath = path.join(__dirname, '../domain/*');

        const aggregateFolders = glob.sync(domainPath);

        aggregateFolders.map(af => {

          let aggregateName = path.basename(af);

          let aggregatePath = path.join(af, aggregateName);
          let aggregateClass = null;

          if (!fs.existsSync(aggregatePath + '.js'))
            return;

          let aggregateModule = require(aggregatePath);
          aggregateClass = aggregateModule[Object.keys(aggregateModule)[0]];

          let aggregate = _.find(context.aggregates, ag => ag.name == aggregateName);

          aggregate.commands = [];
          aggregate.events = [];

          const searchPath = af + '/**/*.js';
          const domainFiles = glob.sync(searchPath);

          const commandBase = require('./baseCommands').Command;
          const eventBase = require('./events').Event;
          const viewBuilderBase = require('./viewbuilder').ViewBuilder;

          domainFiles.forEach((cf) => {

            let agc:any = require(cf);

            for (let commandClass in agc) {
              if (!agc.hasOwnProperty(commandClass))
                continue;

              let anyCommandClass:any = agc[commandClass];
              let isCommand = anyCommandClass.prototype instanceof commandBase;
              let isEvent = anyCommandClass.prototype instanceof eventBase;
              let isViewBuilder = anyCommandClass.prototype instanceof viewBuilderBase;

              if (!isCommand && !isEvent && !isViewBuilder)
                continue;

              if (isCommand) {
                let c = new anyCommandClass();
                if (c.handle === undefined)
                  continue;

                let commandName = c.command();
                let command = null;

                let commandNeedsExistingAggregate = c.aggregateIdField != undefined;

                const commandMetadata = {name: commandName, existing: commandNeedsExistingAggregate};

                command = domainHelper.defineCommand(
                  commandMetadata,
                  (data, aggregate) => new anyCommandClass(data).handle(new aggregateClass(aggregate), errors));

                aggregate.addCommand(command);

                commands[commandName] = anyCommandClass;
              } else if (isEvent) {
                let e = new anyCommandClass();

                let eventName = _.camelCase(commandClass);
                anyCommandClass.prototype.eventName = eventName;

                let eventDefinition = null;
                eventDefinition = domainHelper.defineEvent(
                    {name: eventName},
                    (data, agg) => new anyCommandClass(data).applyEvent(new aggregateClass(agg)));

                aggregate.addEvent(eventDefinition);
              } else if (isViewBuilder && !viewBuilders[cf]) {

                let vb = new anyCommandClass();

                const collectionName = config.get("tablePrefix") + vb.collection();
                const viewBuilderMetadata = vb.viewBuilderMetadata();
                const coll = _.find(denormalizer.tree.getCollections(), c => c.name == collectionName);

                for (var key of Object.getOwnPropertyNames(anyCommandClass.prototype)) {
                  let method = key;

                  if (/when.+/.test(method) === false)
                    continue;

                  const reflect:any = Reflect;
                  let metadata = reflect.getMetadata("design:paramtypes", vb, method);

                  if (metadata) {
                    const event = new metadata[0]();
                    const eventName = _.camelCase(event.constructor.name);

                    const finalMetadata = objectAssign(
                      {
                        id: 'payload.id', // if not defined or not found it will generate a new viewmodel with new id
                        payload: 'payload',
                        name: eventName,
                      },
                      viewBuilderMetadata);

                    const newBuilder = denormalizerHelper.defineViewBuilder(finalMetadata, function (data, vm) {
                      let partitionKey = options.getPartitionKey();
                      vm.set('PartitionKey', partitionKey);
                      vm.set('RowKey', vm.id.toString());

                      const viewModel = metadata[1];
                      vb[method](data, new viewModel(vm));
                    });

                    viewBuilders[cf] = newBuilder;
                    coll.addViewBuilder(newBuilder);
                  }
                }
              }
            }
          });


          cqrsDomain.onEvent(function (evt) {
            denormalizerStatus.emit('startedDenormalizing', evt);

            debug('onEvent', evt);
            denormalizer.handle(evt, () => {
              denormalizerStatus.emit('completedDenormalizing', evt);
            });
          });
        });

        if (cb) {
          cb();
        }

      });
    });
  },
  handle: function (cmd:BaseCommand, req:any, observeEvents?):Promise<any> {

    return new Promise<any>((resolve, reject) => {

      if (!req)
        return reject('missing req parameter');

      if (cmd.validate) {
        var validationErrors = cmd.validate();
        if (validationErrors.length > 0) {
          return reject('validation errors: ' + JSON.stringify(validationErrors));
        }
      }

      let cmdJson = cmd.toJson();
      if (getCurrentUser) {
        let currentUser = getCurrentUser(req);
        if (cmdJson.payload.createdBy && cmdJson.payload.createdBy !== currentUser) {
          return reject('createdBy property of command does not match current user');
        }
        cmdJson.payload.createdBy = currentUser;
      }
      else if (cmdJson.payload.createdBy) {
        return reject('could not validate current user');
      }

      function removeListeners() {
        errors.removeAllListeners('commandError');
        denormalizerStatus.removeAllListeners('startedDenormalizing');
        denormalizerStatus.removeAllListeners('completedDenormalizing');
      }

      let errorHandler = function cmdError(err) {
        removeListeners();
        return reject(err);
      };

      errors.on('commandError', errorHandler);

      let denormalizersActive = 0;

      denormalizerStatus.on('startedDenormalizing', () => {
        denormalizersActive++;
      });

      denormalizerStatus.on('completedDenormalizing', (evt) => {
        denormalizersActive--;
        if (observeEvents) {
          observeEvents(evt);
        }
      });

      cqrsDomain.handle(cmdJson, (err, result) => {
        if (denormalizersActive > 0) {
          denormalizerStatus.on('completedDenormalizing', () => {
            if (denormalizersActive === 0) {
              removeListeners();

              if (err) {
                return reject(err);
              }

              resolve(result);
            }
          });
        } else {

          removeListeners();

          if (err) {
            return reject(err);
          }

          resolve(result);
        }
      });
    });
  }
};
