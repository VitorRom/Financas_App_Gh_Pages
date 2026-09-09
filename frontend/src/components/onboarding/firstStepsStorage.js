const DISMISS_KEY = 'financas_primeiros_passos_oculto';

/**
 * Se o usuário já ocultou a lista de primeiros passos.
 *
 * Fica no navegador, e não no servidor, de propósito: é preferência de exibição
 * de uma tela, não dado da conta. Um navegador sem armazenamento apenas volta a
 * mostrar a lista — que some sozinha quando os três passos estiverem feitos.
 */
export function firstStepsDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissFirstSteps() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true');
  } catch {
    // Sem armazenamento disponível: nada a fazer, e nada quebra.
  }
}
