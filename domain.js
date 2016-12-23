"use strict";
const space_config_1 = require("@ms3/space-config");
let debug = require('debug')('space-domain');
const objectAssign = require("object-assign");
let path = require('path');
let fs = require('fs');
let _ = require('lodash');
var events = require('events');
require('reflect-metadata');
exports.eventDenormalizer = undefined;
let cqrsDomain = undefined;
let domainHelper = require('cqrs-domain');
let denormalizerHelper = require('cqrs-eventdenormalizer');
let getCurrentUser = (request) => 'anonymous';
let commands = {};
let viewBuilders = {};
let _options = {};
let errors = new events.EventEmitter();
let denormalizerStatus = new events.EventEmitter();
let partitionKeyResolver = () => undefined;
exports.getPartitionKey = () => partitionKeyResolver();
exports.getOptions = () => _options;
let denormalizersActive = 0;
exports.domain = {
    getCommands: () => commands,
    init: function (options, cb) {
        _options = options;
        let domainPath = options.domainPath || process.cwd() + '/app/domain';
        getCurrentUser = options.getCurrentUser;
        partitionKeyResolver = options.getPartitionKey;
        cqrsDomain = require('cqrs-domain')({
            domainPath: domainPath,
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
        exports.eventDenormalizer = denormalizer;
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
                const aggregateFolders = glob.sync(domainPath + '/*');
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
                        let agc = require(cf);
                        for (let commandClass in agc) {
                            if (!agc.hasOwnProperty(commandClass))
                                continue;
                            let anyCommandClass = agc[commandClass];
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
                                const commandMetadata = { name: commandName, existing: commandNeedsExistingAggregate };
                                command = domainHelper.defineCommand(commandMetadata, (data, aggregate) => new anyCommandClass(data).handle(new aggregateClass(aggregate), errors));
                                aggregate.addCommand(command);
                                commands[commandName] = anyCommandClass;
                            }
                            else if (isEvent) {
                                let e = new anyCommandClass();
                                let eventName = _.camelCase(commandClass);
                                anyCommandClass.prototype.eventName = eventName;
                                let eventDefinition = null;
                                eventDefinition = domainHelper.defineEvent({ name: eventName }, (data, agg) => new anyCommandClass(data).applyEvent(new aggregateClass(agg)));
                                aggregate.addEvent(eventDefinition);
                            }
                            else if (isViewBuilder && !viewBuilders[cf + commandClass]) {
                                let vb = new anyCommandClass();
                                const collectionName = space_config_1.config.get("tablePrefix") + vb.collection();
                                const viewBuilderMetadata = vb.viewBuilderMetadata();
                                const coll = _.find(denormalizer.tree.getCollections(), c => c.name == collectionName);
                                for (var key of Object.getOwnPropertyNames(anyCommandClass.prototype)) {
                                    let method = key;
                                    if (/when.+/.test(method) === false)
                                        continue;
                                    const reflect = Reflect;
                                    let metadata = reflect.getMetadata("design:paramtypes", vb, method);
                                    if (metadata) {
                                        const event = new metadata[0]();
                                        const eventName = _.camelCase(event.constructor.name);
                                        const finalMetadata = objectAssign({
                                            id: 'payload.id',
                                            payload: 'payload',
                                            name: eventName,
                                        }, viewBuilderMetadata);
                                        const newBuilder = denormalizerHelper.defineViewBuilder(finalMetadata, function (data, vm) {
                                            let partitionKey = exports.getPartitionKey();
                                            vm.set('PartitionKey', partitionKey);
                                            vm.set('RowKey', vm.id.toString());
                                            const viewModel = metadata[1];
                                            vb[method](data, new viewModel(vm));
                                        });
                                        viewBuilders[cf + commandClass] = newBuilder;
                                        coll.addViewBuilder(newBuilder);
                                    }
                                }
                            }
                        }
                    });
                    function handleEvent(evt) {
                        denormalizer.handle(evt, () => {
                            denormalizersActive--;
                            denormalizerStatus.emit('completedDenormalizing', evt);
                            console.log('event handled', evt.id);
                            console.log('denormalizersActive', denormalizersActive);
                        });
                    }
                    ;
                    function handleSequentially(evt) {
                        if (denormalizersActive > 1) {
                            console.log('waiting', evt.id);
                            denormalizerStatus.once('completedDenormalizing', () => handleSequentially(evt));
                        }
                        else {
                            handleEvent(evt);
                        }
                    }
                    cqrsDomain.onEvent(function (evt) {
                        denormalizersActive++;
                        denormalizerStatus.emit('startedDenormalizing', evt);
                        console.log('onEvent', evt.id);
                        console.log('denormalizersActive', denormalizersActive);
                        handleSequentially(evt);
                    });
                });
                if (cb) {
                    cb();
                }
            });
        });
    },
    handle: function (cmd, req, observeEvents) {
        return new Promise((resolve, reject) => {
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
            denormalizerStatus.on('completedDenormalizing', (evt) => {
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
                }
                else {
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
//# sourceMappingURL=domain.js.map