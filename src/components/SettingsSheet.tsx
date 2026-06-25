import { Check, LocateFixed, X } from "lucide-react";
import { ROUTES, TERMINALS, type FerryRoute } from "../data/routes";
import type { FerryPrefs } from "../hooks/useFerryData";

type SettingsSheetProps = {
  open: boolean;
  prefs: FerryPrefs;
  route: FerryRoute;
  locationStatus: string;
  onClose: () => void;
  onRequestLocation: () => void;
  onPrefsChange: (prefs: FerryPrefs) => void;
};

export function SettingsSheet({
  open,
  prefs,
  route,
  locationStatus,
  onClose,
  onRequestLocation,
  onPrefsChange
}: SettingsSheetProps) {
  if (!open) {
    return null;
  }

  const updatePrefs = (updates: Partial<FerryPrefs>) => {
    onPrefsChange({ ...prefs, ...updates });
  };

  return (
    <div className="sheet-backdrop">
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-header">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-button" type="button" title="Close" aria-label="Close" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <div className="settings-section">
          <p className="section-label">Preferred route</p>
          <div className="route-picker">
            {ROUTES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`route-option ${option.id === route.id ? "is-selected" : ""}`}
                onClick={() => updatePrefs({ routeId: option.id })}
              >
                <span className="route-color" style={{ background: option.color }} />
                <span>{option.name}</span>
                {option.id === route.id ? <Check size={18} /> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="setting-row">
            <div>
              <p className="section-label">Direction</p>
              <strong>Nearest terminal</strong>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={prefs.autoDirection}
                onChange={(event) => updatePrefs({ autoDirection: event.currentTarget.checked })}
              />
              <span />
            </label>
          </div>

          <div className="terminal-toggle" aria-label="Default departure terminal">
            {route.terminalIds.map((terminalId) => {
              const selected = (prefs.departureByRoute[route.id] || route.defaultDepartureTerminalId) === terminalId;
              return (
                <button
                  key={terminalId}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  onClick={() =>
                    onPrefsChange({
                      ...prefs,
                      autoDirection: false,
                      departureByRoute: {
                        ...prefs.departureByRoute,
                        [route.id]: terminalId
                      }
                    })
                  }
                >
                  {TERMINALS[terminalId]?.shortName || terminalId}
                </button>
              );
            })}
          </div>

          <button className="location-button" type="button" onClick={onRequestLocation}>
            <LocateFixed size={18} />
            <span>{locationStatus === "ready" ? "Location ready" : "Use location"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
