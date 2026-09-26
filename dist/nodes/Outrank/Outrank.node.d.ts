import { type IExecuteFunctions, type INodeExecutionData, type INodeType, type INodeTypeDescription } from "n8n-workflow";
export declare class Outrank implements INodeType {
    description: INodeTypeDescription;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
