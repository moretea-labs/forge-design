import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { ComponentContractsDocument, DesignReviewProfile, ScreenSpec, VisualAsset } from '../core/schema';
import { MockScreen } from './MockScreen';

export type ReviewCanvasMode = 'device' | 'full-page' | 'fit';
export type ReviewCanvasLane = 'artboard' | 'semantic';

type Props = {
  spec: ScreenSpec;
  components: ComponentContractsDocument;
  profile: DesignReviewProfile | null;
  surfaceStyle: CSSProperties;
  zoom: number;
  mode: ReviewCanvasMode;
  lane: ReviewCanvasLane;
  artboard: VisualAsset | null;
  artboardUrl: string | null;
  artboardIssue: string | null;
  reference: VisualAsset | null;
  referenceUrl: string | null;
};

const framePadding = 24;

export function calculateReviewFitScale(
  containerWidth: number,
  containerHeight: number,
  frameWidth: number,
  frameHeight: number,
  comparing: boolean,
): number {
  const columns = comparing ? 2 : 1;
  const horizontalGap = comparing ? 56 : 24;
  const availableWidth = Math.max(160, (containerWidth - horizontalGap) / columns);
  const availableHeight = Math.max(240, containerHeight - 72);
  return Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);
}

export function ReviewCanvas({
  spec,
  components,
  profile,
  surfaceStyle,
  zoom,
  mode,
  lane,
  artboard,
  artboardUrl,
  artboardIssue,
  reference,
  referenceUrl,
}: Props): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const screenWidth = profile?.viewport.width ?? 393;
  const screenHeight = profile?.viewport.height ?? 852;
  const frameWidth = screenWidth + framePadding;
  const frameHeight = screenHeight + framePadding;
  const comparing = Boolean(reference && referenceUrl);

  useEffect(() => {
    if (mode !== 'fit') return;
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const bounds = host.getBoundingClientRect();
      setFitScale(calculateReviewFitScale(bounds.width, bounds.height, frameWidth, frameHeight, comparing));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [comparing, frameHeight, frameWidth, mode]);

  const scale = mode === 'fit' ? fitScale : zoom;
  const modeLabel = mode === 'device'
    ? 'Device viewport · 内部滚动'
    : mode === 'full-page'
      ? 'Full page · 完整内容'
      : 'Fit · 自动适配';

  const semanticSurface = mode === 'full-page' ? (
    <div className="review-full-page-frame" style={{ ...surfaceStyle, width: frameWidth, height: 'auto', zoom: scale }}>
      <MockScreen spec={spec} components={components} fullPage />
    </div>
  ) : (
    <div className="review-scaled-frame" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
      <div
        className="device-frame review-device-frame"
        data-color-scheme={profile?.colorScheme}
        data-contrast={profile?.contrast}
        data-reduce-motion={profile?.reduceMotion ? 'true' : 'false'}
        style={{ ...surfaceStyle, transform: `scale(${scale})` }}
      >
        <div className="dynamic-island" />
        <MockScreen spec={spec} components={components} />
      </div>
    </div>
  );

  const artboardContent = artboard && artboardUrl ? (
    <img src={artboardUrl} alt={artboard.name} />
  ) : (
    <div className="review-artboard-empty" role="status">
      <strong>High-fidelity Artboard missing</strong>
      <span>{artboardIssue ?? 'No exact visual authority exists for this Screen / State / Review Profile.'}</span>
    </div>
  );

  const artboardSurface = mode === 'full-page' ? (
    <div className="review-artboard-full-page" style={{ width: screenWidth * scale, minHeight: screenHeight * scale }}>
      {artboardContent}
    </div>
  ) : (
    <div className="review-scaled-frame" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
      <div
        className="device-frame review-device-frame"
        data-color-scheme={profile?.colorScheme}
        data-contrast={profile?.contrast}
        data-reduce-motion={profile?.reduceMotion ? 'true' : 'false'}
        style={{ ...surfaceStyle, transform: `scale(${scale})` }}
      >
        <div className="dynamic-island" />
        <div className="artboard-viewport" style={{ width: screenWidth, height: screenHeight }}>
          {artboardContent}
        </div>
      </div>
    </div>
  );

  const currentSurface = lane === 'artboard' ? artboardSurface : semanticSurface;
  const referenceSurface = reference && referenceUrl ? (
    mode === 'full-page' ? (
      <div className="reference-full-page" style={{ width: screenWidth * scale }}>
        <img src={referenceUrl} alt={reference.name} style={{ width: '100%' }} />
      </div>
    ) : (
      <div className="review-scaled-frame" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
        <div className="reference-device-frame" style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}>
          <div className="reference-viewport" style={{ width: screenWidth, height: screenHeight }}>
            <img src={referenceUrl} alt={reference.name} />
          </div>
        </div>
      </div>
    )
  ) : null;

  const laneLabel = lane === 'artboard' ? 'Visual Artboard' : 'Semantic Preview';
  const authorityLabel = lane === 'artboard' ? 'Visual authority' : 'Non-authority';

  return (
    <div className="review-canvas" data-mode={mode} data-lane={lane} data-comparing={comparing ? 'true' : 'false'} ref={hostRef}>
      <div className="review-columns">
        <section className="review-column">
          <div className="review-column-label"><strong>{spec.name} · {laneLabel}</strong><span>{authorityLabel} · {modeLabel} · {Math.round(scale * 100)}%</span></div>
          <div className="review-surface-slot">{currentSurface}</div>
        </section>
        {referenceSurface && reference ? (
          <section className="review-column reference-column">
            <div className="review-column-label"><strong>{reference.name}</strong><span>Reference · {reference.provenance.kind}</span></div>
            <div className="review-surface-slot">{referenceSurface}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
