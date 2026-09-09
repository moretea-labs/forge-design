#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_VERSION } from './scripts/version.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const helperPath = resolve(root, 'scripts/forge-provider.mjs');
const loadSchema = (name) => JSON.parse(readFileSync(resolve(root, 'schemas', `${name}.schema.json`), 'utf8'));
const embedded = (schema) => {
  const copy = structuredClone(schema);
  delete copy.$schema;
  delete copy.$id;
  delete copy.title;
  return copy;
};
const projectId = { type:'string', pattern:'^[a-z0-9][a-z0-9_-]*$' };
const screenId = { type:'string', pattern:'^[a-z0-9][a-z0-9_-]*$' };
const flowId = { type:'string', pattern:'^[a-z0-9][a-z0-9_-]*$' };
const unitId = { type:'string', pattern:'^[a-z0-9][a-z0-9_-]*$' };
const exactRevision = { type:'string', pattern:'^[0-9a-f]{40,64}$' };
const artifactRefs = { type:'array', items:{ type:'string', minLength:1 }, default:[] };
const optionalNote = { type:'string', minLength:1 };
const tokensDocument = embedded(loadSchema('tokens'));
const componentsDocument = embedded(loadSchema('components'));
const designUnitsDocument = embedded(loadSchema('design-units'));
const screenDocument = embedded(loadSchema('screen'));
const productDocument = embedded(loadSchema('product'));
const flowDocument = structuredClone(productDocument.properties.flows.items);

