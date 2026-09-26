import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry, resolveServerBaseUrl } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Outrank implements INodeType {
  description: INodeTypeDescription = {
        displayName: "Outrank",
        name: "outrank",
        icon: {
            light: "file:outrank.svg",
            dark: "file:outrank.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{$parameter[\"operation\"] + \": \" + $parameter[\"resource\"]}}",
        description: "Automate SEO content creation, keyword research, article generation, and Search Console monitoring with Outrank",
        hints: [
            {
                message: "Operation \"listArticles\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"listKeywords\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"listProducts\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "Outrank"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "outrankApi",
                required: true
            }
        ],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "articles",
                options: [
                    {
                        name: "Article",
                        value: "articles"
                    },
                    {
                        name: "Billing & Usage",
                        value: "billingUsage"
                    },
                    {
                        name: "Keyword",
                        value: "keywords"
                    },
                    {
                        name: "Product",
                        value: "products"
                    },
                    {
                        name: "Search Console",
                        value: "searchConsole"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ]
                    }
                },
                default: "bulkReplaceArticles",
                options: [
                    {
                        name: "Bulk Replace",
                        value: "bulkReplaceArticles",
                        action: "Bulk replace articles",
                        description: "Replaces content across multiple articles in a batch operation"
                    },
                    {
                        name: "Generate",
                        value: "generateArticle",
                        action: "Generate article",
                        description: "Generates a full seo-optimized article based on a target keyword ID"
                    },
                    {
                        name: "Get",
                        value: "getArticle",
                        action: "Get article",
                        description: "Retrieves metadata, seo metrics, and publication status for a specific article"
                    },
                    {
                        name: "Get Article Content",
                        value: "getArticleContent",
                        action: "Get article content",
                        description: "Retrieves the rendered body text and content of an article in the requested format"
                    },
                    {
                        name: "Get Many",
                        value: "listArticles",
                        action: "Get many articles",
                        description: "Retrieves a paginated list of generated articles filtered by product, status, or keyword"
                    },
                    {
                        name: "Precreate",
                        value: "precreateArticle",
                        action: "Precreate article",
                        description: "Creates an article outline or draft container for a keyword before generation"
                    },
                    {
                        name: "Replace",
                        value: "replaceArticle",
                        action: "Replace article",
                        description: "Overwrites or regenerates the content of an existing article"
                    },
                    {
                        name: "Retry Publish",
                        value: "retryArticlePublish",
                        action: "Retry publish article",
                        description: "Retries publishing an article to connected cms integrations after an earlier failure"
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "bulkReplaceArticles"
                        ]
                    }
                }
            },
            {
                displayName: "Keyword ID",
                name: "keyword_id",
                type: "string",
                default: "",
                required: true,
                description: "Identifier of the keyword for which to create the article",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "generateArticle"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "getArticle"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "getArticleContent"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "getArticleContent"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Format",
                        name: "format",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "listArticles"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Content",
                        name: "content",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created From",
                        name: "created_from",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created To",
                        name: "created_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Keyword",
                        name: "keyword",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Product ID",
                        name: "product_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Scheduled From",
                        name: "scheduled_from",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Scheduled To",
                        name: "scheduled_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Slug",
                        name: "slug",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sort By",
                        name: "sort_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sort Order",
                        name: "sort_order",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Keyword ID",
                name: "keyword_id",
                type: "string",
                default: "",
                required: true,
                description: "Identifier of the keyword for which to create the article",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "precreateArticle"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "replaceArticle"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "replaceArticle"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "articles"
                        ],
                        operation: [
                            "retryArticlePublish"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "billingUsage"
                        ]
                    }
                },
                default: "getBillingPortalUrl",
                options: [
                    {
                        name: "Get Billing Portal URL",
                        value: "getBillingPortalUrl",
                        action: "Get billing portal URL billing usage",
                        description: "Generates a secure session URL for managing subscriptions in customer billing. billing & usage."
                    },
                    {
                        name: "Get Subscription Status",
                        value: "getSubscriptionStatus",
                        action: "Get subscription status billing usage",
                        description: "Retrieves active plan details and subscription status for the organization. billing & usage."
                    },
                    {
                        name: "Get Usage Stats",
                        value: "getUsageStats",
                        action: "Get usage stats billing usage",
                        description: "Retrieves generation statistics, consumed credits, and feature usage totals. billing & usage."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ]
                    }
                },
                default: "bulkDeleteKeywords",
                options: [
                    {
                        name: "Bulk Delete",
                        value: "bulkDeleteKeywords",
                        action: "Bulk delete keywords",
                        description: "Deletes multiple target keywords from a product in a single request"
                    },
                    {
                        name: "Bulk Process",
                        value: "bulkProcessKeywords",
                        action: "Bulk process keywords",
                        description: "Processes or queues multiple keywords for generation and scheduling simultaneously"
                    },
                    {
                        name: "Bulk Reschedule",
                        value: "bulkRescheduleKeywords",
                        action: "Bulk reschedule keywords",
                        description: "Updates publishing and generation schedule times for multiple keywords in batch"
                    },
                    {
                        name: "Export",
                        value: "exportKeywords",
                        action: "Export keywords",
                        description: "Exports keyword metrics and scheduling datasets for a specific product"
                    },
                    {
                        name: "Generate",
                        value: "generateKeywords",
                        action: "Generate keywords",
                        description: "Generates new ai seo keyword clusters and ideas for a product"
                    },
                    {
                        name: "Get Many",
                        value: "listKeywords",
                        action: "Get many keywords",
                        description: "Retrieves keywords filtered by product ID, search volume, difficulty, and scheduling windows"
                    },
                    {
                        name: "Suggest",
                        value: "suggestKeywords",
                        action: "Suggest keywords",
                        description: "Suggests related topic keywords and expansion opportunities for a product"
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "bulkDeleteKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "bulkProcessKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "bulkRescheduleKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Product ID",
                name: "product_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "exportKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "generateKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Product ID",
                name: "product_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "listKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "listKeywords"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Article Subtype",
                        name: "article_subtype",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Article Type",
                        name: "article_type",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Difficulty Max",
                        name: "difficulty_max",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0,
                            maxValue: 100
                        }
                    },
                    {
                        displayName: "Difficulty Min",
                        name: "difficulty_min",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0,
                            maxValue: 100
                        }
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Q",
                        name: "q",
                        type: "string",
                        default: "",
                        description: "Search query"
                    },
                    {
                        displayName: "Scheduled From",
                        name: "scheduled_from",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Scheduled To",
                        name: "scheduled_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Scope",
                        name: "scope",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Search Volume Max",
                        name: "search_volume_max",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Search Volume Min",
                        name: "search_volume_min",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "keywords"
                        ],
                        operation: [
                            "suggestKeywords"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ]
                    }
                },
                default: "createProduct",
                options: [
                    {
                        name: "Create",
                        value: "createProduct",
                        action: "Create product",
                        description: "Creates and configures a new product or website tracking record"
                    },
                    {
                        name: "Get",
                        value: "getProduct",
                        action: "Get product",
                        description: "Retrieves configuration, settings, and metadata for a specific product by ID"
                    },
                    {
                        name: "Get Many",
                        value: "listProducts",
                        action: "Get many products",
                        description: "Retrieves a paginated list of websites or products configured under the organization"
                    },
                    {
                        name: "Pause",
                        value: "pauseProduct",
                        action: "Pause product",
                        description: "Pauses automatic keyword tracking and article scheduling for a product"
                    },
                    {
                        name: "Resume A",
                        value: "resumeProduct",
                        action: "Resume product",
                        description: "Resumes automatic keyword scheduling and article publishing for a paused product"
                    },
                    {
                        name: "Update",
                        value: "updateProduct",
                        action: "Update product",
                        description: "Updates the settings, tracking details, or configuration of an existing product"
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "createProduct"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "getProduct"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "listProducts"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cursor",
                        name: "cursor",
                        type: "string",
                        default: "",
                        description: "Opaque pagination cursor"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "pauseProduct"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "resumeProduct"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "updateProduct"
                        ]
                    }
                }
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {},
                required: true,
                description: "Open object schema used where the published API reference omits request fields",
                displayOptions: {
                    show: {
                        resource: [
                            "products"
                        ],
                        operation: [
                            "updateProduct"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ]
                    }
                },
                default: "connectSearchConsole",
                options: [
                    {
                        name: "Connect",
                        value: "connectSearchConsole",
                        action: "Connect search console",
                        description: "Initiates or updates the google search console integration for a product"
                    },
                    {
                        name: "Get Keyword Cannibalization",
                        value: "getSearchConsoleCannibalization",
                        action: "Get keyword cannibalization search console",
                        description: "Identifies competing pages ranking for identical search terms via search console"
                    },
                    {
                        name: "Get Search Console Connection",
                        value: "getSearchConsoleConnection",
                        action: "Get search console connection",
                        description: "Retrieves connection details and status for google search console on a product"
                    },
                    {
                        name: "Get Search Console Performance",
                        value: "getSearchConsolePerformance",
                        action: "Get search console performance",
                        description: "Retrieves organic search impressions, clicks, ctr, and keyword rankings over a period. search console."
                    },
                    {
                        name: "Inspect Search Console URL",
                        value: "inspectSearchConsoleUrl",
                        action: "Inspect search console URL",
                        description: "Inspects google indexation and crawl status for a specific URL on the product. search console."
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "connectSearchConsole"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "getSearchConsoleCannibalization"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "getSearchConsoleConnection"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "getSearchConsolePerformance"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "getSearchConsolePerformance"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Months",
                        name: "months",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 1,
                            maxValue: 16
                        }
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                description: "Product or article identifier",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "inspectSearchConsoleUrl"
                        ]
                    }
                }
            },
            {
                displayName: "Inspection URL",
                name: "inspection_url",
                type: "string",
                default: "",
                required: true,
                description: "URL to inspect",
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "inspectSearchConsoleUrl"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "searchConsole"
                        ],
                        operation: [
                            "inspectSearchConsoleUrl"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Language Code",
                        name: "language_code",
                        type: "string",
                        default: "",
                        description: "Optional language code"
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "bulkReplaceArticles": {
        
        
        const path = "/articles/bulk-replace";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "generateArticle": {
        
        
        const path = "/articles/generate";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"keyword_id","displayName":"Keyword id","type":"string","required":true,"description":"Identifier of the keyword for which to create the article."}, this.getNodeParameter("keyword_id", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getArticle": {
        
        
        let path = "/articles/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getArticleContent": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/articles/{id}/content";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["format"] !== undefined) qs["format"] = additionalFields["format"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "listArticles": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/articles";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["product_id"] !== undefined) qs["product_id"] = additionalFields["product_id"];
    if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["title"] !== undefined) qs["title"] = additionalFields["title"];
    if (additionalFields["keyword"] !== undefined) qs["keyword"] = additionalFields["keyword"];
    if (additionalFields["content"] !== undefined) qs["content"] = additionalFields["content"];
    if (additionalFields["slug"] !== undefined) qs["slug"] = additionalFields["slug"];
    if (additionalFields["created_from"] !== undefined) qs["created_from"] = additionalFields["created_from"];
    if (additionalFields["created_to"] !== undefined) qs["created_to"] = additionalFields["created_to"];
    if (additionalFields["scheduled_from"] !== undefined) qs["scheduled_from"] = additionalFields["scheduled_from"];
    if (additionalFields["scheduled_to"] !== undefined) qs["scheduled_to"] = additionalFields["scheduled_to"];
    if (additionalFields["sort_by"] !== undefined) qs["sort_by"] = additionalFields["sort_by"];
    if (additionalFields["sort_order"] !== undefined) qs["sort_order"] = additionalFields["sort_order"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "precreateArticle": {
        
        
        const path = "/articles/precreate";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"keyword_id","displayName":"Keyword id","type":"string","required":true,"description":"Identifier of the keyword for which to create the article."}, this.getNodeParameter("keyword_id", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "replaceArticle": {
        
        
        let path = "/articles/{id}/replace";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "retryArticlePublish": {
        
        
        let path = "/articles/{id}/retry-publish";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getCurrentIdentity": {
        
        
        const path = "/auth/whoami";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getBillingPortalUrl": {
        
        
        const path = "/billing/portal-url";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getSubscriptionStatus": {
        
        
        const path = "/subscription/status";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getUsageStats": {
        
        
        const path = "/usage/stats";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "purchaseProducts": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/billing/purchase-products";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["Idempotency-Key"] !== undefined) headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
        setBodyField(body as IDataObject, {"name":"additional_products","displayName":"Additional products","type":"integer","required":true,"minValue":1,"maxValue":30,"description":"Integer range accepted by the official CLI; the public reference does not define its semantics."}, this.getNodeParameter("additional_products", itemIndex), this, itemIndex);
    if (additionalFields["confirm_charge_cents"] !== undefined) setBodyField(body as IDataObject, {"name":"confirm_charge_cents","displayName":"Confirm charge cents","type":"integer","minValue":0,"description":"Confirmed charge amount in cents for the purchase flow."}, additionalFields["confirm_charge_cents"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"409":{"title":"The official CLI handles this response as a quote result; quote details are returned in the error object."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "bulkDeleteKeywords": {
        
        
        const path = "/keywords/bulk-delete";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "bulkProcessKeywords": {
        
        
        const path = "/keywords/bulk-process";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "bulkRescheduleKeywords": {
        
        
        const path = "/keywords/bulk-reschedule";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "exportKeywords": {
        
        
        const path = "/keywords/export";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        qs["product_id"] = this.getNodeParameter("product_id", itemIndex);
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "generateKeywords": {
        
        
        const path = "/keywords/generate";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "listKeywords": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/keywords";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        qs["product_id"] = this.getNodeParameter("product_id", itemIndex);
    if (additionalFields["scope"] !== undefined) qs["scope"] = additionalFields["scope"];
    if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["q"] !== undefined) qs["q"] = additionalFields["q"];
    if (additionalFields["article_type"] !== undefined) qs["article_type"] = additionalFields["article_type"];
    if (additionalFields["article_subtype"] !== undefined) qs["article_subtype"] = additionalFields["article_subtype"];
    if (additionalFields["scheduled_from"] !== undefined) qs["scheduled_from"] = additionalFields["scheduled_from"];
    if (additionalFields["scheduled_to"] !== undefined) qs["scheduled_to"] = additionalFields["scheduled_to"];
    if (additionalFields["search_volume_min"] !== undefined) qs["search_volume_min"] = additionalFields["search_volume_min"];
    if (additionalFields["search_volume_max"] !== undefined) qs["search_volume_max"] = additionalFields["search_volume_max"];
    if (additionalFields["difficulty_min"] !== undefined) qs["difficulty_min"] = additionalFields["difficulty_min"];
    if (additionalFields["difficulty_max"] !== undefined) qs["difficulty_max"] = additionalFields["difficulty_max"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "suggestKeywords": {
        
        
        const path = "/keywords/suggest";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "createProduct": {
        
        
        const path = "/products";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getProduct": {
        
        
        let path = "/products/{id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "listProducts": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/products";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["cursor"] !== undefined) qs["cursor"] = additionalFields["cursor"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "pauseProduct": {
        
        
        let path = "/products/{id}/pause";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "resumeProduct": {
        
        
        let path = "/products/{id}/resume";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "updateProduct": {
        
        
        let path = "/products/{id}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Open object schema used where the published API reference omits request fields.","additionalValue":{"name":"value","displayName":"Value","type":"any"},"representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "connectSearchConsole": {
        
        
        let path = "/products/{id}/gsc/connect";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getSearchConsoleCannibalization": {
        
        
        let path = "/products/{id}/gsc/cannibalization";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getSearchConsoleConnection": {
        
        
        let path = "/products/{id}/gsc";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "getSearchConsolePerformance": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/products/{id}/gsc/performance";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["months"] !== undefined) qs["months"] = additionalFields["months"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
    case "inspectSearchConsoleUrl": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/products/{id}/gsc/url-inspection";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        setBodyField(body as IDataObject, {"name":"inspection_url","displayName":"Inspection url","type":"string","required":true,"description":"URL to inspect."}, this.getNodeParameter("inspection_url", itemIndex), this, itemIndex);
    if (additionalFields["language_code"] !== undefined) setBodyField(body as IDataObject, {"name":"language_code","displayName":"Language code","type":"string","description":"Optional language code."}, additionalFields["language_code"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1HttpsWwwOutrankSoApiAgentV1","url":"https://www.outrank.so/api/agent/v1","kind":"selectable","variables":[]}], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"outrankApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Invalid request body or query parameters."},"401":{"title":"Missing, malformed, expired, or revoked API key."},"403":{"title":"The organization's plan does not support the operation or access to the resource is unavailable."},"404":{"title":"The resource does not exist or belongs to another organization."},"429":{"title":"Rate limit exceeded. Honor Retry-After before retrying."},"5XX":{"title":"Transient server error. Retry idempotent calls with backoff."}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
