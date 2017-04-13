import { BaseCommand } from "./baseCommands";
export declare let eventDenormalizer: any;
export declare let getPartitionKey: () => any;
export declare let getOptions: () => any;
export declare let domain: {
    getCommands: () => {};
    init: (options: any, cb: any) => void;
    handle: (cmd: BaseCommand, req: any, observeEvents?: any) => Promise<any>;
};
