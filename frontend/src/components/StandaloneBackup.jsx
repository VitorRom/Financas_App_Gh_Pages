import { useRef, useState } from 'react';
import { Download, Upload, HardDrive, AlertTriangle } from 'lucide-react';
import { exportDatabase, importDatabase } from '../services/standalone/store.js';
import { useToast } from '../context/ToastContext.jsx';
import { useConfirm } from '../context/ConfirmContext.jsx';

/**
 * Backup do modo autônomo.
 *
 * Sem servidor, os dados existem apenas neste navegador: limpar os dados do site,
 * trocar de aparelho ou usar janela anônima significa começar do zero. Poder baixar
 * e restaurar um arquivo é o que torna esse modo utilizável de verdade.
 */
export default function StandaloneBackup() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInput = useRef(null);
  const [restoring, setRestoring] = useState(false);

  function handleDownload() {
    try {
      const blob = new Blob([exportDatabase()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Backup baixado. Guarde o arquivo em um lugar seguro.');
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível gerar o backup' });
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const ok = await confirm({
      title: 'Restaurar backup?',
      message: `Tudo que está neste navegador será substituído pelo conteúdo de "${file.name}".`,
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;

    setRestoring(true);
    try {
      importDatabase(await file.text());
      toast.success('Backup restaurado. Recarregando…');
      // Recarrega para todas as telas relerem o armazenamento de uma vez.
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error(err.message, { title: 'Não foi possível restaurar' });
      setRestoring(false);
    }
  }

  return (
    <div className="card max-w-xl">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400"
          aria-hidden
        >
          <HardDrive size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white">Seus dados</h3>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            Tudo fica guardado neste navegador — nada é enviado para servidor nenhum.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <p className="text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
          Limpar os dados do site apaga tudo, e nada aparece em outro aparelho. Baixe um
          backup de vez em quando — é o que permite recuperar depois.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={handleDownload} className="btn btn-primary inline-flex items-center gap-2">
          <Download size={16} />
          Baixar backup
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={restoring}
          className="btn btn-secondary inline-flex items-center gap-2"
        >
          <Upload size={16} />
          {restoring ? 'Restaurando…' : 'Restaurar backup'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
