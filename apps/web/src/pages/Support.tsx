import { LifeBuoy, Bug, MessageCircle, ExternalLink } from 'lucide-react';

const channels = [
  {
    title: 'Reportar bug',
    description: 'Incluye capturas, logs y pasos para reproducir.',
    href: 'https://github.com/dockpilot',
  },
  {
    title: 'Solicitar mejora',
    description: 'Comparte el caso de uso y el resultado esperado.',
    href: 'https://github.com/dockpilot',
  },
];

export default function Support() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/20 dark:to-gray-800 p-6">
        <div className="flex items-start gap-3">
          <LifeBuoy className="h-6 w-6 text-sky-600 dark:text-sky-400 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Soporte</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Centro de ayuda para incidencias operativas, autenticación Cloudflare y errores de
              túneles.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bug className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Checklist de diagnóstico rápido
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            <li>Verifica estado de contenedores y healthchecks de DockPilot.</li>
            <li>Confirma permisos Cloudflare (Tunnel Edit + Zone DNS Edit + Zone Read).</li>
            <li>Revisa logs de `dockpilot-tunnel-control` al crear/iniciar túneles.</li>
            <li>Si el túnel falla, comparte el mensaje completo y el `tunnelId`.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Qué incluir al pedir ayuda
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
            <li>Versión instalada de DockPilot y fecha del último upgrade.</li>
            <li>Comandos ejecutados y error exacto recibido.</li>
            <li>Salida de logs relevantes (sin exponer tokens o secretos).</li>
            <li>Captura de pantalla de la UI cuando aplique.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Canales de soporte
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {channels.map((channel) => (
            <a
              key={channel.title}
              href={channel.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-sky-400 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900 dark:text-gray-100">{channel.title}</p>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-sky-600" />
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{channel.description}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
