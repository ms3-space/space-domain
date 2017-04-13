"use strict";
const space_config_1 = require("@ms3/space-config");
const domain_1 = require("./domain");
const domain = require("cqrs-domain");
const denormalizer = require("cqrs-eventdenormalizer");
const objectAssign = require("object-assign");
exports.define = {
    defineAggregate: function (name) {
        return domain.defineAggregate({
            name,
            defaultCommandPayload: 'payload',
            defaultEventPayload: 'payload',
        });
    },
    defineCommand: function (handler) {
        return domain.defineCommand({}, handler);
    },
    defineEvent: function (handler) {
        var handler = handler || function () { };
        return domain.defineEvent({}, handler);
    },
    defineViewBuilder: function (handler, metadata) {
        let meta = objectAssign({}, {
            id: 'payload.id',
            payload: 'payload',
        }, metadata);
        return denormalizer.defineViewBuilder(meta, function (data, vm) {
            let partitionKey = domain_1.getPartitionKey();
            vm.set('PartitionKey', partitionKey);
            handler(data, vm);
        });
    },
    defineCollection: function (name) {
        return denormalizer.defineCollection({
            name: space_config_1.config.get("tablePrefix") + name
        });
    }
};
//# sourceMappingURL=define.js.map