(() => {
  const allowedHosts = new Set(['localhost', '127.0.0.1']);
  const isLocalhost = allowedHosts.has(window.location.hostname);
  const params = new URLSearchParams(window.location.search);
  const explicitOptIn = params.get('babelTestMode') === '1';

  if (explicitOptIn && isLocalhost) {
    sessionStorage.setItem('babelTestMode', '1');
    document.cookie = 'babelTestMode=1; Path=/; SameSite=Lax';
  }

  const cookieOptIn = document.cookie.split('; ')
    .some(cookie => cookie === 'babelTestMode=1');
  const enabled = isLocalhost &&
    (explicitOptIn || sessionStorage.getItem('babelTestMode') === '1' || cookieOptIn);
  window.BABEL_TEST_MODE = enabled;

  if (!enabled) return;

  const originalFetch = window.fetch.bind(window);
  const blockedRequests = [];
  window.BABEL_TEST_BLOCKED_REQUESTS = blockedRequests;
  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    const sameOrigin = url.origin === window.location.origin;
    const sameLoopbackService = allowedHosts.has(url.hostname) &&
      url.protocol === window.location.protocol &&
      url.port === window.location.port;
    if (!sameOrigin && !sameLoopbackService) {
      blockedRequests.push(url.href);
      return Promise.reject(new Error(`Bloqueado pelo modo de testes: ${url.origin}`));
    }

    return originalFetch(input, init);
  };

  const localizacaoTeste = {
    latitude: -23.5505,
    longitude: -46.6333,
    accuracy: 100
  };
  try {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success) {
          success({
            coords: localizacaoTeste,
            timestamp: Date.now()
          });
        }
      }
    });
  } catch (error) {
    console.warn('Não foi possível substituir a geolocalização no modo de testes:', error);
  }

  window.BabelTestAuth = {
    async login(email, password) {
      const response = await originalFetch('/__test/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) throw Object.assign(new Error('E-mail ou senha de teste inválidos.'), { code: 'auth/invalid-credential' });
      const user = await response.json();
      user.getIdToken = async () => 'token-teste-local';
      return user;
    },
    async register(profile) {
      const response = await originalFetch('/__test/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.erro || 'Não foi possível criar conta simulada.');
      return result.perfil || result;
    },
    guest() {
      return {
        uid: 'visitante-teste',
        email: 'visitante@teste.local',
        displayName: 'Visitante de teste',
        photoURL: '',
        getIdToken: async () => 'token-teste-local'
      };
    }
  };

  const banner = document.createElement('aside');
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:fixed;z-index:2147483647;inset:auto 0 0;padding:10px 14px;background:#133c55;color:#fff;font:14px/1.4 sans-serif;text-align:center';
  banner.textContent = 'MODO DE TESTES LOCAL — dados fictícios apenas; nenhum serviço externo é permitido. Login: leitor@teste.local / BabelTeste123!';
  document.addEventListener('DOMContentLoaded', () => document.body.append(banner), { once: true });
})();
