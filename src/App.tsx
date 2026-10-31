import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clipboard,
  Component,
  FileCode2,
  Download,
  Focus,
  GitBranch,
  Grid2X2,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  SwatchBook,
} from 'lucide-react';
import { designApi, visualAssetContentUrl, type DesignSourceModule } from './client/design-api';
import { lintScreen } from './core/lint';
import type {
  ComponentContract,
  ComponentContractsDocument,
  DesignProjectContext,
  DesignProjectPaths,
  DesignProjectSummary,
  DesignReviewProfile,
  DesignReviewStatus,
  DesignTokens,
  ProductDesignModel,
  ScreenSpec,
} from './core/schema';
import { initialScreenStateId, resolveScreenState, screenStateIds } from './core/schema';
import { installTokenVariables } from './design-system/tokens';
import { ProductWorkspace } from './components/ProductWorkspace';
import { ReviewCanvas, type ReviewCanvasLane, type ReviewCanvasMode } from './components/ReviewCanvas';

type WorkspaceView = 'product' | 'screens' | 'components' | 'tokens' | 'modules';
type InspectorTab = 'inspect' | 'spec' | 'flow';
type Notice = { kind: 'success' | 'error'; message: string } | null;

const json = (value: unknown) => JSON.stringify(value, null, 2);

const toKebab = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
type ReviewSurfaceStyle = CSSProperties & Record<`--${string}`, string | number>;

function reviewSurfaceStyle(profile: DesignReviewProfile, tokens: DesignTokens): ReviewSurfaceStyle {
  const colors = { ...tokens.color, ...(tokens.colorModes?.[profile.colorScheme] ?? {}) };
  const style: ReviewSurfaceStyle = {
    width: `${profile.viewport.width + 24}px`,
    height: `${profile.viewport.height + 24}px`,
    colorScheme: profile.colorScheme,
    '--review-screen-width': `${profile.viewport.width}px`,
    '--review-screen-height': `${profile.viewport.height}px`,
    '--review-safe-top': `${profile.viewport.safeTop}px`,
    '--review-safe-bottom': `${profile.viewport.safeBottom}px`,
  };
  Object.entries(colors).forEach(([name, value]) => { style[`--color-${toKebab(name)}`] = value; });
  Object.entries(tokens.material ?? {}).forEach(([name, material]) => { style[`--material-${toKebab(name)}-tint`] = material.tint ?? 'transparent'; style[`--material-${toKebab(name)}-blur`] = `${material.blur ?? 0}px`; style[`--material-${toKebab(name)}-opacity`] = String(material.opacity ?? 1); });
  Object.entries(tokens.typography).forEach(([name, type]) => {
    style[`--type-${toKebab(name)}-size`] = `${type.size * profile.textScale}px`;
    style[`--type-${toKebab(name)}-line`] = `${type.lineHeight * profile.textScale}px`;
    style[`--type-${toKebab(name)}-weight`] = String(type.weight);
  });
  if (profile.contrast === 'increased') style.filter = 'contrast(1.15)';
  return style;
}

function productScaffold(context: DesignProjectContext): ProductDesignModel {
  return {
    schemaVersion: 1,
    brief: {
      status: 'draft',
      userJob: 'Define the primary user job before composing screens.',
      productGoal: 'Describe the product outcome this flow must achieve.',
      businessSemantics: [],
      primaryTasks: ['Define the primary task.'],
      secondaryTasks: [],
      informationHierarchy: [{ role: 'primary_meaning', description: 'Define what must be understood first.', priority: 'primary' }],
      stateModel: [],
      interactionModel: [{ id: 'primary-action', semantics: 'Define the semantic meaning of the primary action before styling it.' }],
      screenFamily: 'unclassified',
      nonGoals: [],
      preservedSemantics: [],
    },
    flows: [{ id: 'primary-flow', name: 'Primary product flow', userJob: 'Define the end-to-end user job.', screenIds: [context.project.activeScreenId], entry: { screenId: context.project.activeScreenId, stateId: initialScreenStateId(context.screens.find((screen) => screen.id === context.project.activeScreenId) ?? context.screens[0]) }, transitions: [], status: 'draft' }],
    patterns: [],
    golden: { status: 'draft', screenIds: [context.project.activeScreenId], flowIds: ['primary-flow'], patternIds: [], review: { stage: 'not_started', userDecision: 'pending', artifactRefs: [], notes: [] } },
  };
}

function parseDocument<T>(source: string): T {
  return JSON.parse(source) as T;
}

function newScreen(profile: DesignReviewProfile | null): ScreenSpec {
  const id = `screen-${Date.now().toString(36)}`;
  return {
    schemaVersion: 1,
    id,
    name: '新画板',
    ...(profile ? { viewport: { ...profile.viewport } } : {}),
    goal: '先定义这个页面要帮助用户完成什么。',
    primaryAction: 'continue',
    constraints: ['只使用当前项目注册的组件和 Token。'],
    nodes: [
      { id: 'header', component: 'ScreenHeader', props: { eyebrow: 'New screen', title: '新画板' } },
      { id: 'empty', component: 'EmptyState', props: { title: '从页面目标开始', body: '在 Spec 中完善目标、约束和组件结构。' } },
      { id: 'continue', component: 'PrimaryAction', props: { label: '继续', activeLabel: '继续' } },
    ],
  };
}

