import * as local from './hostelDeskLocal';

const STORAGE_KEY = 'hosteldesk_local_v1';

describe('hostelDeskLocal', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
  });

  it('логин админа и пользователя', () => {
    const admin = local.login('admin@hostel.com', 'admin123');
    expect(admin.user.role.admin).toBe(true);
    expect(admin.access_token.startsWith('local_')).toBe(true);

    const user = local.login('user@hostel.com', 'user123');
    expect(user.user.role.admin).toBe(false);
  });

  it('неверный пароль — 401', () => {
    expect(() => local.login('admin@hostel.com', 'wrong')).toThrow();
    try {
      local.login('admin@hostel.com', 'wrong');
    } catch (e) {
      expect(e.response.status).toBe(401);
    }
  });

  it('CRUD компаний: админ может, пользователь — нет', () => {
    const { access_token } = local.login('admin@hostel.com', 'admin123');
    const auth = { Authorization: `Bearer ${access_token}` };

    const created = local.request(
      'POST',
      '/companies',
      {
        name: 'ООО Тест',
        inn: '123',
        legal_address: 'ул. 1',
        contact_person: 'Иван',
        contact_phone: '+1',
        contact_email: 'a@b.c',
        tariff_per_day: 100,
      },
      auth
    );
    expect(created.name).toBe('ООО Тест');

    const list = local.request('GET', '/companies', null, auth);
    expect(list.length).toBe(1);

    const userTok = local.login('user@hostel.com', 'user123').access_token;
    const userAuth = { Authorization: `Bearer ${userTok}` };
    expect(() =>
      local.request(
        'POST',
        '/companies',
        {
          name: 'X',
          inn: '2',
          legal_address: 'a',
          contact_person: 'b',
          contact_phone: 'c',
          contact_email: 'd@e.f',
          tariff_per_day: 1,
        },
        userAuth
      )
    ).toThrow();
  });

  it('meFromToken по токену после логина', () => {
    const { access_token, user } = local.login('admin@hostel.com', 'admin123');
    const me = local.meFromToken(access_token);
    expect(me.email).toBe(user.email);
  });
});
