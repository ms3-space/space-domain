export declare const define: {
    defineAggregate: (name: any) => any;
    defineCommand: (handler: (data: any, aggregate: any) => any) => any;
    defineEvent: (handler?: any) => any;
    defineViewBuilder: (handler: any, metadata?: any) => any;
    defineCollection: (name: any) => any;
};
