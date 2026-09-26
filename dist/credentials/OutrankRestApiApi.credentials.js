"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutrankRestApiApi = void 0;
class OutrankRestApiApi {
    constructor() {
        this.name = "outrankRestApiApi";
        this.displayName = "Outrank REST API";
        this.documentationUrl = "https://nativeship.io/nodes/@nativeship/n8n-nodes-outrank";
        this.icon = {
            light: "file:../nodes/OutrankRestApi/outrankRestApi.svg",
            dark: "file:../nodes/OutrankRestApi/outrankRestApi.dark.svg"
        };
        this.properties = [
            {
                displayName: "Access Token",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://www.outrank.so/api/agent/v1",
                url: "/articles"
            }
        };
    }
}
exports.OutrankRestApiApi = OutrankRestApiApi;
//# sourceMappingURL=OutrankRestApiApi.credentials.js.map