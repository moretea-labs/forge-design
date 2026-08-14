#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const helperPath = resolve(root, 'scripts/forge-provider.mjs');
const scopeRead = { scope: 'design.read', mode: 'read', description: 'Read registered Forge Design product contracts, flows, Golden gates, screens, components, and tokens.', granted: true, required: true };
const scopeProjects = { scope: 'design.projects', mode: 'write', description: 'Register an explicit local project root with Forge Design.', granted: true, required: false };
const scopeWrite = { scope: 'design.write', mode: 'write', description: 'Write validated product contracts and portable design.md content into an explicitly registered design project.', granted: true, required: false };
const writeClaim = [{ resource: 'repo-state', mode: 'write' }];
const actions = [
  { actionId:'design_list_projects', title:'List design projects', description:'List explicitly registered Forge Design projects.', readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema:{type:'object',properties:{},additionalProperties:false} },
  { actionId:'design_register_project', title:'Register design project', description:'Register one explicit local repository root with Forge Design.', readOnly:false, risk:'workspace_write', confirmation:'authorization', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.projects'], resourceClaims:writeClaim, argumentsSchema:{type:'object',properties:{project_root:{type:'string'}},required:['project_root'],additionalProperties:false} },
  { actionId:'design_get_context', title:'Get design context', description:'Read the deterministic project manifest, tokens, components and screens.', readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false} },
  { actionId:'design_get_product_model', title:'Get product design model', description:'Read User Job, product brief, flows, interaction patterns and Golden review state.', readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false} },
  { actionId:'design_put_product_model', title:'Put product design model', description:'Validate and atomically persist the repository-native Product Contract and Golden gate state.', readOnly:false, risk:'workspace_write', confirmation:'authorization', defaultTimeoutMs:10000, cancellable:true, idempotent:false, scopes:['design.write'], resourceClaims:writeClaim, argumentsSchema:{type:'object',properties:{project_id:{type:'string'},product:{type:'object'}},required:['project_id','product'],additionalProperties:false} },
  { actionId:'design_validate', title:'Validate design project', description:'Validate one Forge Design project and return structured findings.', readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false} },
  { actionId:'design_export_markdown', title:'Export design.md', description:'Export one registered design project as portable deterministic design.md.', readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema:{type:'object',properties:{project_id:{type:'string'}},required:['project_id'],additionalProperties:false} },
  { actionId:'design_import_markdown', title:'Import design.md', description:'Validate and import portable design.md into one registered design project.', readOnly:false, risk:'workspace_write', confirmation:'authorization', defaultTimeoutMs:30000, cancellable:true, idempotent:false, scopes:['design.write'], resourceClaims:writeClaim, argumentsSchema:{type:'object',properties:{project_id:{type:'string'},markdown:{type:'string'}},required:['project_id','markdown'],additionalProperties:false} },
];
const registration = {
  pluginId:'design', providerPluginId:'design', displayName:'Forge Design', provider:'moretea-labs', pluginVersion:'0.4.0', protocolVersion:'1.0', scope:'controller', enabled:true,
  transport:{kind:'managed_cli_json', runtimeExecutable:process.execPath, helperPath, cwd:root, maxRequestBytes:8*1024*1024, maxResponseBytes:8*1024*1024, healthTimeoutMs:5000, actionTimeoutMs:30000},
  permissions:[scopeRead,scopeProjects,scopeWrite],
  capabilities:[
    {capabilityId:'design.projects',title:'Design projects',description:'Register explicit local project roots.',scopes:['design.projects'],actions:['design_register_project']},
    {capabilityId:'design.read',title:'Design reads',description:'List, validate, inspect and export deterministic design assets.',scopes:['design.read'],actions:['design_list_projects','design_get_context','design_get_product_model','design_validate','design_export_markdown']},
    {capabilityId:'design.write',title:'Design writes',description:'Import validated portable design assets.',scopes:['design.write'],actions:['design_put_product_model','design_import_markdown']},
  ],
  actions,
  legacyIdentities:['repo-harness-design','Design Harness'],
};
process.stdout.write(`${JSON.stringify({ schemaVersion:1, registration })}\n`);
