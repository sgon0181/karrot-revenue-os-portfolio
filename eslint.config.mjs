import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const moduleExtensions = "{js,jsx,mjs,cjs,ts,tsx,mts,cts}";
const featuresDirectory = new URL("./src/features/", import.meta.url);
const featureNames = readdirSync(featuresDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Exact post-W1 cross-feature surfaces, grouped by the consuming feature.
// Same-feature imports are internal and need no entry. A new cross-feature edge
// must publish an exact module specifier here; publishing a directory wildcard
// would let unrelated implementation files become dependencies by accident.
const crossFeatureImportAllowlist = {
  accounts: [
    "@/features/commercial/components/commercial-error-toast",
    "@/features/commercial/components/commercial-forms",
    "@/features/intelligence/components/account-intelligence",
    "@/features/intelligence/components/research-people",
    "@/features/intelligence/components/research-status-controls",
    "@/features/intelligence/lib/claims",
    "@/features/intelligence/lib/freshness",
    "@/features/intelligence/lib/types",
    "@/features/market/components/provider-workspace-view-recorder",
    "@/features/market/lib/maps",
  ],
  commercial: ["@/features/accounts/server/actions"],
  "data-health": ["@/features/intelligence/lib/freshness"],
  intelligence: [],
  landing: [],
  market: [],
  visits: [],
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const aliasDotSegmentRestriction = {
  regex: "^@/(?:features|app)(?:/[^/]+)*/\\.{1,2}(?:/|$)",
  message:
    "Alias imports cannot contain dot segments. Use the normalized @/features/... or @/app/... module specifier.",
};

const relativeDotSegmentRestriction = {
  regex:
    "^(?:(?:\\.\\.?/)+(?:[^/]+/)+\\.{1,2}(?:/|$)|\\./\\.{1,2}(?:/|$)|(?:\\.\\./)+\\.(?:/|$))",
  message:
    "Relative imports must keep all required parent traversal at the beginning and cannot contain redundant or post-segment dot paths.",
};

const repeatedSlashImportRestriction = {
  regex: "//",
  message:
    "Module specifiers cannot contain repeated path separators. Use the canonical normalized import path.",
};

const backslashImportRestriction = {
  regex: "\\\\",
  message:
    "Module specifiers cannot contain backslashes. Use canonical forward-slash import paths.",
};

const appImportRestriction = {
  regex: "^(?:@/app|(?:\\.\\./)+(?:src/)?app)(?:/|$)",
  message:
    "Feature modules cannot import route-layer modules from src/app. Move reusable behavior into its owning feature or shared layer.",
};

const serverComponentImportRestriction = {
  regex: "(?:^|/)components(?:/|$)",
  message:
    "Server modules and route actions cannot import component files. Move the shared contract or server behavior into lib/ or server/.",
};

function featureImportRestrictions(featureName) {
  const allowedFeatureTails = [
    `${escapeRegex(featureName)}(?:/|$)`,
    ...(crossFeatureImportAllowlist[featureName] ?? []).map(
      (source) => `${escapeRegex(source.replace("@/features/", ""))}$`,
    ),
  ];
  const otherFeatureNames = featureNames
    .filter((candidate) => candidate !== featureName)
    .map(escapeRegex)
    .join("|");

  const restrictions = [
    aliasDotSegmentRestriction,
    relativeDotSegmentRestriction,
    repeatedSlashImportRestriction,
    backslashImportRestriction,
    appImportRestriction,
    {
      regex: `^@/features/(?!(?:${allowedFeatureTails.join("|")})).+`,
      message: `Cross-feature imports from ${featureName} must use an exact published surface in crossFeatureImportAllowlist.`,
    },
  ];

  if (otherFeatureNames) {
    restrictions.push({
      regex: `^(?:\\.\\./)+(?:${otherFeatureNames})(?:/|$)|^(?:\\.\\./)+(?:src/)?features/(?:${otherFeatureNames})(?:/|$)`,
      message:
        "Relative cross-feature imports are not published surfaces. Use an explicitly allowlisted @/features/... module specifier.",
    });
  }

  return restrictions;
}

const literalModuleSourceSelectors = [
  { node: "ImportExpression", attribute: "source.value" },
  { node: "TSImportType", attribute: "source.value" },
  {
    node: 'CallExpression[callee.type="Identifier"][callee.name="require"]',
    attribute: "arguments.0.value",
  },
  {
    node: 'ImportExpression[source.type="TemplateLiteral"][source.expressions.length=0]',
    attribute: "source.quasis.0.value.cooked",
  },
  {
    node: 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.0.type="TemplateLiteral"][arguments.0.expressions.length=0]',
    attribute: "arguments.0.quasis.0.value.cooked",
  },
];

const computedModuleSourceRestrictions = [
  {
    selector:
      'ImportExpression:not([source.type="Literal"]):not([source.type="TemplateLiteral"])',
    message:
      "Computed dynamic imports cannot be boundary-checked. Use a literal module specifier.",
  },
  {
    selector:
      'ImportExpression[source.type="TemplateLiteral"]:not([source.expressions.length=0])',
    message:
      "Computed dynamic imports cannot be boundary-checked. Use a literal module specifier.",
  },
  {
    selector:
      'CallExpression[callee.type="Identifier"][callee.name="require"]:not([arguments.0.type="Literal"]):not([arguments.0.type="TemplateLiteral"])',
    message:
      "Computed require calls cannot be boundary-checked. Use a literal module specifier.",
  },
  {
    selector:
      'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.0.type="TemplateLiteral"]:not([arguments.0.expressions.length=0])',
    message:
      "Computed require calls cannot be boundary-checked. Use a literal module specifier.",
  },
];

function restrictedModuleSyntax(restrictions) {
  return [
    ...computedModuleSourceRestrictions,
    ...restrictions.flatMap(({ regex, message }) =>
      literalModuleSourceSelectors.map(({ node, attribute }) => ({
        selector: `${node}[${attribute}=/${regex.replaceAll("/", "\\/")}/]`,
        message,
      })),
    ),
  ];
}

const featureBoundaryConfigs = featureNames.map((featureName) => ({
  name: `karrot/feature-boundary/${featureName}`,
  files: [`src/features/${featureName}/**/*.${moduleExtensions}`],
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: featureImportRestrictions(featureName) },
    ],
    "no-restricted-syntax": [
      "error",
      ...restrictedModuleSyntax(featureImportRestrictions(featureName)),
    ],
  },
}));

