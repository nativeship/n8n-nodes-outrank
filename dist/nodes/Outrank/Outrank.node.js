"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Outrank = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Outrank {
    constructor() {
        this.description = {
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
            subtitle: "={{((JSON.parse(\"\\u007b\\\"articles\\\":\\u007b\\\"bulkReplaceArticles\\\":\\\"bulkReplaceArticles: article\\\",\\\"generateArticle\\\":\\\"generateArticle: article\\\",\\\"getArticle\\\":\\\"getArticle: article\\\",\\\"getArticleContent\\\":\\\"getArticleContent: article\\\",\\\"listArticles\\\":\\\"getManyArticles: article\\\",\\\"precreateArticle\\\":\\\"precreateArticle: article\\\",\\\"replaceArticle\\\":\\\"replaceArticle: article\\\",\\\"retryArticlePublish\\\":\\\"retryPublishArticle: article\\\"\\u007d,\\\"billingUsage\\\":\\u007b\\\"getBillingPortalUrl\\\":\\\"getBillingPortalUrl: billingUsage\\\",\\\"getSubscriptionStatus\\\":\\\"getSubscriptionStatus: billingUsage\\\",\\\"getUsageStats\\\":\\\"getUsageStats: billingUsage\\\"\\u007d,\\\"keywords\\\":\\u007b\\\"bulkDeleteKeywords\\\":\\\"bulkDeleteKeywords: keyword\\\",\\\"bulkProcessKeywords\\\":\\\"bulkProcessKeywords: keyword\\\",\\\"bulkRescheduleKeywords\\\":\\\"bulkRescheduleKeywords: keyword\\\",\\\"exportKeywords\\\":\\\"exportKeywords: keyword\\\",\\\"generateKeywords\\\":\\\"generateKeywords: keyword\\\",\\\"listKeywords\\\":\\\"getManyKeywords: keyword\\\",\\\"suggestKeywords\\\":\\\"suggestKeywords: keyword\\\"\\u007d,\\\"products\\\":\\u007b\\\"createProduct\\\":\\\"createProduct: product\\\",\\\"getProduct\\\":\\\"getProduct: product\\\",\\\"listProducts\\\":\\\"getManyProducts: product\\\",\\\"pauseProduct\\\":\\\"pauseProduct: product\\\",\\\"resumeProduct\\\":\\\"resumeAProduct: product\\\",\\\"updateProduct\\\":\\\"updateProduct: product\\\"\\u007d,\\\"searchConsole\\\":\\u007b\\\"connectSearchConsole\\\":\\\"connectSearchConsole: searchConsole\\\",\\\"getSearchConsoleCannibalization\\\":\\\"getKeywordCannibalization: searchConsole\\\",\\\"getSearchConsoleConnection\\\":\\\"getSearchConsoleConnection: searchConsole\\\",\\\"getSearchConsolePerformance\\\":\\\"getSearchConsolePerformance: searchConsole\\\",\\\"inspectSearchConsoleUrl\\\":\\\"inspectSearchConsoleUrl: searchConsole\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "Automate SEO content creation, keyword research, article generation, and Search Console monitoring with Outrank",
            documentationUrl: "https://nativeship.io/nodes/@nativeship/n8n-nodes-outrank",
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
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
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
                            default: "",
                            description: "Format to use for the article content response"
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
                            default: "",
                            description: "Filter articles by content text"
                        },
                        {
                            displayName: "Created From",
                            name: "created_from",
                            type: "string",
                            default: "",
                            description: "Include articles created on or after this date"
                        },
                        {
                            displayName: "Created To",
                            name: "created_to",
                            type: "string",
                            default: "",
                            description: "Include articles created on or before this date"
                        },
                        {
                            displayName: "Keyword",
                            name: "keyword",
                            type: "string",
                            default: "",
                            description: "Filter articles by keyword"
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
                            default: "",
                            description: "Filter articles by product ID"
                        },
                        {
                            displayName: "Scheduled From",
                            name: "scheduled_from",
                            type: "string",
                            default: "",
                            description: "Include articles scheduled on or after this date"
                        },
                        {
                            displayName: "Scheduled To",
                            name: "scheduled_to",
                            type: "string",
                            default: "",
                            description: "Include articles scheduled on or before this date"
                        },
                        {
                            displayName: "Slug",
                            name: "slug",
                            type: "string",
                            default: "",
                            description: "Filter articles by URL slug"
                        },
                        {
                            displayName: "Sort By",
                            name: "sort_by",
                            type: "string",
                            default: "",
                            description: "Article field used to sort the results"
                        },
                        {
                            displayName: "Sort Order",
                            name: "sort_order",
                            type: "string",
                            default: "",
                            description: "Order in which to sort the results"
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "string",
                            default: "",
                            description: "Filter articles by status"
                        },
                        {
                            displayName: "Title",
                            name: "title",
                            type: "string",
                            default: "",
                            description: "Filter articles by title text"
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
                    description: "ID of the product whose keywords to export",
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
                    description: "ID of the product whose keywords to list",
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
                            default: "",
                            description: "Filter keywords by article subtype"
                        },
                        {
                            displayName: "Article Type",
                            name: "article_type",
                            type: "string",
                            default: "",
                            description: "Filter keywords by article type"
                        },
                        {
                            displayName: "Difficulty Max",
                            name: "difficulty_max",
                            type: "number",
                            default: 0,
                            description: "Maximum difficulty score for returned keywords",
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
                            description: "Minimum difficulty score for returned keywords",
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
                            default: "",
                            description: "Include keywords scheduled on or after this date"
                        },
                        {
                            displayName: "Scheduled To",
                            name: "scheduled_to",
                            type: "string",
                            default: "",
                            description: "Include keywords scheduled on or before this date"
                        },
                        {
                            displayName: "Scope",
                            name: "scope",
                            type: "string",
                            default: "",
                            description: "Filter keywords by scope"
                        },
                        {
                            displayName: "Search Volume Max",
                            name: "search_volume_max",
                            type: "number",
                            default: 0,
                            description: "Maximum search volume for returned keywords",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Search Volume Min",
                            name: "search_volume_min",
                            type: "number",
                            default: 0,
                            description: "Minimum search volume for returned keywords",
                            typeOptions: {
                                minValue: 0
                            }
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "string",
                            default: "",
                            description: "Filter keywords by status"
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
                            default: "",
                            description: "Filter products by status"
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
                            description: "Number of recent months of performance data to include (1\u201316)",
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
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "bulkReplaceArticles": {
                        const path = "/articles/bulk-replace";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "generateArticle": {
                        const path = "/articles/generate";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "keyword_id", "displayName": "Keyword id", "description": "Identifier of the keyword for which to create the article.", "type": "string", "required": true }, this.getNodeParameter("keyword_id", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getArticle": {
                        let path = "/articles/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getArticleContent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/articles/{id}/content";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["format"] !== undefined)
                            qs["format"] = additionalFields["format"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "listArticles": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/articles";
                        const qs = {};
                        const body = {};
                        if (additionalFields["product_id"] !== undefined)
                            qs["product_id"] = additionalFields["product_id"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["title"] !== undefined)
                            qs["title"] = additionalFields["title"];
                        if (additionalFields["keyword"] !== undefined)
                            qs["keyword"] = additionalFields["keyword"];
                        if (additionalFields["content"] !== undefined)
                            qs["content"] = additionalFields["content"];
                        if (additionalFields["slug"] !== undefined)
                            qs["slug"] = additionalFields["slug"];
                        if (additionalFields["created_from"] !== undefined)
                            qs["created_from"] = additionalFields["created_from"];
                        if (additionalFields["created_to"] !== undefined)
                            qs["created_to"] = additionalFields["created_to"];
                        if (additionalFields["scheduled_from"] !== undefined)
                            qs["scheduled_from"] = additionalFields["scheduled_from"];
                        if (additionalFields["scheduled_to"] !== undefined)
                            qs["scheduled_to"] = additionalFields["scheduled_to"];
                        if (additionalFields["sort_by"] !== undefined)
                            qs["sort_by"] = additionalFields["sort_by"];
                        if (additionalFields["sort_order"] !== undefined)
                            qs["sort_order"] = additionalFields["sort_order"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "precreateArticle": {
                        const path = "/articles/precreate";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        setBodyField(body, { "name": "keyword_id", "displayName": "Keyword id", "description": "Identifier of the keyword for which to create the article.", "type": "string", "required": true }, this.getNodeParameter("keyword_id", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "replaceArticle": {
                        let path = "/articles/{id}/replace";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "retryArticlePublish": {
                        let path = "/articles/{id}/retry-publish";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getCurrentIdentity": {
                        const path = "/auth/whoami";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getBillingPortalUrl": {
                        const path = "/billing/portal-url";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getSubscriptionStatus": {
                        const path = "/subscription/status";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getUsageStats": {
                        const path = "/usage/stats";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "purchaseProducts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/billing/purchase-products";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["Idempotency-Key"] !== undefined)
                            headers["Idempotency-Key"] = additionalFields["Idempotency-Key"];
                        setBodyField(body, { "name": "additional_products", "displayName": "Additional products", "description": "Integer range accepted by the official CLI; the public reference does not define its semantics.", "type": "integer", "required": true, "minValue": 1, "maxValue": 30 }, this.getNodeParameter("additional_products", itemIndex), this, itemIndex);
                        if (additionalFields["confirm_charge_cents"] !== undefined)
                            setBodyField(body, { "name": "confirm_charge_cents", "displayName": "Confirm charge cents", "description": "Confirmed charge amount in cents for the purchase flow.", "type": "integer", "minValue": 0 }, additionalFields["confirm_charge_cents"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "409": { "title": "The official CLI handles this response as a quote result; quote details are returned in the error object." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "bulkDeleteKeywords": {
                        const path = "/keywords/bulk-delete";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "bulkProcessKeywords": {
                        const path = "/keywords/bulk-process";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "bulkRescheduleKeywords": {
                        const path = "/keywords/bulk-reschedule";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "exportKeywords": {
                        const path = "/keywords/export";
                        const qs = {};
                        const body = {};
                        qs["product_id"] = this.getNodeParameter("product_id", itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "generateKeywords": {
                        const path = "/keywords/generate";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "listKeywords": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/keywords";
                        const qs = {};
                        const body = {};
                        qs["product_id"] = this.getNodeParameter("product_id", itemIndex);
                        if (additionalFields["scope"] !== undefined)
                            qs["scope"] = additionalFields["scope"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["q"] !== undefined)
                            qs["q"] = additionalFields["q"];
                        if (additionalFields["article_type"] !== undefined)
                            qs["article_type"] = additionalFields["article_type"];
                        if (additionalFields["article_subtype"] !== undefined)
                            qs["article_subtype"] = additionalFields["article_subtype"];
                        if (additionalFields["scheduled_from"] !== undefined)
                            qs["scheduled_from"] = additionalFields["scheduled_from"];
                        if (additionalFields["scheduled_to"] !== undefined)
                            qs["scheduled_to"] = additionalFields["scheduled_to"];
                        if (additionalFields["search_volume_min"] !== undefined)
                            qs["search_volume_min"] = additionalFields["search_volume_min"];
                        if (additionalFields["search_volume_max"] !== undefined)
                            qs["search_volume_max"] = additionalFields["search_volume_max"];
                        if (additionalFields["difficulty_min"] !== undefined)
                            qs["difficulty_min"] = additionalFields["difficulty_min"];
                        if (additionalFields["difficulty_max"] !== undefined)
                            qs["difficulty_max"] = additionalFields["difficulty_max"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["offset"] !== undefined)
                            qs["offset"] = additionalFields["offset"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "suggestKeywords": {
                        const path = "/keywords/suggest";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "createProduct": {
                        const path = "/products";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getProduct": {
                        let path = "/products/{id}";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "listProducts": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/products";
                        const qs = {};
                        const body = {};
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "pauseProduct": {
                        let path = "/products/{id}/pause";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "resumeProduct": {
                        let path = "/products/{id}/resume";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "updateProduct": {
                        let path = "/products/{id}";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex);
                        validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "required": true, "description": "Open object schema used where the published API reference omits request fields.", "additionalValue": { "name": "value", "displayName": "Value", "type": "any" }, "representation": "raw" }, "Body JSON", this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "connectSearchConsole": {
                        let path = "/products/{id}/gsc/connect";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getSearchConsoleCannibalization": {
                        let path = "/products/{id}/gsc/cannibalization";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getSearchConsoleConnection": {
                        let path = "/products/{id}/gsc";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "getSearchConsolePerformance": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/products/{id}/gsc/performance";
                        const qs = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        if (additionalFields["months"] !== undefined)
                            qs["months"] = additionalFields["months"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    case "inspectSearchConsoleUrl": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/products/{id}/gsc/url-inspection";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
                        setBodyField(body, { "name": "inspection_url", "displayName": "Inspection url", "description": "URL to inspect.", "type": "string", "required": true }, this.getNodeParameter("inspection_url", itemIndex), this, itemIndex);
                        if (additionalFields["language_code"] !== undefined)
                            setBodyField(body, { "name": "language_code", "displayName": "Language code", "description": "Optional language code.", "type": "string" }, additionalFields["language_code"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwOutrankSoApiAgentV1", "url": "https://www.outrank.so/api/agent/v1", "kind": "selectable", "variables": [] }], "documentServer1HttpsWwwOutrankSoApiAgentV1", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "outrankApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "400": { "title": "Invalid request body or query parameters." }, "401": { "title": "Missing, malformed, expired, or revoked API key." }, "403": { "title": "The organization's plan does not support the operation or access to the resource is unavailable." }, "404": { "title": "The resource does not exist or belongs to another organization." }, "429": { "title": "Rate limit exceeded. Honor Retry-After before retrying." }, "5XX": { "title": "Transient server error. Retry idempotent calls with backoff." } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Outrank = Outrank;
//# sourceMappingURL=Outrank.node.js.map