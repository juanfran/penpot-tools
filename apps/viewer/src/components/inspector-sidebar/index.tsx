import { getPageShapesOptions } from '#/components/render';
import { findNodeById } from '#/components/render/tree-utils';
import { type ShapeTreeNode } from '#/lib/server/penpot-api';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AssetItem } from './asset-item';
import { type Asset, buildNodeIndex, collectAssetsFromDom } from './assets';
import { EMPTY_MARGINS, type Margins, computeMargins, extractBoxModel } from './box-model';
import { BoxModelViz } from './box-model-viz';
import { COLOR_FORMATS, UNIT_FORMATS, transformValue } from './format-prefs';
import { useInspectorPrefs } from './prefs-store';
import { Segmented } from './segmented';
import { shapeIcon } from './shape-icon';
import { StyleDecl } from './style-decl';
import { extractStyles, extractText, groupStyles } from './styles';

// Returns the top-level tree node that contains (or is) the given id
function findRootContaining(roots: ShapeTreeNode[], id: string): ShapeTreeNode | null {
  for (const root of roots) {
    if (root.id === id || findNodeById(root.children, id)) return root;
  }
  return null;
}

export function InspectorSidebar({
  fileId,
  pageId,
  selectedShapeId,
}: {
  fileId: string;
  pageId: string;
  selectedShapeId: string;
}) {
  const { data } = useSuspenseQuery(getPageShapesOptions(fileId, pageId));
  const [copied, setCopied] = useState<'css' | 'text' | null>(null);
  const [margins, setMargins] = useState<Margins>(EMPTY_MARGINS);
  const colorFormat = useInspectorPrefs((s) => s.colorFormat);
  const setColorFormat = useInspectorPrefs((s) => s.setColorFormat);
  const unitFormat = useInspectorPrefs((s) => s.unitFormat);
  const setUnitFormat = useInspectorPrefs((s) => s.setUnitFormat);

  const nodeIndex = useMemo(() => buildNodeIndex(data.tree), [data.tree]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);

  const node = findNodeById(data.tree, selectedShapeId);
  const rootNode = findRootContaining(data.tree, selectedShapeId);
  const rootShape = data.shapes.find((s) => s.id === rootNode?.id);

  useEffect(() => {
    // Wait one frame so the selected shape and its siblings are laid out.
    const raf = requestAnimationFrame(() => setMargins(computeMargins(selectedShapeId)));
    return () => cancelAnimationFrame(raf);
  }, [selectedShapeId, data]);

  const handleToggleAssets = () => {
    if (!assetsOpen) setAssets(collectAssetsFromDom(selectedShapeId, nodeIndex));
    setAssetsOpen((o) => !o);
  };

  if (!node || !rootShape) return null;

  const rawDecls = extractStyles(rootShape.html, selectedShapeId);
  const decls = rawDecls.map(({ prop, value }) => ({
    prop,
    value: transformValue(value, colorFormat, unitFormat),
  }));
  const sections = groupStyles(decls);
  const cssText = decls.map(({ prop, value }) => `${prop}: ${value};`).join('\n');
  const boxModel = extractBoxModel(rootShape.html, selectedShapeId, node.width, node.height);
  const textContent = node.type === 'text' ? extractText(rootShape.html, selectedShapeId) : null;

  const handleCopy = (kind: 'css' | 'text', value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <aside className="flex w-80 flex-col border-l border-gray-200 bg-white">
      {/* Shape header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          {shapeIcon(node.type)}
          <span className="text-xs font-medium text-gray-400">{node.type}</span>
        </div>
        <h2 className="truncate text-sm font-semibold text-gray-900" title={node.name}>
          {node.name}
        </h2>
      </div>

      {/* Styles */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <BoxModelViz model={boxModel} margins={margins} />

        {textContent !== null && (
          <div className="border-t border-gray-100 px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Text
              </span>
              <button
                onClick={() => handleCopy('text', textContent)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Copy text"
              >
                {copied === 'text' ? <Check size={11} /> : <Copy size={11} />}
                <span>{copied === 'text' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <p className="max-h-40 overflow-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs break-words whitespace-pre-wrap text-gray-800">
              {textContent || <span className="text-gray-400">Empty</span>}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Styles
            </span>
            {decls.length > 0 && (
              <button
                onClick={() => handleCopy('css', cssText)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Copy all styles"
              >
                {copied === 'css' ? <Check size={11} /> : <Copy size={11} />}
                <span>{copied === 'css' ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2">
            <Segmented
              label="Color"
              value={colorFormat}
              onChange={setColorFormat}
              options={COLOR_FORMATS}
            />
            <Segmented
              label="Unit"
              value={unitFormat}
              onChange={setUnitFormat}
              options={UNIT_FORMATS}
            />
          </div>

          {decls.length === 0 ? (
            <p className="px-4 py-2 text-xs text-gray-400">No styles</p>
          ) : (
            <div className="space-y-3 px-4 pb-4">
              {sections.map((section) => (
                <div key={section.label}>
                  <p className="mb-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    {section.label}
                  </p>
                  <div className="rounded-md bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed">
                    {section.decls.map((d) => (
                      <StyleDecl key={d.prop} prop={d.prop} value={d.value} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={handleToggleAssets}
            className="flex w-full items-center gap-1 px-4 pt-3 pb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase transition-colors hover:text-gray-700"
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${assetsOpen ? 'rotate-90' : ''}`}
            />
            Assets
            {assetsOpen && (
              <span className="ml-auto font-mono text-[10px] tracking-normal text-gray-400 normal-case">
                {assets.length}
              </span>
            )}
          </button>
          {assetsOpen && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              {assets.length === 0 ? (
                <p className="text-xs text-gray-400">No assets</p>
              ) : (
                assets.map((a) => <AssetItem key={a.id} asset={a} />)
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
