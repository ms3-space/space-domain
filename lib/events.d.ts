export declare abstract class Event {
    eventName: string;
    apply(aggregate: any): void;
    applyEvent(aggregate: any): void;
    constructor(payload?: any);
}
export declare class AggregateCreatedEvent extends Event {
}
export declare function evt(name: string): (target: any) => void;