// This later, narrower override retains each feature's boundary rules while
// adding the server-to-component prohibition to files matched by both scopes.
const featureServerBoundaryConfigs = featureNames.map((featureName) => ({
  name: `karrot/feature-server-boundary/${featureName}`,
  files: [`src/features/${featureName}/server/**/*.${moduleExtensions}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...featureImportRestrictions(featureName),
          serverComponentImportRestriction,
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      ...restrictedModuleSyntax([
        ...featureImportRestrictions(featureName),
        serverComponentImportRestriction,
      ]),
    ],
  },
}));

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "backups/**",
    "node_modules/**",
    "coverage/**",
    "supabase/.temp/**",
  ]),
  {
    name: "karrot/server-component-boundary",
    files: [
      `**/server/**/*.${moduleExtensions}`,
      `src/app/**/actions.${moduleExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            relativeDotSegmentRestriction,
            repeatedSlashImportRestriction,
            backslashImportRestriction,
            serverComponentImportRestriction,
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...restrictedModuleSyntax([
          relativeDotSegmentRestriction,
          repeatedSlashImportRestriction,
          backslashImportRestriction,
          serverComponentImportRestriction,
        ]),
      ],
    },
  },
  ...featureBoundaryConfigs,
  ...featureServerBoundaryConfigs,
]);
