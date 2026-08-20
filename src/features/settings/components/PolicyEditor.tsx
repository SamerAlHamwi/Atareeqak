import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PolicyDocument, PolicySection } from '../hooks/useSettings';

interface PolicyEditorProps {
  policy: PolicyDocument;
  isSaving: boolean;
  onSave: (lastUpdatedLabel: string, sections: PolicySection[]) => void;
}

const emptySection: PolicySection = { title: '', intro: '', points: [] };

/**
 * Edits one policy document's ordered list of sections (title/intro/points).
 * Kept remounted per tab (`key={type}` at the call site) so switching tabs or
 * a successful save always starts from the latest server state rather than
 * carrying stale local edits across.
 */
export const PolicyEditor: React.FC<PolicyEditorProps> = ({ policy, isSaving, onSave }) => {
  const { t } = useTranslation();
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState(policy.lastUpdatedLabel);
  const [sections, setSections] = useState<PolicySection[]>(policy.sections);

  const updateSection = (index: number, patch: Partial<PolicySection>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const updatePoint = (sectionIndex: number, pointIndex: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, points: s.points.map((p, pi) => (pi === pointIndex ? value : p)) } : s
      )
    );
  };

  const addPoint = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIndex ? { ...s, points: [...s.points, ''] } : s))
    );
  };

  const removePoint = (sectionIndex: number, pointIndex: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, points: s.points.filter((_, pi) => pi !== pointIndex) } : s
      )
    );
  };

  const addSection = () => setSections((prev) => [...prev, { ...emptySection }]);
  const removeSection = (index: number) => setSections((prev) => prev.filter((_, i) => i !== index));
  const moveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const isValid = sections.length > 0 && sections.every((s) => s.title.trim() !== '');

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
          {t('settings.last_updated_label')}
        </label>
        <input
          data-testid="policy-last-updated"
          type="text"
          value={lastUpdatedLabel}
          onChange={(e) => setLastUpdatedLabel(e.target.value)}
          placeholder={t('settings.last_updated_placeholder')}
          className="w-full max-w-xs bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            data-testid="policy-section"
            className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex items-start gap-3">
              <input
                data-testid={`policy-section-title-${sectionIndex}`}
                type="text"
                value={section.title}
                onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                placeholder={t('settings.section_title_placeholder')}
                className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-primary/30"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveSection(sectionIndex, -1)}
                  disabled={sectionIndex === 0}
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  title={t('settings.move_up')}
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sectionIndex, 1)}
                  disabled={sectionIndex === sections.length - 1}
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  title={t('settings.move_down')}
                >
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                </button>
                <button
                  type="button"
                  data-testid={`policy-section-remove-${sectionIndex}`}
                  onClick={() => removeSection(sectionIndex)}
                  className="p-2 rounded-lg text-error hover:bg-error-container/20"
                  title={t('settings.remove_section')}
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>

            <textarea
              data-testid={`policy-section-intro-${sectionIndex}`}
              value={section.intro}
              onChange={(e) => updateSection(sectionIndex, { intro: e.target.value })}
              placeholder={t('settings.section_intro_placeholder')}
              rows={2}
              className="w-full bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-primary/30 resize-y"
            />

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {t('settings.points_label')}
              </p>
              {section.points.map((point, pointIndex) => (
                <div key={pointIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => updatePoint(sectionIndex, pointIndex, e.target.value)}
                    className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => removePoint(sectionIndex, pointIndex)}
                    className="p-1.5 rounded-lg text-error hover:bg-error-container/20"
                    title={t('settings.remove_point')}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addPoint(sectionIndex)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {t('settings.add_point')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="policy-add-section"
          onClick={addSection}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          {t('settings.add_section')}
        </button>

        <button
          type="button"
          data-testid="policy-save"
          onClick={() => onSave(lastUpdatedLabel, sections)}
          disabled={!isValid || isSaving}
          className="bg-primary text-on-primary py-3 px-8 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
        >
          {isSaving ? t('common.loading') : t('settings.save_policy')}
        </button>
      </div>
    </div>
  );
};
