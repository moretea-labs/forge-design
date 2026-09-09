import { DesignStoreError } from './project-store.mjs';

export const providerCapabilities = ['design.projects', 'design.read', 'design.write'];

export const providerActions = [
  'design_list_projects',
  'design_register_project',
  'design_get_context',
  'design_get_product_model',
  'design_put_product_model',
  'design_get_design_units',
  'design_put_design_units',
  'design_get_tokens',
  'design_put_tokens',
  'design_get_components',
  'design_put_components',
  'design_list_screens',
  'design_get_screen',
  'design_create_screen',
  'design_put_screen',
  'design_get_product_flow',
  'design_put_product_flow',
  'design_get_review_status',
  'design_accept_unit',
  'design_freeze_project',
  'design_migrate_project',
  'design_validate',
  'design_export_markdown',
  'design_import_markdown',
];

function requireProduct(product, projectId) {
  if (!product) throw new DesignStoreError(`Project ${projectId} does not have product.json.`, 404, 'PRODUCT_MODEL_NOT_FOUND');
  return product;
}

function findFlow(product, flowId) {
  const flow = product.flows.find((item) => item.id === flowId);
  if (!flow) throw new DesignStoreError(`Unknown product flow: ${flowId}.`, 404, 'PRODUCT_FLOW_NOT_FOUND');
  return flow;
}

export async function executeProviderAction(store, actionId, input = {}) {
  switch (actionId) {
    case 'design_list_projects': return { projects: await store.listProjects() };
    case 'design_register_project': return await store.registerProjectRoot(input.project_root);
    case 'design_get_context': return await store.getContext(input.project_id);
    case 'design_get_product_model': return await store.getProductModel(input.project_id);
    case 'design_put_product_model': return await store.putProductModel(input.project_id, input.product);
    case 'design_get_design_units': return await store.getDesignUnits(input.project_id);
    case 'design_put_design_units': return await store.putDesignUnits(input.project_id, input.design_units);
    case 'design_get_tokens': return await store.getTokens(input.project_id);
    case 'design_put_tokens': return await store.putTokens(input.project_id, input.tokens);
    case 'design_get_components': return await store.getComponents(input.project_id);
    case 'design_put_components': return await store.putComponents(input.project_id, input.components);
    case 'design_list_screens': return { screens: await store.listScreens(input.project_id) };
    case 'design_get_screen': return await store.getScreen(input.project_id, input.screen_id);
    case 'design_create_screen': return await store.createScreen(input.project_id, input.screen);
    case 'design_put_screen': {
      if (input.screen?.id !== input.screen_id) throw new DesignStoreError('screen_id must match screen.id.', 400, 'SCREEN_ID_MISMATCH');
      return await store.putScreen(input.project_id, input.screen);
    }
    case 'design_get_product_flow': {
      const product = requireProduct(await store.getProductModel(input.project_id), input.project_id);
      return structuredClone(findFlow(product, input.flow_id));
    }
    case 'design_put_product_flow': {
      const product = requireProduct(await store.getProductModel(input.project_id), input.project_id);
      if (!input.flow || input.flow.id !== input.flow_id) throw new DesignStoreError('flow_id must match flow.id.', 400, 'PRODUCT_FLOW_ID_MISMATCH');
      const index = product.flows.findIndex((item) => item.id === input.flow_id);
      if (index >= 0) product.flows[index] = input.flow;
      else product.flows.push(input.flow);
      await store.putProductModel(input.project_id, product);
      return structuredClone(findFlow(product, input.flow_id));
    }
    case 'design_get_review_status': return await store.getDesignReviewStatus(input.project_id);
    case 'design_accept_unit': return await store.acceptDesignUnit(input.project_id, input.unit_id, { candidateRevision: input.candidate_revision, artifactRefs: input.artifact_refs ?? [], note: input.note });
    case 'design_freeze_project': return await store.freezeProjectDesign(input.project_id, { candidateRevision: input.candidate_revision, artifactRefs: input.artifact_refs ?? [], note: input.note });
    case 'design_migrate_project': return await store.migrateProjectStorage(input.project_id);
    case 'design_validate': return await store.validateProject(input.project_id);
    case 'design_export_markdown': return { project_id: input.project_id, markdown: await store.exportDesignMarkdown(input.project_id) };
    case 'design_import_markdown': return await store.importDesignMarkdown(input.project_id, input.markdown);
    default: throw Object.assign(new Error(`Unknown action: ${actionId}`), { code: 'FORGE_DESIGN_ACTION_UNKNOWN' });
  }
}
