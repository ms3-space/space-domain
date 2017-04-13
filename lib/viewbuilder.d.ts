export declare class ViewBuilder {
}
export declare class ViewModel {
    vm: any;
    fields: any;
    constructor(vm?: any);
    getData(): any;
    destroy(): void;
}
export declare function create(target: any, key: string, value: any): void;
export declare function update(target: any, key: string, value: any): void;
export declare function collection(name: string, viewBuilderMetadata?: any): (target: any) => void;
