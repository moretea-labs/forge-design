import { CheckCircle2, CircleAlert, FileCode2, GitBranch, Layers3, LoaderCircle, RefreshCw, Save } from 'lucide-react';
import type { ProductDesignModel, ProductGoldenGate } from '../core/schema';

type Props = {
  projectName: string;
  product: ProductDesignModel | null;
  gate: ProductGoldenGate;
  editorText: string;
  onEditorChange: (value: string) => void;
  onSave: () => void;
  onReload: () => void;
  busy: boolean;
};

const stageLabel: Record<ProductGoldenGate['runtimeReviewStage'], string> = {
  not_started: 'Not started',
  captured: 'Captured',
  model_visible: 'Model Visible',
  visual_reviewed: 'Visual Reviewed',
};

function GateFlag({ ok, label }: { ok: boolean; label: string }) {
  return <div className={ok ? 'gate-flag ready' : 'gate-flag'}>{ok ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}<span>{label}</span></div>;
}

export function ProductWorkspace({ projectName, product, gate, editorText, onEditorChange, onSave, onReload, busy }: Props) {
  const brief = product?.brief;
  const review = product?.golden.review;
  return (
    <div className="product-workspace">
      <div className="product-hero">
        <div>
          <span className="workspace-eyebrow">{projectName} · Product Contract</span>
          <h1>{brief?.userJob ?? '先定义 User Job，再设计 Screen'}</h1>
          <p>{brief?.productGoal ?? '这个项目目前只有视觉资产。保存 Product Contract 后，Flow、Interaction Pattern 和 Golden Gate 才成为可审查事实。'}</p>
        </div>
        <div className={`golden-status status-${gate.status}`}>
          <span>Golden</span><strong>{gate.status}</strong>
        </div>
      </div>

      <div className="workflow-lane" aria-label="Product design workflow">
        {['User Job', 'Flow', 'Information / State', 'Interaction', 'Screen Family', 'Visual', 'Runtime Review', 'Golden'].map((label, index) => (
          <div key={label}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>
        ))}
      </div>

      <div className="product-summary-grid">
        <section className="product-panel product-panel-wide">
          <div className="product-panel-title"><Layers3 size={16} /><strong>Product Brief</strong></div>
          <div className="brief-grid">
            <div><span>Primary tasks</span><strong>{brief?.primaryTasks.join(' · ') || '待定义'}</strong></div>
            <div><span>Screen family</span><strong>{brief?.screenFamily || '未分类'}</strong></div>
            <div><span>Information roles</span><strong>{brief?.informationHierarchy.length ?? 0}</strong></div>
            <div><span>State / Interaction</span><strong>{brief ? `${brief.stateModel.length} / ${brief.interactionModel.length}` : '0 / 0'}</strong></div>
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-title"><GitBranch size={16} /><strong>Flows</strong><span>{product?.flows.length ?? 0}</span></div>
          <div className="product-list">
            {(product?.flows ?? []).map((flow) => <div key={flow.id}><span><strong>{flow.name}</strong><small>{flow.screenIds.join(' → ') || 'no screens'}</small></span><em>{flow.status}</em></div>)}
            {!product?.flows.length && <p>完整产品链路尚未建模。</p>}
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-title"><Layers3 size={16} /><strong>Interaction Patterns</strong><span>{product?.patterns.length ?? 0}</span></div>
          <div className="product-list">
            {(product?.patterns ?? []).map((pattern) => <div key={pattern.id}><span><strong>{pattern.name}</strong><small>{pattern.semanticPurpose}</small></span><em>{pattern.status}</em></div>)}
            {!product?.patterns.length && <p>先验证局部交互，不要提前抽象 Design System Pattern。</p>}
          </div>
        </section>

        <section className="product-panel product-panel-wide">
          <div className="product-panel-title"><CheckCircle2 size={16} /><strong>Golden Gate</strong><span>{gate.canApprove ? 'Ready' : 'Blocked'}</span></div>
          <div className="gate-grid">
            <GateFlag ok={gate.productContractReady} label="Product Contract" />
            <GateFlag ok={gate.flowReady} label="Validated Flow" />
            <GateFlag ok={gate.interactionPatternsReady} label="Pattern / sibling evidence" />
            <GateFlag ok={gate.runtimeEvidenceReady} label="Runtime evidence" />
            <GateFlag ok={gate.runtimeReviewStage === 'visual_reviewed'} label={`Review · ${stageLabel[gate.runtimeReviewStage]}`} />
            <GateFlag ok={gate.userDecision === 'accepted'} label={`User · ${gate.userDecision}`} />
          </div>
          {gate.blockers.length > 0 && <div className="gate-blockers">{gate.blockers.map((blocker) => <p key={blocker}><CircleAlert size={14} />{blocker}</p>)}</div>}
          {review && <div className="review-sequence"><span>Captured</span><b>→</b><span>Model Visible</span><b>→</b><span>Visual Reviewed</span><b>→</b><span>User Accepted</span></div>}
        </section>
      </div>

      <section className="product-json-section">
        <div className="product-panel-title"><FileCode2 size={16} /><strong>Canonical product.json</strong><span>.design-harness</span></div>
        <textarea aria-label="Product JSON editor" spellCheck={false} value={editorText} onChange={(event) => onEditorChange(event.target.value)} />
        <div className="editor-actions">
          <button onClick={onReload} disabled={busy}><RefreshCw size={14} />重新读取</button>
          <button className="save-button" onClick={onSave} disabled={busy}>{busy ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}保存 Product Contract</button>
        </div>
      </section>
    </div>
  );
}
