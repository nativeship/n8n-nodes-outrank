"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutrankApi = void 0;
class OutrankApi {
    constructor() {
        this.name = "outrankApi";
        this.displayName = "Outrank API";
        this.documentationUrl = "https://nativeship.io/nodes/@nativeship/n8n-nodes-outrank";
        this.icon = {
            light: "file:../nodes/Outrank/outrank.svg",
            dark: "file:../nodes/Outrank/outrank.dark.svg"
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
exports.OutrankApi = OutrankApi;
//# sourceMappingURL=OutrankApi.credentials.js.map