function AssetEditor({ value, onChange, onSave, onReload, busy }: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReload: () => void;
  busy: boolean;
}): ReactElement {
  return (
    <div className="asset-editor">
      <textarea aria-label="JSON editor" spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />
      <div className="editor-actions">
        <button onClick={onReload} disabled={busy}><RefreshCw size={14} />重新读取</button>
        <button className="save-button" onClick={onSave} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}保存到仓库</button>
      </div>
    </div>
  );
}

export default function App(): ReactElement {
  const [projects, setProjects] = useState<DesignProjectSummary[]>([]);
  const [sourceModules, setSourceModules] = useState<DesignSourceModule[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [moduleScreenId, setModuleScreenId] = useState('');
  const [moduleScreenQuery, setModuleScreenQuery] = useState('');
  const [modulePreviewScale, setModulePreviewScale] = useState(0.72);
  const [modulePreviewUrl, setModulePreviewUrl] = useState('');
  const modulePreviewFrame = useRef<HTMLIFrameElement>(null);
  const [projectId, setProjectId] = useState('');
  const [context, setContext] = useState<DesignProjectContext | null>(null);
  const [paths, setPaths] = useState<DesignProjectPaths | null>(null);
  const [reviewStatus, setReviewStatus] = useState<DesignReviewStatus | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [activeStateId, setActiveStateId] = useState('normal');
  const [reviewProfileId, setReviewProfileId] = useState('');
  const [selectedComponentName, setSelectedComponentName] = useState('');
  const [view, setView] = useState<WorkspaceView>('product');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('inspect');
  const [editorText, setEditorText] = useState('');
  const [zoom, setZoom] = useState(0.78);
  const [reviewMode, setReviewMode] = useState<ReviewCanvasMode>('device');
  const [reviewLane, setReviewLane] = useState<ReviewCanvasLane>('artboard');
  const [selectedReferenceId, setSelectedReferenceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const selected = context?.screens.find((screen) => screen.id === selectedId) ?? context?.screens[0] ?? null;
  const selectedModule = sourceModules.find((module) => module.id === selectedModuleId) ?? sourceModules[0] ?? null;
  const selectedModuleScreen = selectedModule?.screens?.find((screen) => screen.id === moduleScreenId)
    ?? selectedModule?.screens?.find((screen) => screen.id === selectedModule.preview?.screenId)
    ?? selectedModule?.screens?.[0] ?? null;
  const visibleModuleScreens = (selectedModule?.screens ?? []).filter((screen) =>
    (screen.name + ' ' + screen.id + ' ' + screen.badge).toLowerCase().includes(moduleScreenQuery.trim().toLowerCase()));
  const selectedStateIds = selected ? screenStateIds(selected) : [];
  const resolvedSelected = selected ? resolveScreenState(selected, activeStateId) : null;
  const contracts = context?.components.components ?? [];
  const selectedComponent = contracts.find((component) => component.name === selectedComponentName) ?? contracts[0] ?? null;
  const issues = useMemo(() => resolvedSelected && context ? lintScreen(resolvedSelected, context.components) : [], [resolvedSelected, context]);
  const reviewProfiles = context?.designUnits.reviewProfiles ?? [];
  const reviewProfile = reviewProfiles.find((profile) => profile.id === reviewProfileId) ?? reviewProfiles[0] ?? null;
  const ownerUnits = useMemo(() => context && selected
    ? context.designUnits.units.filter((unit) => unit.screenIds.includes(selected.id))
    : [], [context, selected]);
  const selectedOwnerUnit = ownerUnits.length === 1 ? ownerUnits[0] : null;
  const artboardCandidates = useMemo(() => {
    if (!context || !selected || !selectedOwnerUnit || !reviewProfile) return [];
    return context.visualAssets.assets.filter((asset) => asset.role === 'design_artboard'
      && asset.binding?.designUnitId === selectedOwnerUnit.id
      && asset.binding?.screenId === selected.id
      && asset.binding?.stateId === activeStateId
      && asset.binding?.profileId === reviewProfile.id);
  }, [activeStateId, context, reviewProfile, selected, selectedOwnerUnit]);
  const availableAssetIds = useMemo(() => new Set((context?.visualAssetStatus ?? []).filter((status) => status.present).map((status) => status.assetId)), [context]);
  const selectedArtboard = artboardCandidates.length === 1 && availableAssetIds.has(artboardCandidates[0].id) ? artboardCandidates[0] : null;
  const artboardIssue = ownerUnits.length !== 1
    ? `Screen must belong to exactly one Design Unit before a visual authority can be resolved; found ${ownerUnits.length}.`
    : artboardCandidates.length > 1
      ? 'Multiple current design artboards claim the same exact binding. Resolve the authority conflict.'
      : artboardCandidates.length === 1 && !availableAssetIds.has(artboardCandidates[0].id)
        ? 'The bound design artboard is declared but its repository content cannot be resolved.'
        : artboardCandidates.length === 0
          ? 'No current design_artboard is bound to this Design Unit / Screen / State / Review Profile.'
          : null;
  const compatibleReferences = useMemo(() => {
    if (!context || !selected) return [];
    const ownerIds = new Set(ownerUnits.map((unit) => unit.id));
    return context.visualAssets.assets.filter((asset) => {
      if (asset.role !== 'reference' || !availableAssetIds.has(asset.id) || !asset.binding) return false;
      if (asset.binding.screenId && asset.binding.screenId !== selected.id) return false;
      if (asset.binding.stateId && asset.binding.stateId !== activeStateId) return false;
      if (asset.binding.profileId && asset.binding.profileId !== reviewProfileId) return false;
      if (asset.binding.designUnitId && !ownerIds.has(asset.binding.designUnitId)) return false;
      return asset.binding.screenId === selected.id || Boolean(asset.binding.designUnitId && ownerIds.has(asset.binding.designUnitId));
    });
  }, [activeStateId, availableAssetIds, context, ownerUnits, reviewProfileId, selected]);
  const selectedReference = selectedReferenceId ? compatibleReferences.find((asset) => asset.id === selectedReferenceId) ?? null : null;
  const selectedFlows = useMemo(() => {
    if (!context?.product || !selected) return [];
    return context.product.flows.filter((flow) => flow.screenIds.includes(selected.id) || flow.entry?.screenId === selected.id || (flow.transitions ?? []).some((transition) => transition.from.screenId === selected.id || transition.to.screenId === selected.id || (transition.recovery ?? []).some((item) => item.target.screenId === selected.id)));
  }, [context, selected]);

  const openModuleScreen = (module: DesignSourceModule, screenId = module.preview?.screenId ?? '') => {
    setSelectedModuleId(module.id);
    setModuleScreenId(screenId);
    setModuleScreenQuery('');
    setModulePreviewUrl(module.preview ? designApi.modulePreviewUrl(projectId, module, screenId) : '');
  };

  useEffect(() => {
    const followPrototypeRoute = (event: MessageEvent) => {
      if (event.source !== modulePreviewFrame.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'forge-design-prototype:navigate'
        || !('screenId' in data) || typeof data.screenId !== 'string') return;
      const currentModule = sourceModules.find(module => module.screens?.some(screen => screen.id === data.screenId));
      if (!currentModule) return;
      // Only the review selection follows this event. Retain the iframe URL so the in-memory draft survives route transitions.
      setSelectedModuleId(currentModule.id);
      setModuleScreenId(data.screenId);
      setModuleScreenQuery('');
    };
    window.addEventListener('message', followPrototypeRoute);
    return () => window.removeEventListener('message', followPrototypeRoute);
  }, [sourceModules]);

  const loadProject = useCallback(async (nextProjectId: string, preferredScreenId?: string, openModules = false) => {
    setBusy(true);
    setNotice(null);
    try {
      const [nextContext, nextPaths, nextReviewStatus, nextModules] = await Promise.all([
        designApi.getContext(nextProjectId),
        designApi.getPaths(nextProjectId),
        designApi.getReviewStatus(nextProjectId),
        designApi.listModules(nextProjectId),
      ]);
      setSourceModules(nextModules);
      if (openModules && nextModules.length) setView('modules');
      setModuleScreenId('');
      setModuleScreenQuery('');
      const firstModule = nextModules[0];
      setSelectedModuleId(firstModule?.id ?? '');
      setModulePreviewUrl(firstModule?.preview ? designApi.modulePreviewUrl(nextProjectId, firstModule) : '');
      setContext(nextContext);
      setPaths(nextPaths);
      setReviewStatus(nextReviewStatus);
      setProjectId(nextProjectId);
      const pageUrl = new URL(window.location.href);
      pageUrl.searchParams.set('project', nextProjectId);
      window.history.replaceState(null, '', pageUrl);
      installTokenVariables(nextContext.tokens);
      const nextScreenId = preferredScreenId && nextContext.screens.some((screen) => screen.id === preferredScreenId)
        ? preferredScreenId
        : nextContext.project.activeScreenId;
      setSelectedId(nextScreenId);
      const nextScreen = nextContext.screens.find((screen) => screen.id === nextScreenId) ?? nextContext.screens[0];
      if (nextScreen) setActiveStateId(initialScreenStateId(nextScreen));
      setSelectedComponentName((current) => nextContext.components.components.some((component) => component.name === current)
        ? current
        : nextContext.components.components[0]?.name ?? '');
      setReviewProfileId((current) => (nextContext.designUnits.reviewProfiles ?? []).some((profile) => profile.id === current)
        ? current
        : nextContext.designUnits.reviewProfiles?.[0]?.id ?? '');
      return true;
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法读取设计项目。' });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setBusy(true);
    try {
      const nextProjects = await designApi.listProjects();
      setProjects(nextProjects);
      const nextProjectId = nextProjects.some((project) => project.id === projectId) ? projectId : nextProjects[0]?.id;
      if (nextProjectId) await loadProject(nextProjectId, selectedId);
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法发现设计项目。' });
      setBusy(false);
    }
  }, [loadProject, projectId, selectedId]);

  useEffect(() => {
    void (async () => {
      try {
        const nextProjects = await designApi.listProjects();
        setProjects(nextProjects);
        const requestedId = new URLSearchParams(window.location.search).get('project');
        const candidates = requestedId && nextProjects.some((item) => item.id === requestedId)
          ? [...nextProjects.filter((item) => item.id === requestedId), ...nextProjects.filter((item) => item.id !== requestedId)]
          : nextProjects;
        for (const candidate of candidates) {
          if (await loadProject(candidate.id, undefined, true)) break;
        }
      } catch (error) {
        setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法启动 Design Harness。' });
      }
    })();
  }, [loadProject]);

  useEffect(() => {
    if (!selected) return;
    const availableStates = screenStateIds(selected);
    if (!availableStates.includes(activeStateId)) setActiveStateId(initialScreenStateId(selected));
  }, [selected, activeStateId]);

  useEffect(() => {
    if (!selectedReferenceId || compatibleReferences.some((asset) => asset.id === selectedReferenceId)) return;
    setSelectedReferenceId('');
  }, [compatibleReferences, selectedReferenceId]);

  useEffect(() => {
    if (!context) return;
    if (view === 'product') setEditorText(json(context.product ?? productScaffold(context)));
    else if (view === 'tokens') setEditorText(json(context.tokens));
    else if (view === 'components') setEditorText(json(context.components));
    else if (inspectorTab === 'spec' && selected) setEditorText(json(selected));
  }, [context, view, inspectorTab, selected]);

  const saveEditor = async () => {
    if (!context) return;
    setBusy(true);
    setNotice(null);
    try {
      if (view === 'product') {
        await designApi.putProduct(projectId, parseDocument<ProductDesignModel>(editorText));
      } else if (view === 'tokens') {
        const document = parseDocument<DesignTokens>(editorText);
        await designApi.putTokens(projectId, document);
        installTokenVariables(document);
      } else if (view === 'components') {
        await designApi.putComponents(projectId, parseDocument<ComponentContractsDocument>(editorText));
      } else if (selected) {
        const document = parseDocument<ScreenSpec>(editorText);
        if (document.id !== selected.id) throw new Error('编辑已有画板时不能修改 screen id；请新建独立画板。');
        await designApi.putScreen(projectId, document);
      }
      await loadProject(projectId, selected?.id);
      setNotice({ kind: 'success', message: '已原子写入目标仓库的 .design-harness。' });
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : '保存失败。' });
    } finally {
      setBusy(false);
    }
  };

  const createScreen = async () => {
    if (!context) return;
    setBusy(true);
    const screen = newScreen(reviewProfile);
    try {
      await designApi.createScreen(projectId, screen);
      setView('screens');
      setInspectorTab('spec');
      await loadProject(projectId, screen.id);
      setNotice({ kind: 'success', message: `已创建 screens/${screen.id}.json。` });
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : '创建画板失败。' });
    } finally {
      setBusy(false);
    }
  };

  const downloadModule = async () => {
    if (!selectedModule) return;
    setBusy(true);
    try {
      const blob = await designApi.exportModule(projectId, selectedModule.id);
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = selectedModule.id + '-design.md';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNotice({ kind: 'success', message: '已导出 ' + selectedModule.name + ' 的源码和产品约束；不会改变项目设计。' });
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : '模块导出失败。' });
    } finally {
      setBusy(false);
    }
  };

  const copyContext = async () => {
    if (!context) return;
    try {
      await navigator.clipboard.writeText(json(context));
      setNotice({ kind: 'success', message: '完整 ChatGPT 设计上下文已复制。' });
    } catch {
      setNotice({ kind: 'error', message: '浏览器拒绝剪贴板访问，请在 Context API 中读取。' });
    }
  };

  const switchView = (nextView: WorkspaceView) => {
    setView(nextView);
    if (nextView === 'screens') setInspectorTab('inspect');
  };

  if (!context) {
    return <div className="loading-shell"><LoaderCircle className="spin" /><strong>正在读取仓库设计资产</strong>{notice && <span>{notice.message}</span>}</div>;
  }

  const renderProductSidebar = () => (
    <>
      <div className="sidebar-section-title"><span>Product model</span><span>{context.product ? 'canonical' : 'legacy'}</span></div>
      <div className="product-sidebar-list">
        <div><strong>Product Brief</strong><small>{context.product?.brief.screenFamily ?? '未建模'}</small></div>
        <div><strong>Flows</strong><small>{context.product?.flows.length ?? 0} 条链路</small></div>
        <div><strong>Interaction Patterns</strong><small>{context.product?.patterns.length ?? 0} 个候选</small></div>
        <div><strong>Runtime Review</strong><small>{context.goldenGate.runtimeReviewStage}</small></div>
        <div><strong>Golden</strong><small>{context.goldenGate.status}</small></div>
      </div>
    </>
  );

  const renderScreensSidebar = () => (
    <>
      <div className="sidebar-section-title"><span>项目画板</span><button aria-label="新建画板" onClick={() => void createScreen()} disabled={busy}><Plus size={17} /></button></div>
      <div className="screen-list">
        {context.screens.map((screen) => (
          <button key={screen.id} className={screen.id === selected?.id ? 'selected' : ''} onClick={() => { setSelectedId(screen.id); setActiveStateId(initialScreenStateId(screen)); }}>
            <span className="mini-device"><span /></span><span><strong>{screen.name}</strong><small>{screen.id}</small></span>
          </button>
        ))}
      </div>
    </>
  );

  const renderComponentsSidebar = () => (
    <>
      <div className="sidebar-section-title"><span>组件契约</span><span>{contracts.length}</span></div>
      <div className="screen-list contract-list">
        {contracts.map((contract) => (
          <button key={contract.name} className={contract.name === selectedComponent?.name ? 'selected' : ''} onClick={() => setSelectedComponentName(contract.name)}>
            <Component size={18} /><span><strong>{contract.name}</strong><small>{contract.category}</small></span>
          </button>
        ))}
      </div>
    </>
  );

  const renderTokensSidebar = () => (
    <>
      <div className="sidebar-section-title"><span>Token 分组</span><span>{Object.keys(context.tokens).length - 2}</span></div>
      <div className="token-group-list">
        {Object.entries(context.tokens).filter(([name]) => !['schemaVersion', 'meta'].includes(name)).map(([name, value]) => (
          <div key={name}><SwatchBook size={15} /><strong>{name}</strong><span>{Object.keys(value as object).length}</span></div>
        ))}
      </div>
    </>
  );

  const renderAssetWorkspace = () => {
    const isTokens = view === 'tokens';
    const title = isTokens ? 'Design Tokens' : 'Component Contracts';
    const description = isTokens
      ? '保存后立即重新安装 CSS Variables，并同步写入目标仓库。'
      : 'ChatGPT 只能组合这里声明的组件和 Props。';
    return (
      <div className="asset-workspace">
        <div className="asset-workspace-header"><div><span>{context.project.name}</span><h1>{title}</h1><p>{description}</p></div><div className="asset-badge">Canonical · .design-harness</div></div>
        {view === 'components' && selectedComponent && (
          <div className="selected-contract-card">
            <div><Component size={20} /><strong>{selectedComponent.name}</strong><span>{selectedComponent.category}</span></div>
            <p>{selectedComponent.purpose}</p>
            <div>{(selectedComponent.props?.map((prop) => `${prop.name}:${prop.type}`) ?? selectedComponent.allowedProps ?? []).map((prop) => <code key={prop}>{prop}</code>)}</div>
          </div>
        )}
        {isTokens && (
          <div className="full-token-preview">
            {Object.entries(context.tokens.color).map(([name, value]) => <div key={name}><span style={{ background: value }} /><strong>{name}</strong><small>{value}</small></div>)}
          </div>
        )}
        <AssetEditor value={editorText} onChange={setEditorText} onSave={() => void saveEditor()} onReload={() => void loadProject(projectId, selected?.id)} busy={busy} />
      </div>
    );
  };

  const renderInspector = () => {
    if (!selected) return null;
    if (inspectorTab === 'spec') {
      return <section className="inspector-section inspector-editor"><div className="inspector-title"><FileCode2 size={16} /><strong>Screen Spec</strong><span>JSON</span></div><AssetEditor value={editorText} onChange={setEditorText} onSave={() => void saveEditor()} onReload={() => setEditorText(json(selected))} busy={busy} /></section>;
    }
    if (inspectorTab === 'flow') {
      const transitionCount = selectedFlows.reduce((count, flow) => count + (flow.transitions?.length ?? 0), 0);
      return (
        <section className="inspector-section flow-panel">
          <div className="inspector-title"><GitBranch size={16} /><strong>Product Flow</strong><span>{transitionCount}</span></div>
          {selectedFlows.length === 0 ? <div className="flow-start">当前页面尚未关联 Product Flow</div> : selectedFlows.map((flow) => (
            <div key={flow.id}>
              <div className="flow-start">{flow.name} · {flow.entry ? `${flow.entry.screenId}${flow.entry.stateId ? ` / ${flow.entry.stateId}` : ''}` : 'legacy entry missing'}</div>
              {(flow.transitions ?? []).map((transition) => (
                <div className="flow-node" key={transition.id}>
                  <span>{transition.from.screenId}{transition.from.stateId ? ` / ${transition.from.stateId}` : ''} → {transition.to.screenId}{transition.to.stateId ? ` / ${transition.to.stateId}` : ''}</span>
                  <small>{transition.trigger.interactionId}{transition.trigger.event ? ` · ${transition.trigger.event}` : ''} · {transition.commitBoundary.kind}</small>
                  <small>{transition.result}</small>
                  {(transition.recovery ?? []).map((recovery, index) => <small key={`${transition.id}-recovery-${index}`}>Recovery: {recovery.condition} → {recovery.target.screenId}{recovery.target.stateId ? ` / ${recovery.target.stateId}` : ''}</small>)}
                </div>
              ))}
              {!flow.transitions && <div className="flow-primary">Legacy flow · transition graph required before Golden promotion</div>}
            </div>
          ))}
        </section>
      );
    }
    return (
      <>
        <section className="inspector-section"><div className="inspector-title"><Focus size={16} /><strong>页面意图</strong></div><p>{resolvedSelected?.goal}</p><div className="primary-tag">Primary · {resolvedSelected?.primaryAction}</div></section>
        <section className="inspector-section"><div className="inspector-title"><Layers3 size={16} /><strong>Visual authority</strong><span>{selectedArtboard ? 'current' : 'missing'}</span></div>{selectedArtboard ? <div className="lint-success"><CheckCircle2 size={17} />Exact high-fidelity Artboard · {selectedArtboard.id}</div> : <div className="lint-list"><div><CircleAlert size={16} /><span>{artboardIssue}</span></div></div>}<p className="authority-note">Semantic Preview is derived from contracts and never substitutes for this Artboard.</p></section>
        <section className="inspector-section"><div className="inspector-title"><FileCode2 size={16} /><strong>约束</strong><span>{resolvedSelected?.constraints.length ?? 0}</span></div><ul>{(resolvedSelected?.constraints ?? []).map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="inspector-section"><div className="inspector-title"><Component size={16} /><strong>组件树</strong><span>{resolvedSelected?.nodes.length ?? 0}</span></div><div className="component-tree">{(resolvedSelected?.nodes ?? []).map((node) => <div key={node.id}><span className="tree-line" /><span>{node.component}</span><small>{contracts.find((item) => item.name === node.component)?.category ?? 'missing'}</small></div>)}</div></section>
        <section className="inspector-section"><div className="inspector-title"><CheckCircle2 size={16} /><strong>Design lint</strong><span>{issues.length}</span></div>{issues.length === 0 ? <div className="lint-success"><CheckCircle2 size={17} />通过全部规则</div> : <div className="lint-list">{issues.map((issue) => <div key={`${issue.rule}-${issue.nodeId ?? ''}`}><CircleAlert size={16} /><span><strong>{issue.rule}</strong>{issue.message}</span></div>)}</div>}</section>
        <section className="inspector-section token-preview"><div className="inspector-title"><SwatchBook size={16} /><strong>活跃 Token</strong></div><div className="token-swatches">{(['screenBackground', 'surface', 'textPrimary', 'textSecondary', 'accent', 'accentSoft'] as const).map((name) => <div key={name}><span style={{ background: context.tokens.color[name] }} /><small>{name}</small></div>)}</div></section>
        {paths && <section className="inspector-section storage-panel"><div className="inspector-title"><GitBranch size={16} /><strong>事实源</strong><Check size={14} /></div><p>.design-harness 由目标仓库和 Git 管理。</p><code>{paths.storageRoot}</code></section>}
      </>
    );
  };

  return (
    <div className="app-shell">
      <aside className="sidebar left-sidebar">
        <div className="brand"><div className="brand-mark"><Layers3 size={19} /></div><div><strong>Forge Design</strong><span>product → UI design</span></div></div>
        <label className="project-picker"><span>设计项目</span><select value={projectId} onChange={(event) => void loadProject(event.target.value, undefined, true)} disabled={busy}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <nav className="side-nav">
          <button className={view === 'product' ? 'active' : ''} onClick={() => switchView('product')}><Focus size={17} />Product</button>
          <button className={view === 'screens' ? 'active' : ''} onClick={() => switchView('screens')}><Grid2X2 size={17} />Screens</button>
          <button className={view === 'components' ? 'active' : ''} onClick={() => switchView('components')}><Component size={17} />Components</button>
          <button className={view === 'tokens' ? 'active' : ''} onClick={() => switchView('tokens')}><SwatchBook size={17} />Tokens</button>
          {sourceModules.length > 0 && <button className={view === 'modules' ? 'active' : ''} onClick={() => switchView('modules')}><FileCode2 size={17} />Design Modules</button>}
        </nav>
        {view === 'product' ? renderProductSidebar() : view === 'screens' ? renderScreensSidebar() : view === 'components' ? renderComponentsSidebar() : view === 'modules' ? (
          <div className="module-navigator">
            <div className="sidebar-section-title"><span>产品模块</span><span>{sourceModules.length}</span></div>
            <div className="module-family-list">{sourceModules.map(module => <button type="button" key={module.id} aria-current={module.id === selectedModule?.id ? 'page' : undefined} className={module.id === selectedModule?.id ? 'selected' : ''} onClick={() => openModuleScreen(module)}><span>{module.name}</span><small>{module.screens?.length ?? 0}</small></button>)}</div>
            {selectedModule && <div className="module-page-browser">
              <div className="sidebar-section-title"><span>页面与状态</span><span>{selectedModule.screens?.length ?? 0}</span></div>
              <label className="module-search"><Search size={14}/><input aria-label="搜索设计页面" value={moduleScreenQuery} placeholder="搜索页面或状态…" onChange={event => setModuleScreenQuery(event.target.value)} /></label>
              <div className="module-screen-list" role="list" aria-label="模块页面列表">
                {visibleModuleScreens.map(screen => <button type="button" role="listitem" key={screen.id} aria-current={screen.id === selectedModuleScreen?.id ? 'page' : undefined} className={screen.id === selectedModuleScreen?.id ? 'selected' : ''} onClick={() => openModuleScreen(selectedModule, screen.id)}><strong>{screen.name}</strong><small>{screen.id}</small></button>)}
                {!visibleModuleScreens.length && <p>没有匹配的页面</p>}
              </div>
            </div>}
          </div>
        ) : renderTokensSidebar()}
        <div className="system-status"><span className="status-dot" /><div><strong>Repository linked</strong><small>{context.tokens.meta.name} · v{context.tokens.meta.version}</small></div></div>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="toolbar-title"><span className="crumb">{context.project.name} /</span><strong>{view === 'product' ? 'Product Contract' : view === 'screens' ? selected?.name : view === 'components' ? 'Components' : view === 'modules' ? selectedModule?.name : 'Tokens'}</strong>{view === 'modules' && selectedModule && <small className="toolbar-module-count">{selectedModule.screens?.length ?? 0} 页面 / 状态</small>}</div>
          <div className="toolbar-controls">
            <button onClick={() => void copyContext()}><Clipboard size={15} />ChatGPT Context</button>
            {view === 'modules' && selectedModule && <button onClick={() => void downloadModule()} disabled={busy}><Download size={15} />导出当前模块源码</button>}
            <button onClick={() => void loadProjects()} disabled={busy}><RefreshCw className={busy ? 'spin' : ''} size={15} />刷新</button>
            {view === 'screens' && reviewProfile && <label className="device-select"><Smartphone size={15} /><select aria-label="Review Profile" value={reviewProfile.id} onChange={(event) => setReviewProfileId(event.target.value)}>{reviewProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><ChevronDown size={13} /></label>}
            {view === 'screens' && selected && selectedStateIds.length > 1 && <label className="device-select"><Layers3 size={15} /><select aria-label="页面状态" value={activeStateId} onChange={(event) => setActiveStateId(event.target.value)}>{selected.states?.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select><ChevronDown size={13} /></label>}
            {view === 'screens' && <label className="device-select"><Layers3 size={15} /><select aria-label="Design lane" value={reviewLane} onChange={(event) => setReviewLane(event.target.value as ReviewCanvasLane)}><option value="artboard">Visual Artboard</option><option value="semantic">Semantic Preview</option></select><ChevronDown size={13} /></label>}
            {view === 'screens' && <label className="device-select"><Focus size={15} /><select aria-label="Review mode" value={reviewMode} onChange={(event) => setReviewMode(event.target.value as ReviewCanvasMode)}><option value="device">Device</option><option value="full-page">Full page</option><option value="fit">Fit</option></select><ChevronDown size={13} /></label>}
            {view === 'screens' && compatibleReferences.length > 0 && <label className="device-select"><Layers3 size={15} /><select aria-label="Visual reference" value={selectedReference?.id ?? ''} onChange={(event) => setSelectedReferenceId(event.target.value)}><option value="">No reference</option>{compatibleReferences.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select><ChevronDown size={13} /></label>}
            {view === 'screens' && <label><span>{reviewMode === 'fit' ? 'Auto' : `${Math.round(zoom * 100)}%`}</span><input aria-label="Review zoom" type="range" min="0.35" max="1.25" step="0.01" value={zoom} disabled={reviewMode === 'fit'} onChange={(event) => setZoom(Number(event.target.value))} /></label>}
          </div>
        </header>
        {notice && <div className={`notice ${notice.kind}`}>{notice.kind === 'success' ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}{notice.message}<button aria-label="关闭提示" onClick={() => setNotice(null)}>×</button></div>}
        {view === 'product' ? (
          <ProductWorkspace
            projectName={context.project.name}
            product={context.product}
            gate={context.goldenGate}
            editorText={editorText}
            onEditorChange={setEditorText}
            onSave={() => void saveEditor()}
            onReload={() => setEditorText(json(context.product ?? productScaffold(context)))}
            busy={busy}
          />
        ) : view === 'modules' && selectedModule ? (
          <div className="module-preview-workspace">
            <header className="module-preview-header">
              <div><span className="module-preview-eyebrow">UI CANDIDATE / SCREEN REVIEW</span><h1>{selectedModuleScreen?.name ?? selectedModule.name}</h1><p>{selectedModule.description}</p></div>
              <span className="module-review-tag">候选 · 未审定</span>
            </header>
            <div className="module-preview-toolbar">
              <div className="module-preview-breadcrumb"><span>{selectedModule.name}</span><span aria-hidden="true">/</span><strong>{selectedModuleScreen?.id ?? 'No screen'}</strong></div>
              <div className="module-preview-pagination">
                <button type="button" aria-pressed={modulePreviewScale === 0.72} aria-label="缩放至72%" onClick={() => setModulePreviewScale(0.72)}>72%</button>
                <button type="button" aria-pressed={modulePreviewScale === 1} onClick={() => setModulePreviewScale(1)}>100%</button>
                <span>{selectedModuleScreen && selectedModule.screens ? selectedModule.screens.findIndex(screen => screen.id === selectedModuleScreen.id) + 1 : 0} / {selectedModule.screens?.length ?? 0}</span>
                <button type="button" aria-label="上一页设计" disabled={!selectedModuleScreen || !selectedModule.screens || selectedModule.screens[0]?.id === selectedModuleScreen.id} onClick={() => { const pages = selectedModule.screens ?? []; const i = pages.findIndex(screen => screen.id === selectedModuleScreen?.id); if (i > 0) openModuleScreen(selectedModule, pages[i - 1].id); }}>‹</button>
                <button type="button" aria-label="下一页设计" disabled={!selectedModuleScreen || !selectedModule.screens || selectedModule.screens.at(-1)?.id === selectedModuleScreen.id} onClick={() => { const pages = selectedModule.screens ?? []; const i = pages.findIndex(screen => screen.id === selectedModuleScreen?.id); if (i >= 0 && i < pages.length - 1) openModuleScreen(selectedModule, pages[i + 1].id); }}>›</button>
              </div>
            </div>
            <div className="module-preview-stage">
              {selectedModule.preview && selectedModuleScreen ? (
                <div className="module-preview-scale-slot" style={{ width: 411 * modulePreviewScale, height: 870 * modulePreviewScale }}><div className="module-preview-device" style={{ transform: `scale(${modulePreviewScale})`, transformOrigin: 'top left' }}><iframe ref={modulePreviewFrame} key={modulePreviewUrl} title={selectedModuleScreen.name + ' · isolated prototype preview'} sandbox="allow-scripts" loading="lazy" referrerPolicy="no-referrer" src={modulePreviewUrl} /></div></div>
              ) : <p>此模块尚未绑定可预览页面，源码导出仍可使用。</p>}
            </div>
            <p className="module-preview-caption">预览来自项目仓库原型构建；此处不产生第二套设计 Authority。正式 Golden 与 SwiftUI 实现另行验收。</p>
          </div>
        ) : view === 'screens' && selected ? (
          <ReviewCanvas
            key={`${selected.id}-${activeStateId}-${reviewProfile?.id ?? 'default'}-${reviewLane}`}
            spec={resolvedSelected ?? selected}
            components={context.components}
            tokens={context.tokens}
            profile={reviewProfile}
            surfaceStyle={reviewProfile ? reviewSurfaceStyle(reviewProfile, context.tokens) : {}}
            zoom={zoom}
            mode={reviewMode}
            lane={reviewLane}
            artboard={selectedArtboard}
            artboardUrl={selectedArtboard ? visualAssetContentUrl(projectId, selectedArtboard.id) : null}
            artboardIssue={artboardIssue}
            reference={selectedReference}
            referenceUrl={selectedReference ? visualAssetContentUrl(projectId, selectedReference.id) : null}
          />
        ) : renderAssetWorkspace()}
      </section>

      <aside className="sidebar inspector">
        {view === 'product' ? (
          <>
            <div className="inspector-tabs single-tab"><button className="active">Product Gate</button></div>
            <section className="inspector-section"><div className="inspector-title"><Focus size={16} /><strong>User Job</strong></div><p>{context.product?.brief.userJob ?? 'Product Contract 尚未写入仓库。'}</p></section>
            <section className="inspector-section"><div className="inspector-title"><GitBranch size={16} /><strong>Legacy Product Golden</strong><span>{context.goldenGate.blockers.length}</span></div>{context.goldenGate.canApprove ? <div className="lint-success"><CheckCircle2 size={17} />Legacy Golden gate satisfied</div> : <div className="lint-list">{context.goldenGate.blockers.map((blocker) => <div key={blocker}><CircleAlert size={16} /><span>{blocker}</span></div>)}</div>}</section>
            <section className="inspector-section"><div className="inspector-title"><CheckCircle2 size={16} /><strong>Design Freeze</strong><span>{reviewStatus?.units.filter((unit) => unit.acceptanceCurrent).length ?? 0}/{reviewStatus?.units.length ?? 0}</span></div>{reviewStatus?.freezeCurrent ? <div className="lint-success"><CheckCircle2 size={17} />Current freeze · Phase D handoff allowed</div> : <div className="lint-list">{reviewStatus?.units.map((unit) => <div key={unit.unitId}>{unit.acceptanceCurrent ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}<span><strong>{unit.unitId}</strong><small>{unit.reviewStatus} · {unit.acceptance ? (unit.acceptanceCurrent ? 'accepted current' : 'acceptance stale') : 'not accepted'}</small></span></div>)}{reviewStatus?.freeze && !reviewStatus.freezeCurrent ? <div><CircleAlert size={16} /><span>Project freeze is stale after design changes.</span></div> : null}{!reviewStatus?.freeze ? <div><CircleAlert size={16} /><span>Project has not been frozen for implementation.</span></div> : null}</div>}</section>
            <section className="inspector-section"><div className="inspector-title"><FileCode2 size={16} /><strong>Review semantics</strong></div><p>Captured 只说明已有图片 artifact；必须实际进入模型视觉上下文才能标记 Model Visible，完成像素级审查后才能标记 Visual Reviewed。</p></section>
            {paths && <section className="inspector-section storage-panel"><div className="inspector-title"><GitBranch size={16} /><strong>事实源</strong><Check size={14} /></div><code>{paths.product}</code></section>}
          </>
        ) : view === 'modules' && selectedModule ? (
          <>
            <div className="inspector-tabs single-tab"><button className="active">审查与交接</button></div>
            <section className="inspector-section"><div className="inspector-title"><Focus size={16} /><strong>当前页面</strong></div><p><strong>{selectedModuleScreen?.name ?? '未绑定页面'}</strong></p><code>{selectedModuleScreen?.id ?? '—'}</code><p className="module-review-guidance">评审：信息层级、主操作、正常/空/异常态、动态字体、触控面积及跨页面语义一致性。当前画面不是正式视觉验收。</p></section>
            <section className="inspector-section"><div className="inspector-title"><FileCode2 size={16} /><strong>模块源码</strong></div><p>只导出本模块显式登记的文件，无需复制整个 App 或运行旧 Studio。</p><details className="module-source-files"><summary>查看 {selectedModule.files.length} 个源码与合同文件</summary><ul>{selectedModule.files.map((file) => <li key={file}><code>{file}</code></li>)}</ul></details></section>
            <section className="inspector-section"><button className="inspector-action" onClick={() => void downloadModule()} disabled={busy}><Download size={14} />导出 Markdown 交给 Gemini</button></section>
          </>
        ) : view === 'screens' ? (
          <>
            <div className="inspector-tabs">
              <button className={inspectorTab === 'inspect' ? 'active' : ''} onClick={() => setInspectorTab('inspect')}>Inspect</button>
              <button className={inspectorTab === 'spec' ? 'active' : ''} onClick={() => setInspectorTab('spec')}>Spec</button>
              <button className={inspectorTab === 'flow' ? 'active' : ''} onClick={() => setInspectorTab('flow')}>Flow</button>
            </div>
            {renderInspector()}
          </>
        ) : (
          <>
            <div className="inspector-tabs single-tab"><button className="active">Repository Asset</button></div>
            <section className="inspector-section"><div className="inspector-title"><GitBranch size={16} /><strong>存储规则</strong></div><p>编辑器保存的是目标仓库里的正式 JSON，不是浏览器缓存。</p>{paths && <code className="path-code">{view === 'tokens' ? paths.tokens : paths.components}</code>}</section>
            <section className="inspector-section"><div className="inspector-title"><Clipboard size={16} /><strong>ChatGPT 可读</strong></div><p>Context API 一次返回 Manifest、Token、组件契约和所有 Screen Spec。</p><button className="inspector-action" onClick={() => void copyContext()}><Clipboard size={14} />复制完整上下文</button></section>
            {view === 'components' && selectedComponent && <section className="inspector-section"><div className="inspector-title"><Component size={16} /><strong>{selectedComponent.name}</strong></div><p>{selectedComponent.purpose}</p><p><strong>Role</strong> · {selectedComponent.interactionRole ?? 'legacy'}</p><ul>{(selectedComponent.props?.map((prop) => `${prop.name} · ${prop.type}${prop.required ? ' · required' : ''}`) ?? selectedComponent.allowedProps ?? []).map((prop) => <li key={prop}>{prop}</li>)}</ul>{selectedComponent.variants?.length ? <p>Variants · {selectedComponent.variants.map((item) => item.id).join(', ')}</p> : null}{selectedComponent.states?.length ? <p>States · {selectedComponent.states.map((item) => item.id).join(', ')}</p> : null}</section>}
          </>
        )}
      </aside>
    </div>
  );
}
