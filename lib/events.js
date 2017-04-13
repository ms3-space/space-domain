"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Event {
    apply(aggregate) { }
    applyEvent(aggregate) {
        this.apply(aggregate);
    }
    constructor(payload) {
        if (payload) {
            for (var i in payload) {
                if (payload.hasOwnProperty(i)) {
                    this[i] = payload[i];
                }
            }
        }
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