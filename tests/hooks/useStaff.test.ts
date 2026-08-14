import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useStaff } from '../../src/features/staff/hooks/useStaff';
import { CREATABLE_STAFF_ROLES } from '../../src/features/staff/api/staffApi';
import type { EmployeeResponse } from '../../src/features/staff/api/staffApi';
import { API_BASE, server } from '../testServer';

const employee = (overrides: Partial<EmployeeResponse> = {}): EmployeeResponse => ({
  id: 3,
  username: 'agent01',
  email: null,
  full_name: 'Agent One',
  first_name: 'Agent',
  last_name: 'One',
  role: 'support_agent',
  role_label: 'Support Agent',
  is_active: true,
  created_by: null,
  last_login_at: null,
  created_at: '2026-08-12T09:00:00Z',
  ...overrides,
});

const listResponse = (data: EmployeeResponse[] = [employee()]) => ({ status: 'success', data });

/**
 * The live BUG-1 failure: an unhandled `\Error` escapes the controller's
 * `catch (\Exception)`, so Laravel renders its own 500 body rather than the
 * controller's `{status:'error'}` envelope.
 */
const bug1Response = () =>
  HttpResponse.json(
    {
      message:
        'Call to undefined method App\\Services\\Staff\\EmployeeManagementService::list()',
      exception: 'Error',
    },
    { status: 500 }
  );

describe('useStaff', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('maps employees and reports the backend as available', async () => {
    server.use(http.get(`${API_BASE}/employees`, () => HttpResponse.json(listResponse())));

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));

    expect(result.current.isBackendAvailable).toBe(true);
    expect(result.current.staff[0]).toMatchObject({
      id: '3',
      name: 'Agent One',
      username: 'agent01',
      firstName: 'Agent',
      lastName: 'One',
      role: 'support_agent',
      isActive: true,
    });
    // Null `last_login_at` becomes null, not the string "—", so the page can
    // render a real "never signed in" label instead of a dash.
    expect(result.current.staff[0].lastLogin).toBeNull();
  });

  it('flags the backend unavailable and empties the list when GET /employees 500s', async () => {
    server.use(http.get(`${API_BASE}/employees`, () => bug1Response()));

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.isBackendAvailable).toBe(false));

    // The page gates every write control on this flag — see BUG-1.
    expect(result.current.staff).toEqual([]);
    expect(typeof result.current.error).toBe('string');
    expect(result.current.error).toContain('undefined method');
  });

  it('sends the documented create payload and omits a blank email', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_BASE}/employees`, () => HttpResponse.json(listResponse())),
      http.post(`${API_BASE}/employees`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { status: 'success', message: 'created', employee: employee({ id: 4 }) },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));

    await act(async () => {
      await result.current.createEmployee({
        username: 'agent_02',
        password: 'longenoughpw',
        first_name: 'Agent',
        last_name: 'Two',
        role: 'support_agent',
      });
    });

    expect(bodies[0]).toEqual({
      username: 'agent_02',
      password: 'longenoughpw',
      first_name: 'Agent',
      last_name: 'Two',
      role: 'support_agent',
    });
    expect(bodies[0]).not.toHaveProperty('email');
  });

  it('only ever offers roles the backend permits a system_admin to assign', () => {
    // Mirrors StaffRole::creatableRoles() for system_admin. `system_admin` and
    // `sycash` are isRestricted() and 422 with "not permitted to assign".
    expect(CREATABLE_STAFF_ROLES).toEqual(['admin', 'support_agent']);
    expect(CREATABLE_STAFF_ROLES).not.toContain('system_admin');
    expect(CREATABLE_STAFF_ROLES).not.toContain('sycash');
  });

  it('deletes an employee and refetches the list', async () => {
    server.use(http.get(`${API_BASE}/employees`, () => HttpResponse.json(listResponse())));

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));

    let deleteCalls = 0;
    let refetchCalls = 0;
    server.use(
      http.delete(`${API_BASE}/employees/:id`, () => {
        deleteCalls += 1;
        return HttpResponse.json({ status: 'success', message: 'Employee deleted successfully.' });
      }),
      http.get(`${API_BASE}/employees`, () => {
        refetchCalls += 1;
        return HttpResponse.json(listResponse());
      })
    );

    const row = result.current.staff[0];
    await act(async () => {
      await result.current.deleteEmployee(row);
    });

    expect(deleteCalls).toBe(1);
    expect(refetchCalls).toBe(1);
  });

  it('sends only the changed fields on update, matching the `sometimes` rules', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${API_BASE}/employees`, () => HttpResponse.json(listResponse())),
      http.put(`${API_BASE}/employees/:id`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 'success', message: 'ok', employee: employee() });
      })
    );

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));

    await act(async () => {
      await result.current.updateEmployee(result.current.staff[0], { first_name: 'Renamed' });
    });

    expect(bodies[0]).toEqual({ first_name: 'Renamed' });
  });

  it('re-reads the list after a write rather than trusting the local state', async () => {
    let listCalls = 0;
    server.use(
      http.get(`${API_BASE}/employees`, () => {
        listCalls += 1;
        return HttpResponse.json(listResponse());
      }),
      http.patch(`${API_BASE}/employees/:id/toggle-active`, () =>
        HttpResponse.json({
          status: 'success',
          message: 'ok',
          employee: employee({ is_active: false }),
        })
      )
    );

    const { result } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));
    const before = listCalls;

    // toggle-active is one of the write-then-500 paths, so the server is the
    // only trustworthy source of what actually landed.
    await act(async () => {
      await result.current.toggleActive(result.current.staff[0]);
    });

    expect(listCalls).toBeGreaterThan(before);
  });

  it('formats last_login_at for the active locale', async () => {
    server.use(
      http.get(`${API_BASE}/employees`, () =>
        HttpResponse.json(
          listResponse([employee({ id: 1, last_login_at: '2026-08-13T10:18:31Z' })])
        )
      )
    );

    const { result, rerender } = renderHook(() => useStaff());
    await waitFor(() => expect(result.current.staff).toHaveLength(1));
    const english = result.current.staff[0].lastLogin;

    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    rerender();
    await waitFor(() => expect(result.current.staff[0].lastLogin).not.toBe(english));

    // Dates were pinned to 'ar-SY' regardless of language before this phase.
    expect(result.current.staff[0].lastLogin).not.toBeNull();
    await i18n.changeLanguage('en');
  });
});
