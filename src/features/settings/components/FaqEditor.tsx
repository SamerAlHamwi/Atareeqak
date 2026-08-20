import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FaqDocument, FaqEntry, FaqGroup } from '../hooks/useSettings';

interface FaqEditorProps {
  faq: FaqDocument;
  isSaving: boolean;
  onSave: (groups: FaqGroup[]) => void;
}

const emptyEntry: FaqEntry = { question: '', answer: '' };
const emptyGroup: FaqGroup = { title: '', icon: 'quiz_outlined', entries: [] };

/**
 * Edits the FAQ groups (title/icon + an ordered list of question/answer
 * entries). Remounted per tab switch or successful save via `key` at the
 * call site, same as `PolicyEditor`.
 */
export const FaqEditor: React.FC<FaqEditorProps> = ({ faq, isSaving, onSave }) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<FaqGroup[]>(faq.groups);

  const updateGroup = (index: number, patch: Partial<FaqGroup>) => {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const updateEntry = (groupIndex: number, entryIndex: number, patch: Partial<FaqEntry>) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, entries: g.entries.map((e, ei) => (ei === entryIndex ? { ...e, ...patch } : e)) }
          : g
      )
    );
  };

  const addEntry = (groupIndex: number) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === groupIndex ? { ...g, entries: [...g.entries, { ...emptyEntry }] } : g))
    );
  };

  const removeEntry = (groupIndex: number, entryIndex: number) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex ? { ...g, entries: g.entries.filter((_, ei) => ei !== entryIndex) } : g
      )
    );
  };

  const addGroup = () => setGroups((prev) => [...prev, { ...emptyGroup, entries: [] }]);
  const removeGroup = (index: number) => setGroups((prev) => prev.filter((_, i) => i !== index));
  const moveGroup = (index: number, direction: -1 | 1) => {
    setGroups((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const isValid =
    groups.length > 0 &&
    groups.every(
      (g) =>
        g.title.trim() !== '' &&
        g.icon.trim() !== '' &&
        g.entries.length > 0 &&
        g.entries.every((e) => e.question.trim() !== '' && e.answer.trim() !== '')
    );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {groups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            data-testid="faq-group"
            className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant space-y-4"
          >
            <div className="flex items-start gap-3">
              <input
                data-testid={`faq-group-title-${groupIndex}`}
                type="text"
                value={group.title}
                onChange={(e) => updateGroup(groupIndex, { title: e.target.value })}
                placeholder={t('settings.faq_group_title_placeholder')}
                className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-bold px-4 py-3 focus:ring-2 focus:ring-primary/30"
              />
              <input
                data-testid={`faq-group-icon-${groupIndex}`}
                type="text"
                value={group.icon}
                onChange={(e) => updateGroup(groupIndex, { icon: e.target.value })}
                placeholder={t('settings.faq_group_icon_placeholder')}
                className="w-40 bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 focus:ring-2 focus:ring-primary/30"
                dir="ltr"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveGroup(groupIndex, -1)}
                  disabled={groupIndex === 0}
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  title={t('settings.move_up')}
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveGroup(groupIndex, 1)}
                  disabled={groupIndex === groups.length - 1}
                  className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                  title={t('settings.move_down')}
                >
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                </button>
                <button
                  type="button"
                  data-testid={`faq-group-remove-${groupIndex}`}
                  onClick={() => removeGroup(groupIndex)}
                  className="p-2 rounded-lg text-error hover:bg-error-container/20"
                  title={t('settings.remove_group')}
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {t('settings.faq_entries_label')}
              </p>
              {group.entries.map((entry, entryIndex) => (
                <div
                  key={entryIndex}
                  className="bg-surface-container-low rounded-2xl p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry.question}
                      onChange={(e) => updateEntry(groupIndex, entryIndex, { question: e.target.value })}
                      placeholder={t('settings.faq_question_placeholder')}
                      className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm font-semibold px-4 py-2.5 focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeEntry(groupIndex, entryIndex)}
                      className="p-1.5 rounded-lg text-error hover:bg-error-container/20 shrink-0"
                      title={t('settings.remove_entry')}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <textarea
                    value={entry.answer}
                    onChange={(e) => updateEntry(groupIndex, entryIndex, { answer: e.target.value })}
                    placeholder={t('settings.faq_answer_placeholder')}
                    rows={2}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => addEntry(groupIndex)}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {t('settings.add_entry')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          data-testid="faq-add-group"
          onClick={addGroup}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          {t('settings.add_group')}
        </button>

        <button
          type="button"
          data-testid="faq-save"
          onClick={() => onSave(groups)}
          disabled={!isValid || isSaving}
          className="bg-primary text-on-primary py-3 px-8 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
        >
          {isSaving ? t('common.loading') : t('settings.save_faq')}
        </button>
      </div>
    </div>
  );
};
