import { Button } from '#/components/ui/button';
import { Input } from '#/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import {
  getSemanticRulesFn,
  type SemanticRule,
  type SemanticTag,
  SEMANTIC_TAGS,
  setSemanticRulesFn,
} from '#/lib/server/semantics-store';
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const RULE_TYPES = [
  { value: 'shape-id', label: 'this shape' },
  { value: 'name-equals', label: 'name equals' },
  { value: 'name-contains', label: 'name contains' },
] as const;

const semanticRulesOptions = (fileId: string) =>
  queryOptions({
    queryKey: ['semantic-rules', fileId],
    queryFn: () => getSemanticRulesFn({ data: { fileId } }),
    staleTime: Infinity,
  });

function newId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function SemanticRules({
  fileId,
  selectedShapeId,
  selectedShapeName,
}: {
  fileId: string;
  selectedShapeId: string;
  selectedShapeName: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery(semanticRulesOptions(fileId));
  const rules = data?.rules ?? [];

  const saveMutation = useMutation({
    mutationFn: (next: SemanticRule[]) =>
      setSemanticRulesFn({ data: { fileId, rules: next } }),
    onSuccess: ({ rules: saved }) => {
      queryClient.setQueryData(['semantic-rules', fileId], { rules: saved });
      // Rules drive code generation, so invalidate every cached output for
      // any shape in this file — the next read regenerates with the new rules.
      void queryClient.invalidateQueries({ queryKey: ['shape-code', fileId] });
    },
  });

  const persist = (next: SemanticRule[]) => saveMutation.mutate(next);

  const handleQuickTag = (tag: SemanticTag) => {
    // Replace any existing shape-id rule for this shape; otherwise prepend.
    const filtered = rules.filter(
      (r) => !(r.type === 'shape-id' && r.value === selectedShapeId),
    );
    persist([
      {
        id: newId(),
        type: 'shape-id',
        value: selectedShapeId,
        tag,
        enabled: true,
      },
      ...filtered,
    ]);
  };

  const handleToggle = (id: string, enabled: boolean) => {
    persist(rules.map((r) => (r.id === id ? { ...r, enabled } : r)));
  };

  const handleDelete = (id: string) => {
    persist(rules.filter((r) => r.id !== id));
  };

  const handleAdd = (rule: Omit<SemanticRule, 'id'>) => {
    persist([...rules, { ...rule, id: newId() }]);
  };

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-600 uppercase transition-colors hover:text-gray-900"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Semantic rules
        <span className="font-mono text-[10px] tracking-normal text-gray-400 normal-case">
          ({rules.length})
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
          <QuickTagShape
            name={selectedShapeName}
            onTag={handleQuickTag}
            disabled={saveMutation.isPending}
          />

          {rules.length > 0 && (
            <ul className="flex flex-col gap-1">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  selectedShapeId={selectedShapeId}
                  onToggle={(enabled) => handleToggle(rule.id, enabled)}
                  onDelete={() => handleDelete(rule.id)}
                />
              ))}
            </ul>
          )}

          <AddRuleForm onAdd={handleAdd} disabled={saveMutation.isPending} />

          {saveMutation.isError && (
            <p className="text-xs text-destructive">Failed to save rules.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuickTagShape({
  name,
  onTag,
  disabled,
}: {
  name: string;
  onTag: (tag: SemanticTag) => void;
  disabled: boolean;
}) {
  const [tag, setTag] = useState<SemanticTag>('button');
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">
        Tag <span className="font-medium text-gray-800">{name}</span> as
      </span>
      <TagSelect value={tag} onChange={setTag} />
      <Button
        size="xs"
        variant="outline"
        onClick={() => onTag(tag)}
        disabled={disabled}
      >
        Apply
      </Button>
    </div>
  );
}

function RuleRow({
  rule,
  selectedShapeId,
  onToggle,
  onDelete,
}: {
  rule: SemanticRule;
  selectedShapeId: string;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const isCurrentShape = rule.type === 'shape-id' && rule.value === selectedShapeId;
  const typeLabel = RULE_TYPES.find((t) => t.value === rule.type)?.label ?? rule.type;
  // For shape-id rules, the raw UUID isn't useful — show a shortened id and
  // mark "(this shape)" when it's the current selection.
  const displayValue =
    rule.type === 'shape-id'
      ? isCurrentShape
        ? '(this shape)'
        : `${rule.value.slice(0, 8)}…`
      : `"${rule.value}"`;

  return (
    <li className="flex items-center gap-2 rounded bg-white px-2 py-1.5 text-xs ring-1 ring-gray-200">
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-3 w-3 cursor-pointer"
        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
      />
      <span className="font-mono text-[10px] text-gray-500">{typeLabel}</span>
      <span
        className={`flex-1 truncate ${rule.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}
        title={rule.value}
      >
        {displayValue}
      </span>
      <span className="font-mono text-[10px] text-gray-400">→</span>
      <span
        className={`rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-violet-700 ${rule.enabled ? '' : 'opacity-50'}`}
      >
        &lt;{rule.tag}&gt;
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-destructive"
        title="Delete rule"
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}

function AddRuleForm({
  onAdd,
  disabled,
}: {
  onAdd: (rule: Omit<SemanticRule, 'id'>) => void;
  disabled: boolean;
}) {
  const [type, setType] = useState<SemanticRule['type']>('name-contains');
  const [value, setValue] = useState('');
  const [tag, setTag] = useState<SemanticTag>('button');

  // `shape-id` is created via the quick-tag action on the selected shape.
  // It doesn't make sense in this generic form (no UUID input), so hide it.
  const formTypes = RULE_TYPES.filter((t) => t.value !== 'shape-id');

  const trimmed = value.trim();
  const canAdd = trimmed.length > 0 && !disabled;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ type, value: trimmed, tag, enabled: true });
    setValue('');
  };

  return (
    <div className="flex items-center gap-1.5 rounded border border-dashed border-gray-300 bg-white p-1.5">
      <Select value={type} onValueChange={(v) => setType(v as SemanticRule['type'])}>
        <SelectTrigger size="sm" className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {formTypes.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
        }}
        placeholder="value"
        className="h-7 flex-1 text-xs"
      />
      <span className="text-xs text-gray-400">→</span>
      <TagSelect value={tag} onChange={setTag} />
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={handleAdd}
        disabled={!canAdd}
        title="Add rule"
      >
        <Plus />
      </Button>
    </div>
  );
}

function TagSelect({
  value,
  onChange,
}: {
  value: SemanticTag;
  onChange: (v: SemanticTag) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SemanticTag)}>
      <SelectTrigger size="sm" className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SEMANTIC_TAGS.map((t) => (
          <SelectItem key={t} value={t}>
            &lt;{t}&gt;
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
