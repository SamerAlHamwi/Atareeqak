import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { settingsApi } from '../api/settingsApi';
import type {
  PolicyPayload,
  PolicyResponse,
  PolicySectionResponse,
  PolicySettingsResponse,
  PolicyType,
} from '../api/settingsApi';

export interface PolicySection {
  title: string;
  intro: string;
  points: string[];
}

export interface PolicyDocument {
  lastUpdatedLabel: string;
  sections: PolicySection[];
  updatedAt: string | null;
}

export interface ContactSettings {
  company: string;
  appName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  consentLabel: string;
}

const emptyContactSettings: ContactSettings = {
  company: '',
  appName: '',
  contactEmail: '',
  contactPhone: '',
  contactAddress: '',
  consentLabel: '',
};

const mapPolicy = (policy: PolicyResponse | null): PolicyDocument | null => {
  if (!policy) {
    return null;
  }
  return {
    lastUpdatedLabel: policy.last_updated_label ?? '',
    sections: policy.sections.map((s) => ({
      title: s.title,
      intro: s.intro ?? '',
      points: s.points ?? [],
    })),
    updatedAt: policy.updated_at,
  };
};

const mapSettings = (settings: PolicySettingsResponse): ContactSettings => ({
  company: settings.company ?? '',
  appName: settings.app_name ?? '',
  contactEmail: settings.contact_email ?? '',
  contactPhone: settings.contact_phone ?? '',
  contactAddress: settings.contact_address ?? '',
  consentLabel: settings.consent_label ?? '',
});

const toSectionPayload = (sections: PolicySection[]): PolicySectionResponse[] =>
  sections.map((s) => ({
    title: s.title,
    intro: s.intro.trim() === '' ? null : s.intro,
    points: s.points.filter((p) => p.trim() !== ''),
  }));

interface UseSettingsReturn {
  privacy: PolicyDocument | null;
  cancellation: PolicyDocument | null;
  contactSettings: ContactSettings;
  isLoading: boolean;
  error: string | null;
  isBackendAvailable: boolean | null;
  refetch: () => Promise<void>;
  updatePolicy: (type: PolicyType, lastUpdatedLabel: string, sections: PolicySection[]) => Promise<void>;
  updateContactSettings: (settings: ContactSettings) => Promise<void>;
}

export const useSettings = (): UseSettingsReturn => {
  const { t } = useTranslation();

  const [privacy, setPrivacy] = useState<PolicyDocument | null>(null);
  const [cancellation, setCancellation] = useState<PolicyDocument | null>(null);
  const [contactSettings, setContactSettings] = useState<ContactSettings>(emptyContactSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean | null>(null);

  const applyPayload = useCallback((data: PolicyPayload) => {
    setPrivacy(mapPolicy(data.privacy));
    setCancellation(mapPolicy(data.cancellation));
    setContactSettings(mapSettings(data.settings));
  }, []);

  const fetchPolicies = useCallback(
    async (isStale: IsStale) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await settingsApi.getPolicies();
        if (isStale()) {
          return;
        }
        applyPayload(response.data);
        setIsBackendAvailable(true);
      } catch (err) {
        if (isStale()) {
          return;
        }
        setError(extractApiError(err, t('settings.load_failed')));
        setIsBackendAvailable(false);
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    [applyPayload, t]
  );

  useFetchEffect(fetchPolicies);
  const refetch = useCallback(() => fetchPolicies(() => false), [fetchPolicies]);

  const updatePolicy = useCallback(
    async (type: PolicyType, lastUpdatedLabel: string, sections: PolicySection[]) => {
      const response = await settingsApi.updatePolicy(type, {
        last_updated_label: lastUpdatedLabel.trim() === '' ? null : lastUpdatedLabel,
        sections: toSectionPayload(sections),
      });
      const mapped = mapPolicy({ ...response.data, updated_at: null });
      if (type === 'privacy') {
        setPrivacy(mapped);
      } else {
        setCancellation(mapped);
      }
    },
    []
  );

  const updateContactSettings = useCallback(async (settings: ContactSettings) => {
    const response = await settingsApi.updateSettings({
      company: settings.company,
      app_name: settings.appName,
      contact_email: settings.contactEmail,
      contact_phone: settings.contactPhone,
      contact_address: settings.contactAddress,
      consent_label: settings.consentLabel,
    });
    setContactSettings(mapSettings(response.data));
  }, []);

  return {
    privacy,
    cancellation,
    contactSettings,
    isLoading,
    error,
    isBackendAvailable,
    refetch,
    updatePolicy,
    updateContactSettings,
  };
};
