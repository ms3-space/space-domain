import { Event } from './events';
export interface ICommand {
    _cmdId: string;
    command(): string;
}
export interface IPayload {
    aggregateId?: string;
}
export declare abstract class BaseCommand implements ICommand {
    _cmdId: string;
    validations: any[];
    command(): string;
    getFields(): any;
    validate(): any[];
    abstract toJson(): any;
}
export declare class Aggregate {
    aggregate: any;
    id: string;
    fields: any;
    constructor(aggregate?: any);
    apply<TEvent extends Event>(event: TEvent): void;
    get(prop: string): any;
    set(prop: string, value: any): void;
}
export declare abstract class Command extends BaseCommand {
    aggregateId(): string;
    aggregateIdField: string;
    constructor(payload?: any, id?: string);
    getAggregateId(): any;
    getAllFieldNames(): string[];
    handleCommand(data: any, aggregate: any, errors?: any): void;
    abstract handle(data: any, aggregate: Aggregate, errors?: any): any;
    toJson(): any;
}
export declare function cmd(name: string): (target: any) => void;
export declare function aggregate(target: any): any;
export declare function required(target: any, key: string): void;
export declare function field(target: any, key: string): void;
export declare function aggregateId(target: any, key: string): void;
