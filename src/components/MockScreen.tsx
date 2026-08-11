import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { CheckCircle2, ChevronRight, Minus, Play, Plus, Settings2, Square } from 'lucide-react';
import type { ScreenNode, ScreenSpec } from '../core/schema';

const stringProp = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const numberProp = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

function ScreenHeaderNode({ node }: { node: ScreenNode }): ReactElement {
  const eyebrow = stringProp(node.props?.eyebrow);
  const title = stringProp(node.props?.title, 'Untitled screen');
  const actionLabel = stringProp(node.props?.actionLabel);
  return (
    <header className="screen-header">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>
      {actionLabel && <button className="icon-button" aria-label={actionLabel}><Settings2 size={19} /></button>}
    </header>
  );
}

function BPMControllerNode({ node, bpm, setBpm }: { node: ScreenNode; bpm: number; setBpm: (value: number) => void }): ReactElement {
  const min = numberProp(node.props?.min, 30);
  const max = numberProp(node.props?.max, 220);
  const tempoLabel = useMemo(() => {
    if (bpm < 60) return '舒缓';
    if (bpm < 90) return '稳定';
    if (bpm < 130) return '有活力';
    return '快速';
  }, [bpm]);
  const adjust = (amount: number) => setBpm(Math.max(min, Math.min(max, bpm + amount)));
  return (
    <section className="tempo-card">
      <div className="tempo-meta"><span>{tempoLabel}</span><span>4/4 · 单拍</span></div>
      <div className="tempo-value"><strong>{bpm}</strong><span>BPM</span></div>
      <div className="tempo-controls">
        <button onClick={() => adjust(-5)}><Minus size={16} />5</button>
        <button onClick={() => adjust(-1)}><Minus size={16} />1</button>
        <button onClick={() => adjust(1)}><Plus size={16} />1</button>
        <button onClick={() => adjust(5)}><Plus size={16} />5</button>
      </div>
      <input aria-label="BPM" type="range" min={min} max={max} value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
    </section>
  );
}

function BeatTrajectoryNode({ node, running, beat, setBeat }: { node: ScreenNode; running: boolean; beat: number; setBeat: (value: number) => void }): ReactElement {
  const beats = numberProp(node.props?.beats, 4);
  return (
    <section className="trajectory-card">
      <div className="section-title"><div><span className="eyebrow">单拍轨迹</span><h2>感知开始、中点与结束</h2></div><span className="beat-count">{beat + 1}/{beats}</span></div>
      <button className={`trajectory ${running ? 'is-running' : ''}`} onClick={() => setBeat((beat + 1) % beats)} aria-label="推进一拍">
        <span className="rail" /><span className="rail-dot start" /><span className="rail-dot middle" /><span className="rail-dot end" /><span className="moving-dot" />
      </button>
      <div className="measure-dots">{Array.from({ length: beats }, (_, item) => <span key={item} className={item === beat ? 'active' : ''}>{item + 1}</span>)}</div>
    </section>
  );
}

function PracticeSummaryNode({ node }: { node: ScreenNode }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <button className={`summary-row ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded((value) => !value)}>
      <div><span className="eyebrow">本周节奏</span><strong>{stringProp(node.props?.duration, '0 分钟')}</strong></div>
      <div className="summary-divider" />
      <div><span className="eyebrow">连续练习</span><strong>{stringProp(node.props?.streak, '0 天')}</strong></div>
      <ChevronRight className="summary-chevron" size={18} />
      {expanded && <span className="summary-detail">示例交互状态 · 真实产品可替换为自己的 renderer</span>}
    </button>
  );
}

function EmptyStateNode({ node }: { node: ScreenNode }): ReactElement {
  return <div className="empty-placeholder"><span>+</span><h2>{stringProp(node.props?.title, '空白页面')}</h2><p>{stringProp(node.props?.body, '添加受控组件以构建页面。')}</p></div>;
}

function PrimaryActionNode({ node, running, setRunning }: { node: ScreenNode; running: boolean; setRunning: (value: boolean) => void }): ReactElement {
  const label = stringProp(node.props?.label, '继续');
  const activeLabel = stringProp(node.props?.activeLabel, label);
  return (
    <button className={`primary-action ${running ? 'active' : ''}`} onClick={() => setRunning(!running)}>
      {running ? <Square size={18} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      {running ? activeLabel : label}
    </button>
  );
}

function UnknownNode({ node }: { node: ScreenNode }): ReactElement {
  return <section className="empty-placeholder"><CheckCircle2 size={18} /><h2>{node.component}</h2><p>该组件已有契约，但公开示例 renderer 未实现专用视觉。业务产品可提供自己的渲染适配器。</p></section>;
}

export function MockScreen({ spec }: { spec: ScreenSpec; onNavigateScreen?: (screenId: string) => void }): ReactElement {
  const initialBpm = spec.nodes.find((node) => node.component === 'BPMController');
  const [bpm, setBpm] = useState(numberProp(initialBpm?.props?.initialBpm, 72));
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    setBpm(numberProp(initialBpm?.props?.initialBpm, 72));
    setRunning(false);
    setBeat(0);
  }, [spec.id, initialBpm?.props?.initialBpm]);

  return (
    <main className="mock-screen">
      {spec.nodes.map((node) => {
        if (node.component === 'ScreenHeader') return <ScreenHeaderNode key={node.id} node={node} />;
        if (node.component === 'BPMController') return <BPMControllerNode key={node.id} node={node} bpm={bpm} setBpm={setBpm} />;
        if (node.component === 'BeatTrajectory') return <BeatTrajectoryNode key={node.id} node={node} running={running} beat={beat} setBeat={setBeat} />;
        if (node.component === 'PracticeSummary') return <PracticeSummaryNode key={node.id} node={node} />;
        if (node.component === 'EmptyState') return <EmptyStateNode key={node.id} node={node} />;
        if (node.component === 'PrimaryAction') return <PrimaryActionNode key={node.id} node={node} running={running} setRunning={setRunning} />;
        return <UnknownNode key={node.id} node={node} />;
      })}
    </main>
  );
}
