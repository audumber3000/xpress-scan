import { can, roleLabel, isClinical } from '../src/features/employee/permissions';

const staff = (permissions: any, role = 'receptionist') => ({ role, permissions });

describe('what a staff member may open', () => {
  it('reads the role-preset shape', () => {
    const user = staff({ patients: { read: true, write: true, edit: false } });
    expect(can(user, 'view', 'patients')).toBe(true);
    expect(can(user, 'edit', 'patients')).toBe(true);      // write counts as edit
    expect(can(user, 'delete', 'patients')).toBe(false);
  });

  it('treats view and read as the same word, like the server', () => {
    expect(can(staff({ lab: { view: true } }), 'view', 'lab')).toBe(true);
    expect(can(staff({ lab: { read: true } }), 'view', 'lab')).toBe(true);
  });

  it('follows the billing/finance and users/staff aliases', () => {
    // Presets write `finance`; several screens ask for `billing`.
    expect(can(staff({ finance: { read: true } }), 'view', 'billing')).toBe(true);
    expect(can(staff({ staff: { read: true } }), 'view', 'users')).toBe(true);
    expect(can(staff({ users: { edit: true } }), 'edit', 'staff')).toBe(true);
  });

  it('says no when the block is missing or false', () => {
    expect(can(staff({}), 'view', 'inventory')).toBe(false);
    expect(can(staff({ inventory: { read: false } }), 'view', 'inventory')).toBe(false);
    expect(can(null, 'view', 'patients')).toBe(false);
  });

  it('lets the owner through everything', () => {
    expect(can(staff({}, 'clinic_owner'), 'delete', 'users')).toBe(true);
  });
});

describe('how a role reads', () => {
  it('uses the clinic vocabulary', () => {
    expect(roleLabel('in_house_doctor')).toBe('In-house doctor');
    expect(roleLabel('receptionist')).toBe('Receptionist');
    expect(roleLabel('something_new')).toBe('Staff');
  });

  it('knows who treats patients, for "seen today" vs "registered today"', () => {
    expect(isClinical('doctor')).toBe(true);
    expect(isClinical('associate')).toBe(true);
    expect(isClinical('receptionist')).toBe(false);
    expect(isClinical('assistant')).toBe(false);
  });
});
