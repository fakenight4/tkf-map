import { useEffect, useMemo, useState } from "react";
import { TarkovMap } from "./TarkovMap";
import { MAP_LABELS, localizeGroup, pickInteractive, type MapGroup } from "../lib/maps";
import type { AppConfig, MapHint, PlayerLocation } from "../lib/types";

type Props = { compact?: boolean };

export function MapApp({ compact = false }: Props) {
  const [groups, setGroups] = useState<MapGroup[]>([]);
  const [mapKey, setMapKey] = useState("customs");
  const [location, setLocation] = useState<PlayerLocation | null>(null);
  const [status, setStatus] = useState("启动中…");
  const [hint, setHint] = useState<MapHint | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [follow, setFollow] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showSettings, setShowSettings] = useState(!compact);

  useEffect(() => {
    fetch("./maps.json")
      .then((r) => r.json())
      .then((data: MapGroup[]) => setGroups(data.map(localizeGroup)))
      .catch(() => setStatus("无法加载 maps.json"));
    window.tkf.getConfig().then(setConfig);
    const offLoc = window.tkf.onLocation(setLocation);
    const offHint = window.tkf.onMapHint((next) => {
      setHint(next);
      if (next.mapKey) setMapKey(next.mapKey);
    });
    const offStatus = window.tkf.onStatus(setStatus);
    return () => {
      offLoc();
      offHint();
      offStatus();
    };
  }, []);

  const group = groups.find((g) => g.normalizedName === mapKey) ?? groups[0];
  const mapDef = group ? pickInteractive(group) : null;
  const mapOptions = useMemo(
    () => groups.filter((g) => pickInteractive(g)).map((g) => g.normalizedName),
    [groups],
  );

  async function pick(kind: "logs" | "screenshots") {
    const dir = await window.tkf.pickDirectory(kind);
    if (!dir) return;
    const next = await window.tkf.setConfig(
      kind === "logs" ? { logsPath: dir } : { screenshotsPath: dir },
    );
    setConfig(next);
  }

  async function toggle(field: keyof AppConfig, value: boolean) {
    const next = await window.tkf.setConfig({ [field]: value });
    setConfig(next);
  }

  return (
    <div className={compact ? "app app-radar" : "app"}>
      {!compact && (
        <header className="toolbar">
          <strong>TKF 地图</strong>
          <select value={mapKey} onChange={(e) => setMapKey(e.target.value)}>
            {mapOptions.map((key) => (
              <option key={key} value={key}>
                {MAP_LABELS[key] ?? key}
              </option>
            ))}
          </select>
          <label>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            跟随玩家
          </label>
          <label>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            地名
          </label>
          <button type="button" onClick={() => setShowSettings((v) => !v)}>
            {showSettings ? "收起设置" : "设置"}
          </button>
          <span className="spacer" />
          <span className="coords">
            {location
              ? `${location.x.toFixed(1)}, ${location.y.toFixed(1)}, ${location.z.toFixed(1)}`
              : "等待截图定位"}
          </span>
        </header>
      )}
      {showSettings && config && !compact && (
        <section className="settings">
          <div>
            <span>日志目录</span>
            <code>{config.logsPath || "未设置"}</code>
            <button type="button" onClick={() => pick("logs")}>
              选择
            </button>
            <label>
              <input
                type="checkbox"
                checked={config.watchLogs}
                onChange={(e) => toggle("watchLogs", e.target.checked)}
              />
              监听
            </label>
          </div>
          <div>
            <span>截图目录</span>
            <code>{config.screenshotsPath || "未设置"}</code>
            <button type="button" onClick={() => pick("screenshots")}>
              选择
            </button>
            <label>
              <input
                type="checkbox"
                checked={config.watchScreenshots}
                onChange={(e) => toggle("watchScreenshots", e.target.checked)}
              />
              监听
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.autoDeleteScreenshots}
                onChange={(e) => toggle("autoDeleteScreenshots", e.target.checked)}
              />
              读完删除
            </label>
          </div>
        </section>
      )}
      <TarkovMap
        mapDef={mapDef}
        location={location}
        follow={follow}
        compact={compact}
        showLabels={showLabels}
      />
      <footer className="status">
        {compact ? MAP_LABELS[mapKey] ?? mapKey : status}
        {hint?.locationId ? ` · 日志地点 ${hint.locationId}` : ""}
      </footer>
    </div>
  );
}
