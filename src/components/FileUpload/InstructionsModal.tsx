import React from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, ExternalLink, Smartphone, CloudDownload, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-700/60 text-cyan-600 dark:text-cyan-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {language === 'fr'
                ? 'Instructions pour récupérer vos fichiers CSV'
                : 'Instructions for collecting your CSV files'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={language === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
          {language === 'fr' ? (
            <>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Tout d'abord, l'idéal (bien que cela ne soit pas obligatoire pour l'option 1) est de disposer d'un compte WiGLE.
              </p>

              {/* Option 1 */}
              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-bold text-sm">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Option 1 (Recommandée) : Exporter les fichiers CSV directement depuis votre appareil Android</span>
                </div>
                <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm pl-6">
                  <p>
                    La meilleure méthode consiste à ouvrir l'application WiGLE et à sélectionner "Database" (Base de données) dans le menu latéral de gauche.
                  </p>
                  <p>
                    Appuyez ensuite sur "CSV Export Run" pour exporter votre session de scan actuelle (faites-le avant de l'envoyer à WiGLE, sinon le contenu du fichier sera réinitialisé et vous obtiendrez un CSV vide !) ou sur "CSV Export DB" pour exporter l'intégralité de votre base de données.
                  </p>
                  <p className="italic text-slate-500 dark:text-slate-400 text-xs">
                    (Remarque concernant l'exportation de la base de données : le fichier peut être très volumineux si vous avez détecté un grand nombre de réseaux.)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center my-1 text-slate-300 dark:text-slate-700">
                <span className="tracking-widest font-mono text-xs">- - -</span>
              </div>

              {/* Option 2 */}
              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                  <CloudDownload className="w-4 h-4 shrink-0" />
                  <span>Option 2 : Télécharger les fichiers CSV depuis les serveurs de WiGLE</span>
                </div>
                <div className="space-y-2.5 text-slate-600 dark:text-slate-300 text-xs sm:text-sm pl-6">
                  <p>
                    La seconde méthode consiste à{' '}
                    <a
                      href="https://wigle.net/uploads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400 underline hover:text-cyan-700 dark:hover:text-cyan-300"
                    >
                      cliquer ici <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    pour accéder à vos envois WiGLE sur le site web, ou à copier-coller le lien ci-dessous (nécessite un compte WiGLE) :
                  </p>
                  <p className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs break-all select-all text-cyan-700 dark:text-cyan-300">
                    <a
                      href="https://wigle.net/uploads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      https://wigle.net/uploads
                    </a>
                  </p>
                  <p>
                    Faites ensuite un clic droit sur la session de scan concernée et copiez le lien. Remplacez "kml" par "csv" dans le lien copié et appuyez sur Entrée.
                  </p>
                  <p>
                    Le téléchargement du fichier CSV devrait débuter.
                  </p>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/70 text-amber-950 dark:text-amber-200 space-y-1 mt-2">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Toutefois, le problème avec cette alternative est que les rapports manquent de détails.</span>
                    </p>
                    <p className="font-bold text-xs sm:text-sm">
                      Par exemple, le contenu du fichier ne permet pas de faire la distinction entre les réseaux WPA2 "Personnel" et "Entreprise". Les détails concernant les algorithmes de chiffrement sont absents, tout comme les informations sur l'état du WPS.
                    </p>
                  </div>
                  <p className="pt-1 font-semibold text-slate-800 dark:text-slate-200">
                    C'est pourquoi il est préférable d'exporter votre fichier CSV directement depuis l'application (Option 1).
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-800 dark:text-slate-200">
                First, ideally (but not mandatory for option 1), you will need a WiGLE account.
              </p>

              {/* Option 1 */}
              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-bold text-sm">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Option 1 (Recommended): Export the CSV files directly from your Android device</span>
                </div>
                <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm pl-6">
                  <p>
                    The best practice is to go to the WiGLE app and select "Database" from the left-hand menu.
                  </p>
                  <p>
                    Then, tap "CSV Export Run" to export your current scan (do this before uploading it to WiGLE, otherwise the file will reset and you will end up with an empty CSV!) or tap "CSV Export DB" to export your entire database.
                  </p>
                  <p className="italic text-slate-500 dark:text-slate-400 text-xs">
                    (Note about database exports: The file can be very large if you have found a high number of networks.)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center my-1 text-slate-300 dark:text-slate-700">
                <span className="tracking-widest font-mono text-xs">- - -</span>
              </div>

              {/* Option 2 */}
              <div className="rounded-xl p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                  <CloudDownload className="w-4 h-4 shrink-0" />
                  <span>Option 2: Download the CSV files from WiGLE servers</span>
                </div>
                <div className="space-y-2.5 text-slate-600 dark:text-slate-300 text-xs sm:text-sm pl-6">
                  <p>
                    The second practice is to{' '}
                    <a
                      href="https://wigle.net/uploads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-cyan-600 dark:text-cyan-400 underline hover:text-cyan-700 dark:hover:text-cyan-300"
                    >
                      click here <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    to access your WiGLE uploads on the website, or copy-paste the link below (Requires a WiGLE account):
                  </p>
                  <p className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs break-all select-all text-cyan-700 dark:text-cyan-300">
                    <a
                      href="https://wigle.net/uploads"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      https://wigle.net/uploads
                    </a>
                  </p>
                  <p>
                    Then, right-click on the relevant scan session and copy the link. Replace "kml" with "csv" in the link and press Enter.
                  </p>
                  <p>
                    The CSV file should then download.
                  </p>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/70 text-amber-950 dark:text-amber-200 space-y-1 mt-2">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>However, the issue with this alternative is that the reports lack detail.</span>
                    </p>
                    <p className="font-bold text-xs sm:text-sm">
                      For instance, the file content does not make it possible to distinguish between WPA2 "Personal" and "Enterprise" networks. Details regarding encryption algorithms are missing, as is information on WPS status.
                    </p>
                  </div>
                  <p className="pt-1 font-semibold text-slate-800 dark:text-slate-200">
                    That is why it is preferable to export your CSV directly from the application (Option 1).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
