"use strict";
class Event {
    constructor(payload) {
        if (payload) {
            for (var i in payload) {
                if (payload.hasOwnProperty(i)) {
                    this[i] = payload[i];
                }
            }
        }
    }
    apply(aggregate) { }
    applyEvent(aggregate) {
        this.apply(aggregate);
    }
}
exports.Event = Event;
class AggregateCreatedEvent extends Event {
}
exports.AggregateCreatedEvent = AggregateCreatedEvent;
function evt(name) {
    return (target) => {
        target.prototype.evt = () => name;
    };
}
exports.evt = evt;
//# sourceMappingURL=events.js.map