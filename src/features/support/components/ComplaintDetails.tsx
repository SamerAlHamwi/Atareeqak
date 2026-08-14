import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Complaint } from '../hooks/useSupport';
import Avatar from '../../shared/components/Avatar';
import ComplaintAttachments from './ComplaintAttachments';
import PageLoader from '../../shared/components/PageLoader';

interface ComplaintDetailsProps {
  complaint: Complaint | null;
  /** True while `GET /staff/complaints/{id}` is in flight — that call mutates. */
  isOpening: boolean;
  onRespond: () => void;
  onEscalate: () => void;
  onResolveEscalated: () => void;
  isBusy: (key: string) => boolean;
  mode: 'inbox' | 'escalated';
}

export const ComplaintDetails: React.FC<ComplaintDetailsProps> = ({
  complaint,
  isOpening,
  onRespond,
  onEscalate,
  onResolveEscalated,
  isBusy,
  mode,
}) => {
  const { t } = useTranslation();

  if (!complaint) {
    return (
      <div
        data-testid="complaint-select-hint"
        className="lg:col-span-4 flex items-center justify-center p-12 text-center text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/10 min-h-[280px]"
      >
        {t('support.select_hint')}
      </div>
    );
  }

  /**
   * Hide-not-422, per the Phase 3 convention. The server mirrors these exactly:
   *   • `respond`  → `ComplaintStatus::isAgentActionable()` → pending | in_review
   *   • `escalate` → same gate, plus "already escalated" is rejected outright
   *   • escalated `resolve` → only from `escalated`
   * Showing a button for a state the service throws a DomainException on would
   * be a guaranteed 422, so the button simply is not rendered.
   */
  const isAgentActionable = complaint.status === 'pending' || complaint.status === 'in_review';
  const canRespond = mode === 'inbox' && isAgentActionable;
  const canEscalate = mode === 'inbox' && isAgentActionable;
  const canResolveEscalated = mode === 'escalated' && complaint.status === 'escalated';
  const hasNoActions = !canRespond && !canEscalate && !canResolveEscalated;

  return (
    <div className="lg:col-span-4 space-y-6 sticky top-24">
      <div
        data-testid="complaint-detail"
        className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden"
      >
        <div className="p-6 bg-primary text-on-primary">
          <div className="flex justify-between items-start mb-4 gap-3">
            <div className="text-start">
              <p className="text-[10px] opacity-70 mb-1">{t('support.details_title')}</p>
              <h4 className="text-lg font-bold" data-testid="complaint-detail-id">
                {complaint.id.replace('#', '')}
              </h4>
            </div>
            <span
              data-testid="complaint-detail-status"
              className="bg-white/20 text-[10px] px-3 py-1 rounded-full text-on-primary font-bold shrink-0"
            >
              {t(`common.status.${complaint.status}`)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar
              name={complaint.user}
              photo={complaint.userPhoto}
              size="md"
              className="border-2 border-secondary"
            />
            <div className="text-start min-w-0">
              <p className="font-bold text-sm truncate">{complaint.user}</p>
              <p className="text-xs opacity-80 truncate">{complaint.userEmail}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {isOpening && (
            <div data-testid="complaint-opening">
              <PageLoader size="sm" />
            </div>
          )}

          {complaint.title && (
            <div>
              <h5 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">subject</span>
                {t('support.title_label')}
              </h5>
              <p className="text-sm font-bold text-on-surface text-start">{complaint.title}</p>
            </div>
          )}

          <div>
            <h5 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">description</span>
              {t('support.content_title')}
            </h5>
            <div className="bg-surface-container-low p-4 rounded-lg text-sm text-on-surface-variant leading-relaxed text-start whitespace-pre-line">
              {complaint.content}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
              <p className="text-[10px] text-on-surface-variant">{t('support.table_category')}</p>
              <p className="text-xs font-bold text-secondary">{complaint.category}</p>
            </div>
            <div className="p-3 bg-surface rounded border border-outline-variant/10 text-start">
              <p className="text-[10px] text-on-surface-variant">{t('support.table_date')}</p>
              <p className="text-xs font-bold">{complaint.date}</p>
            </div>
          </div>

          <ComplaintAttachments attachments={complaint.attachments} />

          {complaint.resolutionNotes && (
            <div>
              <h5 className="text-xs font-bold text-primary mb-2 text-start">
                {t('support.resolution_notes')}
              </h5>
              <div
                data-testid="complaint-resolution-notes"
                className="bg-tertiary-fixed/20 p-4 rounded-lg text-sm text-on-surface-variant leading-relaxed text-start whitespace-pre-line"
              >
                {complaint.resolutionNotes}
              </div>
            </div>
          )}

          <p className="text-xs text-on-surface-variant text-start" data-testid="complaint-assignee">
            {t('support.assigned_to')}:{' '}
            <span className="font-bold">
              {complaint.assignedTo ?? t('support.unassigned')}
            </span>
          </p>

          {/* Actions */}
          {canRespond && (
            <button
              onClick={onRespond}
              disabled={isBusy(`respond-${complaint.id}`)}
              data-testid="complaint-respond"
              className="w-full bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              {t('support.respond')}
            </button>
          )}

          {canEscalate && (
            <button
              onClick={onEscalate}
              disabled={isBusy(`escalate-${complaint.id}`)}
              data-testid="complaint-escalate"
              className="w-full bg-surface-container-high text-on-surface text-xs font-bold py-3 rounded-lg hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">priority_high</span>
              {t('support.escalate')}
            </button>
          )}

          {canResolveEscalated && (
            <button
              onClick={onResolveEscalated}
              disabled={isBusy(`resolve-escalated-${complaint.id}`)}
              data-testid="complaint-resolve-escalated"
              className="w-full bg-secondary text-on-secondary text-xs font-bold py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">task_alt</span>
              {t('support.resolve_and_notify')}
            </button>
          )}

          {hasNoActions && (
            <p
              data-testid="complaint-no-actions"
              className="text-[11px] text-on-surface-variant text-start bg-surface-container-low rounded-lg p-3"
            >
              {mode === 'inbox' && complaint.status === 'escalated'
                ? t('support.no_actions_escalated')
                : t('support.no_actions_closed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
