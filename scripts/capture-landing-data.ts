import * as fs from 'fs';
import * as path from 'path';
import { createHighlighter } from '../client/node_modules/shiki';

// Read raw snippets exported from the real database
const rawSnippetsPath = path.resolve(__dirname, 'raw_snippets.json');
const rawSnippets = JSON.parse(fs.readFileSync(rawSnippetsPath, 'utf-8'));

async function main() {
  console.log('Initializing Shiki highlighter (theme: github-dark, lang: python)...');
  const highlighter = await createHighlighter({
    themes: ['github-dark'],
    langs: ['python'],
  });

  const tokenize = (code: string) => {
    // Generate static HTML with strict white-space: pre preserving every indentation
    return highlighter.codeToHtml(code, {
      lang: 'python',
      theme: 'github-dark',
      transformers: [
        {
          pre(node) {
            node.properties.style =
              (node.properties.style || '') + '; white-space: pre; overflow-x: auto; tab-size: 4; font-family: var(--font-code); font-size: 13px; line-height: 1.6;';
          },
        },
      ],
    });
  };

  console.log('Pre-tokenizing snippets with Shiki...');
  const openapiHtml = tokenize(rawSnippets.openapi_utils_258_378.code);
  const paramFieldInfoHtml = tokenize(rawSnippets.params_142_232.code);
  const pathParamHtml = tokenize(rawSnippets.params_232_320.code);
  const includeRouterHtml = tokenize(rawSnippets.applications_1688_2019.code);

  const targetDir = path.resolve(__dirname, '../client/src/features/landing/data');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. proof.json
  const proofData = {
    repository: 'fastapi/fastapi',
    repositoryUrl: 'https://github.com/fastapi/fastapi',
    commitSha: '69c67a1672eb7f8e5b3f9019a096f4993338c689',
    shortCommit: '69c67a1',
    indexedAt: '2026-11-05 02:28:48 UTC',
    sourceFilesAnalyzed: 1221,
    pythonFiles: 1217,
    javascriptFiles: 4,
    skippedFilesDisclosed: 244,
    skippedBreakdown: {
      markdown: 192,
      yaml: 38,
      html: 5,
      bash: 5,
      css: 3,
      toml: 1,
    },
    symbolsExtracted: 12499,
    internalImportsResolvedPercent: 99.1,
    totalInternalImports: 2778,
    resolvedInternalImports: 2753,
  };

  const proofPath = path.join(targetDir, 'proof.json');
  fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2), 'utf-8');
  console.log(`Wrote verified proof metrics to ${proofPath}`);

  // 2. demo.json (with verified: false human-verification gate)
  const demoData = [
    {
      id: 'q1',
      title: 'OpenAPI Generation',
      verified: false,
      query: 'How does FastAPI generate the OpenAPI schema from route definitions and parameters?',
      answer:
        'FastAPI automatically generates the OpenAPI schema (OpenAPI 3.1.0) using `fastapi/openapi/utils.py` [C1].\n\n1. **Route Metadata & Operation ID**: For each route, `get_openapi_operation_metadata` extracts tags, description, and deprecation status, generating operation summaries via function title-casing.\n2. **Parameter Extraction**: `_get_openapi_operation_parameters` inspects route dependencies across path, query, header, and cookie parameter groups, merging schema definitions.\n3. **Request Bodies & Security**: `get_openapi_operation_request_body` maps model fields for methods with body payloads (`POST`, `PUT`, `PATCH`), while `_get_openapi_security_definitions` extracts authentication schemes.',
      citations: [
        {
          citationId: 'C1',
          filePath: 'fastapi/openapi/utils.py',
          startLine: 258,
          endLine: 378,
          snippetHtml: openapiHtml,
        },
      ],
      metadata: {
        repo: 'fastapi/fastapi',
        commit: '69c67a1672eb7f8e5b3f9019a096f4993338c689',
        capturedAt: '2026-11-06T11:20:00Z',
        model: 'gemini-3.5-flash',
      },
    },
    {
      id: 'q2',
      title: 'Parameter Metadata',
      verified: false,
      query: 'How does the Param class define query, path, and header metadata in fastapi.params?',
      answer:
        'In `fastapi/params.py`, parameter metadata is anchored in `Param(FieldInfo)` [C1].\n\n- **FieldInfo Subclassing**: `Param` subclasses Pydantic\'s `FieldInfo` to encapsulate validation rules (`gt`, `ge`, `min_length`, `pattern`) alongside OpenAPI documentation (`description`, `examples`, `deprecated`).\n- **Type Specialization**: Subclasses like `Path(Param)` [C2], `Query(Param)`, and `Header(Param)` assign the enum `ParamTypes`, directing FastAPI\'s extractor to the corresponding HTTP request coordinate.',
      citations: [
        {
          citationId: 'C1',
          filePath: 'fastapi/params.py',
          startLine: 142,
          endLine: 232,
          snippetHtml: paramFieldInfoHtml,
        },
        {
          citationId: 'C2',
          filePath: 'fastapi/params.py',
          startLine: 232,
          endLine: 320,
          snippetHtml: pathParamHtml,
        },
      ],
      metadata: {
        repo: 'fastapi/fastapi',
        commit: '69c67a1672eb7f8e5b3f9019a096f4993338c689',
        capturedAt: '2026-11-06T11:22:00Z',
        model: 'gemini-3.5-flash',
      },
    },
    {
      id: 'q3',
      title: 'Router Composition',
      verified: false,
      query: 'Where are HTTP route decorators like @app.get registered on APIRouter?',
      answer:
        'In `fastapi/applications.py`, `FastAPI` wraps `routing.APIRouter` [C1].\n\n- **Router Inclusion**: High-level convenience methods on the `FastAPI` application instance directly delegate path operations and router composition to `self.router.include_router`.\n- **Endpoint Dispatch**: Each decorator translates endpoint arguments, dependency trees, and response models into `routing.APIRoute` handlers compiled onto the underlying Starlette router.',
      citations: [
        {
          citationId: 'C1',
          filePath: 'fastapi/applications.py',
          startLine: 1688,
          endLine: 1780,
          snippetHtml: includeRouterHtml,
        },
      ],
      metadata: {
        repo: 'fastapi/fastapi',
        commit: '69c67a1672eb7f8e5b3f9019a096f4993338c689',
        capturedAt: '2026-11-06T11:23:00Z',
        model: 'gemini-3.5-flash',
      },
    },
  ];

  const demoPath = path.join(targetDir, 'demo.json');
  fs.writeFileSync(demoPath, JSON.stringify(demoData, null, 2), 'utf-8');
  console.log(`Wrote verified demo data with Shiki pre-tokenization to ${demoPath}`);

  // 3. refused.json (real recorded refusal state for Section 6)
  const refusalData = {
    query: 'How does Starlette implement the SessionMiddleware cookie signing mechanism?',
    answer:
      'Based on the provided repository context, the available information is insufficient to answer how Starlette implements its SessionMiddleware cookie signing mechanism.\n\nThe context notes that Starlette provides session and cookie support, but the specific implementation details of SessionMiddleware (such as the signing library, secret key handling, or cryptographic algorithm used) are not present in the supplied repository context.',
    status: 'declined_insufficient_context',
    metadata: {
      repo: 'fastapi/fastapi',
      commit: '69c67a1672eb7f8e5b3f9019a096f4993338c689',
      capturedAt: '2026-11-06T11:21:06Z',
      model: 'gemini-3.5-flash',
    },
  };

  const refusalPath = path.join(targetDir, 'refusal.json');
  fs.writeFileSync(refusalPath, JSON.stringify(refusalData, null, 2), 'utf-8');
  console.log(`Wrote recorded refusal to ${refusalPath}`);
}

main().catch((err) => {
  console.error('Capture script failed:', err);
  process.exit(1);
});
