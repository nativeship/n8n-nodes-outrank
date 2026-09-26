import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class OutrankRestApiApi implements ICredentialType {
  name = "outrankRestApiApi";
  displayName = "Outrank REST API";
  documentationUrl = "https://nativeship.io/nodes/@nativeship/n8n-nodes-outrank";
  icon: Icon = {
        light: "file:../nodes/OutrankRestApi/outrankRestApi.svg",
        dark: "file:../nodes/OutrankRestApi/outrankRestApi.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                Authorization: "=Bearer {{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://www.outrank.so/api/agent/v1",
            url: "/articles"
        }
    };
}