const scopeRead = { scope: 'design.read', mode: 'read', description: 'Read registered Forge Design product contracts, flows, Golden gates, screens, components, tokens, and Design Units.', granted: true, required: true };
const scopeProjects = { scope: 'design.projects', mode: 'write', description: 'Register an explicit local project root with Forge Design.', granted: true, required: false };
const scopeWrite = { scope: 'design.write', mode: 'write', description: 'Write validated repository-native Forge Design assets for an explicitly registered design project.', granted: true, required: false };
const writeClaim = [{ resource: 'repo-state', mode: 'write' }];
const objectArgs = (properties, required = Object.keys(properties)) => ({ type:'object', properties, required, additionalProperties:false });
const readAction = (actionId, title, description, argumentsSchema) => ({ actionId, title, description, readOnly:true, risk:'readonly', confirmation:'none', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.read'], resourceClaims:[], argumentsSchema });
const writeAction = (actionId, title, description, argumentsSchema, timeout = 10000, idempotent = false) => ({ actionId, title, description, readOnly:false, risk:'workspace_write', confirmation:'authorization', defaultTimeoutMs:timeout, cancellable:true, idempotent, scopes:['design.write'], resourceClaims:writeClaim, argumentsSchema });
const strongWriteAction = (actionId, title, description, requiredConfirmationText, argumentsSchema, timeout = 10000) => ({ actionId, title, description, readOnly:false, risk:'workspace_write', confirmation:'strong_confirmation', requiredConfirmationText, defaultTimeoutMs:timeout, cancellable:true, idempotent:false, scopes:['design.write'], resourceClaims:writeClaim, argumentsSchema });
const projectArgs = objectArgs({ project_id:projectId });

const actions = [
  readAction('design_list_projects','List design projects','List explicitly registered Forge Design projects.',objectArgs({},[])),
  { actionId:'design_register_project', title:'Register design project', description:'Register one explicit local repository root with Forge Design.', readOnly:false, risk:'workspace_write', confirmation:'authorization', defaultTimeoutMs:10000, cancellable:true, idempotent:true, scopes:['design.projects'], resourceClaims:writeClaim, argumentsSchema:objectArgs({project_root:{type:'string',minLength:1}}) },
  readAction('design_get_context','Get design context','Read deterministic manifest, storage state, Design Units, product model, tokens, components and screens.',projectArgs),
  readAction('design_get_product_model','Get product design model','Read User Job, product brief, flows, interaction patterns and Golden review state.',projectArgs),
  writeAction('design_put_product_model','Put product design model','Validate and atomically persist the repository-native Product Design Model.',objectArgs({project_id:projectId,product:productDocument})),
  readAction('design_get_design_units','Get Design Units','Read reviewable design families and pinned upstream Product Contract references.',projectArgs),
  writeAction('design_put_design_units','Put Design Units','Validate and atomically persist Design Units.',objectArgs({project_id:projectId,design_units:designUnitsDocument})),
  readAction('design_get_tokens','Get design tokens','Read canonical repository-native design tokens.',projectArgs),
  writeAction('design_put_tokens','Put design tokens','Validate and atomically persist canonical design tokens.',objectArgs({project_id:projectId,tokens:tokensDocument})),
  readAction('design_get_components','Get component contracts','Read typed semantic component contracts and declarative preview composition.',projectArgs),
  writeAction('design_put_components','Put component contracts','Validate and atomically persist typed semantic component contracts.',objectArgs({project_id:projectId,components:componentsDocument})),
  readAction('design_list_screens','List screens','List independent Screen Specs for one design project.',projectArgs),
  readAction('design_get_screen','Get screen','Read one Screen Spec including state variants.',objectArgs({project_id:projectId,screen_id:screenId})),
  writeAction('design_create_screen','Create screen','Validate and create one independent Screen Spec without replacing an existing screen.',objectArgs({project_id:projectId,screen:screenDocument})),
  writeAction('design_put_screen','Put screen','Validate and atomically replace one Screen Spec whose id matches screen_id.',objectArgs({project_id:projectId,screen_id:screenId,screen:screenDocument})),
  readAction('design_get_product_flow','Get product flow','Read one transition-based Product Flow from canonical product.json.',objectArgs({project_id:projectId,flow_id:flowId})),
  writeAction('design_put_product_flow','Put product flow','Validate and upsert one Product Flow inside canonical product.json without creating a second flow authority.',objectArgs({project_id:projectId,flow_id:flowId,flow:flowDocument})),
  readAction('design_get_review_status','Get design review status','Read per-Design-Unit review state, current design digests, acceptance currency and project freeze currency.',projectArgs),
  strongWriteAction('design_accept_unit','Accept Design Unit','Record human acceptance evidence for one visually reviewed Design Unit at an exact clean Git revision.','accept-design-unit',objectArgs({project_id:projectId,unit_id:unitId,candidate_revision:exactRevision,artifact_refs:artifactRefs,note:optionalNote},['project_id','unit_id','candidate_revision'])),
  strongWriteAction('design_freeze_project','Freeze design project','Freeze the whole design only after every Design Unit has current human acceptance evidence at an exact clean Git revision.','freeze-design-project',objectArgs({project_id:projectId,candidate_revision:exactRevision,artifact_refs:artifactRefs,note:optionalNote},['project_id','candidate_revision'])),
  writeAction('design_migrate_project','Migrate design storage','Explicitly migrate a readable legacy Forge Design project to the current storage version.',projectArgs,10000,true),
  readAction('design_validate','Validate design project','Validate one Forge Design project and return structured findings.',projectArgs),
  readAction('design_export_markdown','Export design.md','Export one registered design project as portable deterministic design.md.',projectArgs),
  writeAction('design_import_markdown','Import design.md','Validate and import portable design.md into one registered design project.',objectArgs({project_id:projectId,markdown:{type:'string',minLength:1}}),30000,false),
];
const registration = {
  pluginId:'design', providerPluginId:'design', displayName:'Forge Design', provider:'moretea-labs', pluginVersion:PACKAGE_VERSION, protocolVersion:'1.0', scope:'controller', enabled:true,
  transport:{kind:'managed_cli_json', runtimeExecutable:process.execPath, helperPath, cwd:root, maxRequestBytes:8*1024*1024, maxResponseBytes:8*1024*1024, healthTimeoutMs:5000, actionTimeoutMs:30000},
  permissions:[scopeRead,scopeProjects,scopeWrite],
  capabilities:[
    {capabilityId:'design.projects',title:'Design projects',description:'Register explicit local project roots.',scopes:['design.projects'],actions:['design_register_project']},
    {capabilityId:'design.read',title:'Design reads',description:'List, validate, inspect and export deterministic design assets.',scopes:['design.read'],actions:actions.filter((action)=>action.readOnly).map((action)=>action.actionId)},
    {capabilityId:'design.write',title:'Design writes',description:'Write validated repository-native design assets through canonical ProjectStore operations.',scopes:['design.write'],actions:actions.filter((action)=>!action.readOnly && action.actionId!=='design_register_project').map((action)=>action.actionId)},
  ],
  actions,
  legacyIdentities:['repo-harness-design','Design Harness'],
};
process.stdout.write(`${JSON.stringify({ schemaVersion:1, registration })}\n`);
