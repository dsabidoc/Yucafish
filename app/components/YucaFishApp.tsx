"use client";
/* eslint-disable @next/next/no-img-element -- protected R2 images use authenticated API URLs */

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Award,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Edit3,
  Eye,
  Fish,
  Gauge,
  History,
  Home,
  Image as ImageIcon,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Ship,
  RefreshCw,
  Sunrise,
  Sunset,
  Thermometer,
  Trash2,
  Trophy,
  UserRound,
  Waves,
  Weight,
  Wind,
  X,
} from "lucide-react";
import { degreesToCompass, wmoCondition } from "@/lib/weather/domain";
import type { PortForecast } from "@/lib/weather/types";

type Profile = {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  weightUnit: "kg" | "lb";
  role: "USER" | "ADMIN";
  status: string;
};
type Trip = {
  id: string;
  title: string;
  port: string;
  departureLocationId?: string;
  fishingDate: string;
  departureTime?: string;
  returnTime?: string;
  area?: string;
  vessel?: string;
  captain?: string;
  notes?: string;
  status: "DRAFT" | "COMPLETED";
  createdAt: string;
};
type Catch = {
  id: string;
  tripId: string;
  species: string;
  customSpecies?: boolean | number;
  weightKg: number;
  originalWeight: number;
  originalUnit: string;
  releaseStatus: "RELEASED" | "KEPT" | "UNSPECIFIED";
  lengthCm?: number;
  caughtAt?: string;
  lure?: string;
  notes?: string;
};
type CatalogItem = {
  id: string;
  commonName?: string;
  aliases?: string;
  name?: string;
  type?: string;
  municipality?: string;
  latitude?: number;
  longitude?: number;
  marineLatitude?: number;
  marineLongitude?: number;
  timezone?: string;
  isWeatherEnabled?: number | boolean;
  active: number | boolean;
};
type Media = {
  id: string;
  tripId: string;
  catchId: string;
  url: string;
  altText?: string;
};
type WeatherSnapshot = {
  id: string;
  fishingTripId: string;
  capturedAt: string;
  snapshotType: string;
  temperatureC?: number | null;
  apparentTemperatureC?: number | null;
  weatherCode?: number | null;
  windSpeedKmh?: number | null;
  windDirectionDegrees?: number | null;
  windGustKmh?: number | null;
  waveHeightMeters?: number | null;
  waveDirectionDegrees?: number | null;
  wavePeriodSeconds?: number | null;
  seaSurfaceTemperatureC?: number | null;
};
type WeatherSettings = {
  maximumFavorableWindKmh: number;
  maximumCautionWindKmh: number;
  maximumFavorableGustKmh: number;
  maximumCautionGustKmh: number;
  maximumFavorableWaveMeters: number;
  maximumCautionWaveMeters: number;
  minimumFavorableWavePeriodSeconds: number;
};
type AppData = {
  profile: Profile;
  trips: Trip[];
  catches: Catch[];
  species: CatalogItem[];
  ports: CatalogItem[];
  media: Media[];
  snapshots: WeatherSnapshot[];
  weatherSettings: WeatherSettings | null;
  weatherDiagnostics: {
    cacheEntries: number;
    staleEntries: number;
    lastUpdate: string | null;
  } | null;
  logs: Array<Record<string, string>>;
};
type View =
  "dashboard" | "history" | "stats" | "weather" | "profile" | "admin" | "trip";

const emptyData: AppData = {
  profile: {
    email: "",
    displayName: "",
    firstName: "",
    lastName: "",
    city: "",
    state: "Yucatán",
    country: "México",
    timezone: "America/Merida",
    weightUnit: "kg",
    role: "USER",
    status: "ACTIVE",
  },
  trips: [],
  catches: [],
  species: [],
  ports: [],
  media: [],
  snapshots: [],
  weatherSettings: null,
  weatherDiagnostics: null,
  logs: [],
};
const mxDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const formatDate = (date: string, long = false) =>
  new Intl.DateTimeFormat(
    "es-MX",
    long
      ? {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }
      : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  ).format(new Date(`${date}T12:00:00Z`));
const kgTo = (kg: number, unit: string) =>
  unit === "lb" ? kg * 2.20462262 : kg;
const weightLabel = (kg: number, unit: string) =>
  `${kgTo(kg, unit).toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${unit}`;

export default function YucaFishApp() {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.location.pathname === "/app/clima"
      ? "weather"
      : "dashboard",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [tripForm, setTripForm] = useState<Trip | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [catchForm, setCatchForm] = useState<{
    tripId: string;
    item?: Catch;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: () => void;
  } | null>(null);
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    void load();
  }, []);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/yucafish", { cache: "no-store" });
      const body = (await res.json()) as AppData & { error?: string };
      if (!res.ok)
        throw new Error(body.error || "No pudimos cargar tu bitácora.");
      setData(body);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos cargar tu bitácora.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function mutate(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/yucafish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        data?: AppData;
        error?: string;
        id?: string;
      };
      if (!res.ok)
        throw new Error(body.error || "No pudimos guardar los cambios.");
      if (body.data) setData(body.data);
      setToast(success);
      window.setTimeout(() => setToast(""), 3200);
      return body;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar los cambios.",
      );
      throw e;
    } finally {
      setSaving(false);
    }
  }
  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
    setSelectedTrip(null);
    window.history.replaceState(
      {},
      "",
      next === "weather" ? "/app/clima" : "/app",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openTrip(id: string) {
    setSelectedTrip(id);
    setView("trip");
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <LoadingScreen />;
  if (error && !data.profile.email)
    return <ErrorScreen message={error} retry={load} />;

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        navigate={navigate}
        open={menuOpen}
        close={() => setMenuOpen(false)}
        role={data.profile.role}
      />
      <div className="app-main">
        <Topbar
          profile={data.profile}
          openMenu={() => setMenuOpen(true)}
          navigate={navigate}
          notify={() => {
            setToast("No tienes notificaciones pendientes");
            window.setTimeout(() => setToast(""), 3200);
          }}
        />
        <main className="content" id="main-content">
          {error && (
            <div className="alert error" role="alert">
              <CircleHelp size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Cerrar mensaje">
                <X size={16} />
              </button>
            </div>
          )}
          {view === "dashboard" && (
            <Dashboard
              data={data}
              period={period}
              setPeriod={setPeriod}
              newTrip={() => setTripForm(newTrip())}
              openTrip={openTrip}
              openWeather={() => navigate("weather")}
            />
          )}
          {view === "history" && (
            <HistoryView
              data={data}
              newTrip={() => setTripForm(newTrip())}
              openTrip={openTrip}
              editTrip={setTripForm}
            />
          )}
          {view === "stats" && (
            <StatsView data={data} period={period} setPeriod={setPeriod} />
          )}
          {view === "weather" && <WeatherView ports={data.ports} />}
          {view === "profile" && (
            <ProfileView
              data={data}
              save={async (payload) => {
                await mutate(
                  { op: "updateProfile", ...payload },
                  "Perfil actualizado",
                );
              }}
              saving={saving}
            />
          )}
          {view === "admin" && (
            <AdminView data={data} mutate={mutate} saving={saving} />
          )}
          {view === "trip" && selectedTrip && (
            <TripDetail
              data={data}
              tripId={selectedTrip}
              back={() => navigate("history")}
              addCatch={() => setCatchForm({ tripId: selectedTrip })}
              editCatch={(item) => setCatchForm({ tripId: selectedTrip, item })}
              editTrip={(trip) => setTripForm(trip)}
              captureWeather={() =>
                setConfirm({
                  title: "¿Guardar estas condiciones?",
                  body: "Se reemplazará el snapshot meteorológico de esta pesca con la información disponible ahora.",
                  action: () =>
                    void fetch(
                      `/api/fishing-trips/${encodeURIComponent(selectedTrip)}/weather-snapshot`,
                      { method: "POST" },
                    ).then(async (res) => {
                      const body = (await res.json()) as { error?: string };
                      if (!res.ok)
                        throw new Error(
                          body.error || "No pudimos guardar las condiciones.",
                        );
                      await load();
                      setConfirm(null);
                      setToast("Condiciones guardadas en la pesca");
                    }),
                })
              }
              duplicate={() =>
                void mutate(
                  { op: "duplicateTrip", id: selectedTrip },
                  "Pesca duplicada como borrador",
                ).then(() => navigate("history"))
              }
              deleteTrip={() =>
                setConfirm({
                  title: "¿Eliminar esta pesca?",
                  body: "La pesca y sus capturas dejarán de aparecer en tu bitácora.",
                  action: () =>
                    void mutate(
                      { op: "deleteTrip", id: selectedTrip },
                      "Pesca eliminada",
                    ).then(() => {
                      setConfirm(null);
                      navigate("history");
                    }),
                })
              }
              deleteCatch={(id) =>
                setConfirm({
                  title: "¿Eliminar esta captura?",
                  body: "Esta acción retirará la captura de las estadísticas.",
                  action: () =>
                    void mutate(
                      { op: "deleteCatch", id },
                      "Captura eliminada",
                    ).then(() => setConfirm(null)),
                })
              }
              deletePhoto={(id) =>
                setConfirm({
                  title: "¿Eliminar esta fotografía?",
                  body: "La imagen se retirará definitivamente del almacenamiento privado.",
                  action: () =>
                    void fetch(`/api/media?id=${encodeURIComponent(id)}`, {
                      method: "DELETE",
                    }).then(async (res) => {
                      if (!res.ok)
                        throw new Error("No pudimos eliminar la fotografía.");
                      await load();
                      setConfirm(null);
                      setToast("Fotografía eliminada");
                    }),
                })
              }
            />
          )}
        </main>
      </div>
      <MobileNav
        view={view}
        navigate={navigate}
        newTrip={() => setTripForm(newTrip())}
      />
      {tripForm && (
        <TripForm
          item={tripForm}
          ports={data.ports}
          saving={saving}
          close={() => setTripForm(null)}
          save={async (payload, addFish) => {
            const op = tripForm.id ? "updateTrip" : "createTrip";
            const result = await mutate(
              { op, id: tripForm.id, ...payload },
              tripForm.id ? "Pesca actualizada" : "Pesca guardada",
            );
            const savedId = tripForm.id || result?.id;
            if (payload.captureWeather && savedId) {
              const response = await fetch(
                `/api/fishing-trips/${encodeURIComponent(savedId)}/weather-snapshot`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ captureMode: "auto" }),
                },
              );
              const body = (await response.json()) as { error?: string };
              if (!response.ok)
                setError(
                  body.error ||
                    "La pesca se guardó, pero no fue posible guardar el clima.",
                );
              else await load();
            }
            setTripForm(null);
            if (addFish && savedId) {
              setSelectedTrip(savedId);
              setView("trip");
              setCatchForm({ tripId: savedId });
            } else navigate("history");
          }}
        />
      )}
      {catchForm && (
        <CatchForm
          config={catchForm}
          species={data.species}
          saving={saving}
          close={() => setCatchForm(null)}
          save={async (payload, file) => {
            const op = catchForm.item ? "updateCatch" : "createCatch";
            const result = await mutate(
              {
                op,
                id: catchForm.item?.id,
                tripId: catchForm.tripId,
                ...payload,
              },
              catchForm.item ? "Captura actualizada" : "¡Captura registrada!",
            );
            const catchId = catchForm.item?.id || result?.id;
            if (file && catchId) {
              const form = new FormData();
              form.set("file", file);
              form.set("tripId", catchForm.tripId);
              form.set("catchId", catchId);
              const upload = await fetch("/api/media", {
                method: "POST",
                body: form,
              });
              const uploadBody = (await upload.json()) as { error?: string };
              if (!upload.ok)
                setError(
                  uploadBody.error ||
                    "La captura se guardó, pero no la fotografía.",
                );
              else await load();
            }
            setCatchForm(null);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          close={() => setConfirm(null)}
          saving={saving}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function newTrip(): Trip {
  return {
    id: "",
    title: "",
    port: "",
    fishingDate: mxDate(),
    status: "DRAFT",
    createdAt: "",
  };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="brand-mark">
        <Fish size={25} />
      </span>
      {!compact && (
        <span>
          <strong>YucaFish</strong>
          <small>Bitácora de pesca</small>
        </span>
      )}
    </div>
  );
}

function Sidebar({
  view,
  navigate,
  open,
  close,
  role,
}: {
  view: View;
  navigate: (v: View) => void;
  open: boolean;
  close: () => void;
  role: string;
}) {
  const items: Array<[View, string, typeof Home]> = [
    ["dashboard", "Inicio", Home],
    ["history", "Mis pescas", History],
    ["weather", "Clima y mar", CloudSun],
    ["stats", "Estadísticas", BarChart3],
    ["profile", "Mi perfil", UserRound],
  ];
  return (
    <>
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="sidebar-head">
          <Brand />
          <button
            className="icon-button mobile-only"
            onClick={close}
            aria-label="Cerrar menú"
          >
            <X />
          </button>
        </div>
        <div className="nav-group">
          <p>BITÁCORA</p>
          {items.map(([id, label, Icon]) => (
            <button
              key={id}
              className={
                view === id || (view === "trip" && id === "history")
                  ? "active"
                  : ""
              }
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
        {role === "ADMIN" && (
          <div className="nav-group">
            <p>GESTIÓN</p>
            <button
              className={view === "admin" ? "active" : ""}
              onClick={() => navigate("admin")}
            >
              <ShieldCheck size={19} />
              Administración
            </button>
          </div>
        )}
        <div className="responsible-card">
          <span>
            <Waves size={22} />
          </span>
          <strong>Pesca responsable</strong>
          <p>Consulta siempre las regulaciones oficiales antes de salir.</p>
        </div>
        <div className="sidebar-footer">
          <a href="/cerrar-sesion">
            <LogOut size={18} />
            Cerrar sesión
          </a>
        </div>
      </aside>
      {open && (
        <button
          className="scrim mobile-only"
          onClick={close}
          aria-label="Cerrar menú"
        />
      )}
    </>
  );
}

function Topbar({
  profile,
  openMenu,
  navigate,
  notify,
}: {
  profile: Profile;
  openMenu: () => void;
  navigate: (v: View) => void;
  notify: () => void;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-only"
        onClick={openMenu}
        aria-label="Abrir menú"
      >
        <Menu />
      </button>
      <div className="top-search">
        <Search size={18} />
        <input
          aria-label="Buscar en YucaFish"
          placeholder="Buscar pescas, puertos o especies"
          onFocus={() => navigate("history")}
          readOnly
        />
      </div>
      <button
        className="icon-button"
        aria-label="Notificaciones"
        onClick={notify}
      >
        <Bell size={19} />
      </button>
      <button className="user-chip" onClick={() => navigate("profile")}>
        <span>{initials(profile.displayName)}</span>
        <b>
          {profile.displayName || "Pescador"}
          <small>
            {profile.role === "ADMIN" ? "Administrador" : "Mi cuenta"}
          </small>
        </b>
        <ChevronDown size={16} />
      </button>
    </header>
  );
}

function MobileNav({
  view,
  navigate,
  newTrip,
}: {
  view: View;
  navigate: (v: View) => void;
  newTrip: () => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Navegación móvil">
      <button
        className={view === "dashboard" ? "active" : ""}
        onClick={() => navigate("dashboard")}
      >
        <Home />
        <span>Inicio</span>
      </button>
      <button
        className={view === "history" || view === "trip" ? "active" : ""}
        onClick={() => navigate("history")}
      >
        <History />
        <span>Historial</span>
      </button>
      <button className="new-fab" onClick={newTrip} aria-label="Nueva pesca">
        <Plus />
      </button>
      <button
        className={view === "stats" ? "active" : ""}
        onClick={() => navigate("stats")}
      >
        <BarChart3 />
        <span>Estadísticas</span>
      </button>
      <button
        className={view === "profile" ? "active" : ""}
        onClick={() => navigate("profile")}
      >
        <UserRound />
        <span>Perfil</span>
      </button>
    </nav>
  );
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className="button primary"
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function PeriodTabs({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="period-tabs" role="group" aria-label="Periodo">
      {[
        ["week", "Semana"],
        ["month", "Mes"],
        ["year", "Año"],
        ["all", "Todo"],
      ].map(([id, label]) => (
        <button
          key={id}
          className={value === id ? "active" : ""}
          onClick={() => setValue(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Dashboard({
  data,
  period,
  setPeriod,
  newTrip,
  openTrip,
  openWeather,
}: {
  data: AppData;
  period: string;
  setPeriod: (v: string) => void;
  newTrip: () => void;
  openTrip: (id: string) => void;
  openWeather: () => void;
}) {
  const stats = calculate(data, period);
  return (
    <>
      <PageHeader
        eyebrow={formatDate(mxDate(), true)}
        title={`¡Buena pesca, ${data.profile.firstName || data.profile.displayName.split(" ")[0]}!`}
        subtitle="Aquí tienes el resumen de tu bitácora."
        action={
          <PrimaryButton onClick={newTrip}>
            <Plus size={18} />
            Nueva pesca
          </PrimaryButton>
        }
      />
      <PeriodTabs value={period} setValue={setPeriod} />
      <WeatherTeaser ports={data.ports} open={openWeather} />
      {data.trips.length === 0 ? (
        <EmptyState newTrip={newTrip} />
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              icon={Ship}
              label="Pescas"
              value={stats.trips.length.toString()}
              trend="+1 este mes"
            />
            <Stat
              icon={Fish}
              label="Peces"
              value={stats.catches.length.toString()}
              trend={`${stats.released} liberados`}
            />
            <Stat
              icon={Weight}
              label="Peso total"
              value={weightLabel(stats.totalWeight, data.profile.weightUnit)}
              trend="Acumulado"
            />
            <Stat
              icon={Trophy}
              label="Récord personal"
              value={weightLabel(stats.heaviest, data.profile.weightUnit)}
              trend={stats.topSpecies || "Sin especie"}
            />
          </div>
          <div className="dashboard-grid">
            <div className="card chart-card">
              <CardTitle
                title="Actividad de pesca"
                subtitle="Capturas registradas por mes"
              />
              <ActivityChart data={data} />
              <p className="chart-summary">
                Tu mes con mayor actividad registra{" "}
                {Math.max(...monthCounts(data).map((x) => x.value), 0)}{" "}
                capturas.
              </p>
            </div>
            <div className="card species-card">
              <CardTitle
                title="Especies favoritas"
                subtitle="Distribución de tus capturas"
              />
              <SpeciesDonut catches={stats.catches} />
            </div>
          </div>
          <div className="card recent-card">
            <CardTitle
              title="Actividad reciente"
              subtitle="Tus últimas salidas"
              action={
                <button
                  className="link-button"
                  onClick={() => openTrip(data.trips[0]?.id)}
                >
                  Ver detalle
                </button>
              }
            />
            <div className="trip-list">
              {data.trips.slice(0, 4).map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  catches={data.catches}
                  unit={data.profile.weightUnit}
                  open={() => openTrip(trip.id)}
                />
              ))}
            </div>
          </div>
          <div className="achievements">
            <CardTitle
              title="Logros personales"
              subtitle="Pequeños hitos de tu aventura"
            />
            <div className="achievement-row">
              <Achievement
                icon={Anchor}
                name="Primera pesca"
                earned={data.trips.length >= 1}
              />
              <Achievement
                icon={Camera}
                name="Primer recuerdo"
                earned={data.media.length >= 1}
              />
              <Achievement
                icon={Fish}
                name="5 especies"
                earned={new Set(data.catches.map((c) => c.species)).size >= 5}
              />
              <Achievement
                icon={Award}
                name="10 pescas"
                earned={data.trips.length >= 10}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function WeatherTeaser({
  ports,
  open,
}: {
  ports: CatalogItem[];
  open: () => void;
}) {
  const location =
    ports.find(
      (port) =>
        port.active && port.isWeatherEnabled && port.name === "Progreso",
    ) || ports.find((port) => port.active && port.isWeatherEnabled);
  const [forecast, setForecast] = useState<PortForecast | null>(null);
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    fetch(`/api/weather/locations/${location.id}`, {
      signal: controller.signal,
    })
      .then(async (response) =>
        response.ok
          ? setForecast((await response.json()) as PortForecast)
          : null,
      )
      .catch(() => null);
    return () => controller.abort();
  }, [location]);
  if (!location) return null;
  const weather = forecast?.currentWeather;
  const marine = forecast?.currentMarine;
  return (
    <button
      className="card weather-teaser"
      onClick={open}
      aria-label="Abrir clima y condiciones del mar"
    >
      <span className="weather-teaser-icon">
        <CloudSun />
      </span>
      <span>
        <small>CLIMA Y MAR · {location.name}</small>
        <b>
          {forecast
            ? wmoCondition(weather?.weatherCode ?? null, weather?.isDay ?? true)
                .label
            : "Consultando condiciones…"}
        </b>
        <em>
          {forecast
            ? `${metric(weather?.temperatureC, "°C")} · viento ${metric(weather?.windSpeedKmh, "km/h")} · olas ${metric(marine?.waveHeightMeters, "m")}`
            : "Datos en tiempo real desde el servidor"}
        </em>
      </span>
      <strong>
        Ver pronóstico <ChevronDown />
      </strong>
    </button>
  );
}

function WeatherView({ ports }: { ports: CatalogItem[] }) {
  const available = ports.filter(
    (port) =>
      port.active &&
      port.isWeatherEnabled &&
      port.latitude !== null &&
      port.latitude !== undefined,
  );
  const initial =
    available.find((port) => port.name === "Progreso")?.id ||
    available[0]?.id ||
    "";
  const [locationId, setLocationId] = useState(initial);
  const [query, setQuery] = useState("");
  const [forecast, setForecast] = useState<PortForecast | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(Boolean(initial));
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"selected" | "hours" | "days" | "charts">(
    "selected",
  );
  const [cooldown, setCooldown] = useState(false);
  const acceptForecast = (body: PortForecast) => {
    setForecast(body);
    setSelectedDate((current) =>
      body.daily.some((day) => day.date === current)
        ? current
        : body.daily[0]?.date || "",
    );
  };
  const loadForecast = async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/weather/locations/${encodeURIComponent(locationId)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as PortForecast & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "No pudimos consultar las condiciones.");
      acceptForecast(body);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos consultar las condiciones.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!locationId) return;
    const controller = new AbortController();
    fetch(`/api/weather/locations/${encodeURIComponent(locationId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as PortForecast & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            body.error || "No pudimos consultar las condiciones.",
          );
        return body;
      })
      .then((body) => {
        acceptForecast(body);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "No pudimos consultar las condiciones.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locationId]);
  const filtered = available.filter((port) =>
    `${port.name} ${port.municipality}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const upcoming = useMemo(() => {
    if (!forecast) return [];
    const nowHour = (
      forecast.currentWeather?.observedAt ||
      forecast.currentMarine?.observedAt ||
      forecast.hourly[0]?.time ||
      ""
    ).slice(0, 13);
    const index = Math.max(
      0,
      forecast.hourly.findIndex((item) => item.time.slice(0, 13) >= nowHour),
    );
    return forecast.hourly.slice(index, index + 24);
  }, [forecast]);
  const weather = forecast?.currentWeather;
  const marine = forecast?.currentMarine;
  const selectedDaily = forecast?.daily.find(
    (day) => day.date === selectedDate,
  );
  const selectedOutlook = forecast?.dailyFishingOutlooks.find(
    (day) => day.date === selectedDate,
  );
  const selectedHours = useMemo(
    () =>
      forecast?.hourly.filter((item) => {
        const hour = Number(item.time.slice(11, 13));
        return item.time.startsWith(selectedDate) && hour >= 5 && hour <= 18;
      }) || [],
    [forecast, selectedDate],
  );
  const condition = weather
    ? wmoCondition(weather.weatherCode, weather.isDay ?? true)
    : null;
  const refresh = () => {
    if (cooldown) return;
    setCooldown(true);
    void loadForecast();
    window.setTimeout(() => setCooldown(false), 300000);
  };
  return (
    <>
      <PageHeader
        eyebrow="Pronóstico para navegar mejor informado"
        title="Clima y condiciones del mar"
        subtitle="Elige un puerto y una fecha para revisar clima, mar y qué tan favorables se ven las condiciones."
        action={
          <button
            className="button secondary"
            onClick={refresh}
            disabled={loading || cooldown}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
            {cooldown ? "Actualizado" : "Actualizar"}
          </button>
        }
      />
      <section className="card weather-selector">
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar puerto"
            aria-label="Buscar puerto meteorológico"
          />
        </label>
        <select
          value={locationId}
          onChange={(event) => {
            setLoading(true);
            setLocationId(event.target.value);
          }}
          aria-label="Puerto seleccionado"
        >
          {filtered.map((port) => (
            <option key={port.id} value={port.id}>
              {port.name} · {port.municipality}
            </option>
          ))}
        </select>
        <label className="weather-date-field">
          <CalendarDays size={18} />
          <select
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setTab("selected");
            }}
            aria-label="Fecha del pronóstico"
            disabled={!forecast?.daily.length}
          >
            {(forecast?.daily || []).map((day) => (
              <option key={day.date} value={day.date}>
                {formatDate(day.date, true)}
              </option>
            ))}
          </select>
        </label>
        <span>
          <MapPin />
          {available.find((port) => port.id === locationId)?.name ||
            "Selecciona un puerto"}
          <small>Zona horaria America/Merida</small>
        </span>
      </section>
      {!locationId && (
        <div className="card weather-empty">
          <CloudSun />
          <h2>Selecciona un puerto para consultar el clima y el mar.</h2>
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          <CircleHelp />
          {error}
          <button onClick={() => void loadForecast()}>Reintentar</button>
        </div>
      )}
      {loading && !forecast ? (
        <WeatherSkeleton />
      ) : (
        forecast && (
          <>
            {forecast.isStale && (
              <div className="weather-warning">
                <CircleHelp />
                Mostrando la última información disponible, actualizada{" "}
                {formatWeatherTime(forecast.fetchedAt)}. Revisa una fuente
                oficial antes de salir.
              </div>
            )}
            {forecast.partialError && (
              <div className="weather-warning">
                <CircleHelp />
                {forecast.partialError === "marine"
                  ? "Se pudo obtener el clima, pero las condiciones marinas no están disponibles."
                  : "Se obtuvieron datos marinos, pero el clima general no está disponible."}
              </div>
            )}
            <section className="weather-current card">
              <div className="current-summary">
                <span>
                  <CloudSun />
                </span>
                <div>
                  <small>AHORA EN {forecast.location.name.toUpperCase()}</small>
                  <h2>{condition?.label || "No disponible"}</h2>
                  <p>Actualizado {formatWeatherTime(forecast.fetchedAt)}</p>
                </div>
                <strong>{metric(weather?.temperatureC, "°C")}</strong>
              </div>
              <div
                className={`condition-badge ${forecast.condition.level.toLowerCase()}`}
              >
                <ShieldCheck />
                {forecast.condition.label}
                <small>
                  {forecast.condition.reasons.join(" · ") ||
                    "Indicador orientativo"}
                </small>
              </div>
              <div className="weather-metrics">
                <WeatherMetric
                  icon={Thermometer}
                  label="Sensación"
                  value={metric(weather?.apparentTemperatureC, "°C")}
                />
                <WeatherMetric
                  icon={Droplets}
                  label="Humedad"
                  value={metric(weather?.humidityPercent, "%")}
                />
                <WeatherMetric
                  icon={CloudRain}
                  label="Lluvia"
                  value={metric(weather?.precipitationProbabilityPercent, "%")}
                />
                <WeatherMetric
                  icon={Wind}
                  label="Viento"
                  value={directionMetric(
                    weather?.windSpeedKmh,
                    weather?.windDirectionDegrees,
                    "km/h",
                  )}
                />
                <WeatherMetric
                  icon={Wind}
                  label="Ráfagas"
                  value={metric(weather?.windGustKmh, "km/h")}
                />
                <WeatherMetric
                  icon={Eye}
                  label="Visibilidad"
                  value={
                    weather?.visibilityMeters == null
                      ? "No disponible"
                      : `${(weather.visibilityMeters / 1000).toFixed(1)} km`
                  }
                />
                <WeatherMetric
                  icon={Waves}
                  label="Oleaje"
                  value={directionMetric(
                    marine?.waveHeightMeters,
                    marine?.waveDirectionDegrees,
                    "m",
                  )}
                />
                <WeatherMetric
                  icon={Gauge}
                  label="Periodo"
                  value={metric(marine?.wavePeriodSeconds, "s")}
                />
                <WeatherMetric
                  icon={Thermometer}
                  label="Mar"
                  value={metric(marine?.seaSurfaceTemperatureC, "°C")}
                />
                <WeatherMetric
                  icon={Compass}
                  label="Corriente"
                  value={directionMetric(
                    marine?.currentVelocityKmh,
                    marine?.currentDirectionDegrees,
                    "km/h",
                  )}
                />
              </div>
            </section>
            <div
              className="weather-tabs"
              role="tablist"
              aria-label="Tipo de pronóstico"
            >
              <button
                className={tab === "selected" ? "active" : ""}
                onClick={() => setTab("selected")}
              >
                Día seleccionado
              </button>
              <button
                className={tab === "hours" ? "active" : ""}
                onClick={() => setTab("hours")}
              >
                Próximas horas
              </button>
              <button
                className={tab === "days" ? "active" : ""}
                onClick={() => setTab("days")}
              >
                7 días
              </button>
              <button
                className={tab === "charts" ? "active" : ""}
                onClick={() => setTab("charts")}
              >
                Gráficas
              </button>
            </div>
            {tab === "selected" && selectedDaily && selectedOutlook && (
              <section className="selected-day-panel">
                <div className="card selected-day-summary">
                  <div className="selected-day-heading">
                    <div>
                      <small>PRONÓSTICO PARA</small>
                      <h2>{formatDate(selectedDaily.date, true)}</h2>
                      <p>
                        {wmoCondition(selectedDaily.weatherCode).label} en{" "}
                        {forecast.location.name}
                      </p>
                    </div>
                    <div
                      className={`condition-badge ${selectedOutlook.condition.level.toLowerCase()}`}
                      aria-label={`Indicador: ${selectedOutlook.condition.label}`}
                    >
                      <ShieldCheck />
                      {selectedOutlook.condition.label}
                      <small>
                        {selectedOutlook.condition.reasons.join(" · ") ||
                          "Indicador orientativo"}
                      </small>
                    </div>
                  </div>
                  <div
                    className="fishing-traffic-light"
                    aria-label="Escala del indicador de pesca"
                  >
                    <span className="difficult">
                      <i />
                      Rojo <small>Complicado</small>
                    </span>
                    <span className="caution">
                      <i />
                      Amarillo <small>Precaución</small>
                    </span>
                    <span className="favorable">
                      <i />
                      Verde <small>Favorable</small>
                    </span>
                    <span className="ideal">
                      <i />
                      Azul <small>Ideal</small>
                    </span>
                  </div>
                  <div className="selected-day-metrics">
                    <WeatherMetric
                      icon={Thermometer}
                      label="Temperatura"
                      value={`${metric(selectedDaily.temperatureMinC, "°C")} – ${metric(selectedDaily.temperatureMaxC, "°C")}`}
                    />
                    <WeatherMetric
                      icon={Thermometer}
                      label="Sensación"
                      value={`${metric(selectedDaily.apparentTemperatureMinC, "°C")} – ${metric(selectedDaily.apparentTemperatureMaxC, "°C")}`}
                    />
                    <WeatherMetric
                      icon={CloudRain}
                      label="Probabilidad de lluvia"
                      value={metric(
                        selectedDaily.precipitationProbabilityMaxPercent,
                        "%",
                      )}
                    />
                    <WeatherMetric
                      icon={Droplets}
                      label="Lluvia acumulada"
                      value={metric(selectedDaily.precipitationSumMm, "mm")}
                    />
                    <WeatherMetric
                      icon={Wind}
                      label="Viento máximo"
                      value={directionMetric(
                        selectedDaily.windSpeedMaxKmh,
                        selectedDaily.windDirectionDominantDegrees,
                        "km/h",
                      )}
                    />
                    <WeatherMetric
                      icon={Wind}
                      label="Ráfaga máxima"
                      value={metric(selectedDaily.windGustMaxKmh, "km/h")}
                    />
                    <WeatherMetric
                      icon={Waves}
                      label="Ola máxima"
                      value={metric(selectedOutlook.waveHeightMaxMeters, "m")}
                    />
                    <WeatherMetric
                      icon={Waves}
                      label="Oleaje promedio"
                      value={metric(
                        selectedOutlook.waveHeightAverageMeters,
                        "m",
                      )}
                    />
                    <WeatherMetric
                      icon={Gauge}
                      label="Periodo mínimo"
                      value={metric(selectedOutlook.wavePeriodMinSeconds, "s")}
                    />
                    <WeatherMetric
                      icon={Waves}
                      label="Mar de fondo"
                      value={metric(selectedOutlook.swellHeightMaxMeters, "m")}
                    />
                    <WeatherMetric
                      icon={Thermometer}
                      label="Temperatura del mar"
                      value={metric(
                        selectedOutlook.seaSurfaceTemperatureAverageC,
                        "°C",
                      )}
                    />
                    <WeatherMetric
                      icon={Compass}
                      label="Corriente máxima"
                      value={metric(
                        selectedOutlook.currentVelocityMaxKmh,
                        "km/h",
                      )}
                    />
                    <WeatherMetric
                      icon={Sunrise}
                      label="Amanecer"
                      value={timeOnly(selectedDaily.sunrise)}
                    />
                    <WeatherMetric
                      icon={Sunset}
                      label="Atardecer"
                      value={timeOnly(selectedDaily.sunset)}
                    />
                  </div>
                  <div className="best-fishing-hours">
                    <div>
                      <strong>Mejores horas estimadas</strong>
                      <small>
                        Entre las 05:00 y las 18:00, según el semáforo.
                      </small>
                    </div>
                    <span>
                      {selectedOutlook.bestHours.length ? (
                        selectedOutlook.bestHours.map((time) => (
                          <b key={time}>{hourLabel(time)}</b>
                        ))
                      ) : (
                        <em>No se identificaron horas favorables.</em>
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className="selected-day-hours"
                  aria-label={`Detalle horario de ${formatDate(selectedDaily.date, true)}`}
                >
                  {selectedHours.map((item) => (
                    <article className="card hourly-card" key={item.time}>
                      <time>{hourLabel(item.time)}</time>
                      <CloudSun />
                      <b>{metric(item.weather?.temperatureC, "°")}</b>
                      <span>
                        <CloudRain />
                        {metric(
                          item.weather?.precipitationProbabilityPercent,
                          "%",
                        )}
                      </span>
                      <span>
                        <Wind />
                        {metric(item.weather?.windSpeedKmh, "km/h")}
                      </span>
                      <span>
                        <Waves />
                        {metric(item.marine?.waveHeightMeters, "m")}
                      </span>
                      <small>
                        {metric(item.marine?.wavePeriodSeconds, "s")}
                      </small>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {tab === "hours" && (
              <section
                className="hourly-scroll"
                aria-label="Pronóstico de las próximas 24 horas"
              >
                {upcoming.map((item) => (
                  <article className="card hourly-card" key={item.time}>
                    <time>{hourLabel(item.time)}</time>
                    <CloudSun />
                    <b>{metric(item.weather?.temperatureC, "°")}</b>
                    <span>
                      <CloudRain />
                      {metric(
                        item.weather?.precipitationProbabilityPercent,
                        "%",
                      )}
                    </span>
                    <span>
                      <Wind />
                      {metric(item.weather?.windSpeedKmh, "km/h")}
                    </span>
                    <span>
                      <Waves />
                      {metric(item.marine?.waveHeightMeters, "m")}
                    </span>
                    <small>{metric(item.marine?.wavePeriodSeconds, "s")}</small>
                  </article>
                ))}
              </section>
            )}
            {tab === "days" && (
              <section
                className="daily-grid"
                aria-label="Pronóstico de siete días"
              >
                {forecast.daily.map((day) => (
                  <article className="card daily-card" key={day.date}>
                    <div>
                      <time>{formatDate(day.date, true)}</time>
                      <CloudSun />
                      <b>{wmoCondition(day.weatherCode).label}</b>
                    </div>
                    <strong>
                      {metric(day.temperatureMaxC, "°")}{" "}
                      <small>/ {metric(day.temperatureMinC, "°")}</small>
                    </strong>
                    <span>
                      <CloudRain />
                      {metric(day.precipitationProbabilityMaxPercent, "%")}
                    </span>
                    <span>
                      <Wind />
                      {metric(day.windSpeedMaxKmh, "km/h")} · ráf.{" "}
                      {metric(day.windGustMaxKmh, "km/h")}
                    </span>
                    <span>
                      <Sunrise />
                      {timeOnly(day.sunrise)} <Sunset />
                      {timeOnly(day.sunset)}
                    </span>
                  </article>
                ))}
              </section>
            )}
            {tab === "charts" && (
              <section className="weather-chart-grid">
                <WeatherChart
                  title="Viento y ráfagas"
                  unit="km/h"
                  values={upcoming.map((item) => ({
                    label: hourLabel(item.time),
                    primary: item.weather?.windSpeedKmh ?? null,
                    secondary: item.weather?.windGustKmh ?? null,
                  }))}
                />
                <WeatherChart
                  title="Altura y periodo del oleaje"
                  unit="m"
                  values={upcoming.map((item) => ({
                    label: hourLabel(item.time),
                    primary: item.marine?.waveHeightMeters ?? null,
                    secondary: null,
                  }))}
                />
                <WeatherChart
                  title="Probabilidad de lluvia"
                  unit="%"
                  values={upcoming.map((item) => ({
                    label: hourLabel(item.time),
                    primary:
                      item.weather?.precipitationProbabilityPercent ?? null,
                    secondary: null,
                  }))}
                />
              </section>
            )}
            <div className="weather-safety">
              <ShieldCheck />
              <p>
                <b>
                  Estos semáforos e indicadores son únicamente orientativos.
                </b>{" "}
                YucaFish no garantiza una pesca exitosa ni se responsabiliza por
                decisiones de navegación, pesca o seguridad tomadas con esta
                información. Las condiciones pueden cambiar rápidamente;
                consulta siempre los avisos oficiales, la Capitanía de Puerto y
                las autoridades correspondientes antes de salir.
              </p>
            </div>
            <p className="weather-attribution">
              Datos meteorológicos:{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo
              </a>
            </p>
          </>
        )
      )}
    </>
  );
}

function WeatherMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Fish;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>
        <Icon />
      </span>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
function WeatherSkeleton() {
  return (
    <div
      className="card weather-skeleton"
      role="status"
      aria-label="Consultando condiciones meteorológicas"
    >
      <i />
      <i />
      <i />
      <i />
      <span>Consultando clima y mar…</span>
    </div>
  );
}
function WeatherChart({
  title,
  unit,
  values,
}: {
  title: string;
  unit: string;
  values: Array<{
    label: string;
    primary: number | null;
    secondary: number | null;
  }>;
}) {
  const max = Math.max(
    ...values.flatMap((item) => [item.primary ?? 0, item.secondary ?? 0]),
    1,
  );
  return (
    <div className="card weather-chart">
      <CardTitle title={title} subtitle={`Próximas 24 horas · ${unit}`} />
      <div>
        {values.slice(0, 12).map((item) => (
          <span key={item.label}>
            <i
              style={{
                height: `${Math.max(((item.primary ?? 0) / max) * 100, item.primary === null ? 0 : 3)}%`,
              }}
            />
            {item.secondary !== null && (
              <em
                style={{
                  height: `${Math.max((item.secondary / max) * 100, 3)}%`,
                }}
              />
            )}
            <small>{item.label}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: typeof Fish;
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="card stat-card">
      <span className="stat-icon">
        <Icon />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{trend}</small>
      </div>
    </div>
  );
}
function CardTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function ActivityChart({ data }: { data: AppData }) {
  const months = monthCounts(data);
  const max = Math.max(...months.map((m) => m.value), 1);
  return (
    <div className="bar-chart" aria-label="Gráfica de capturas por mes">
      {months.map((m) => (
        <div key={m.label} className="bar-column">
          <span>{m.value || ""}</span>
          <i style={{ height: `${Math.max((m.value / max) * 100, 4)}%` }} />
          <small>{m.label}</small>
        </div>
      ))}
    </div>
  );
}
function SpeciesDonut({ catches }: { catches: Catch[] }) {
  const grouped = groupSpecies(catches).slice(0, 4);
  const total = catches.length || 1;
  const colors = ["#1479f8", "#21b6a8", "#f59e0b", "#8b5cf6"];
  const gradient = grouped.reduce<{ stops: string[]; end: number }>(
    (acc, g, i) => {
      const end = acc.end + (g.count / total) * 100;
      return { stops: [...acc.stops, `${colors[i]} ${acc.end}% ${end}%`], end };
    },
    { stops: [], end: 0 },
  );
  const stops =
    gradient.end < 100
      ? [...gradient.stops, `#edf2f7 ${gradient.end}% 100%`]
      : gradient.stops;
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{ background: `conic-gradient(${stops.join(",")})` }}
      >
        <span>
          <b>{catches.length}</b>capturas
        </span>
      </div>
      <div className="legend">
        {grouped.map((g, i) => (
          <div key={g.name}>
            <i style={{ background: colors[i] }} />
            <span>{g.name}</span>
            <b>{Math.round((g.count / total) * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function Achievement({
  icon: Icon,
  name,
  earned,
}: {
  icon: typeof Fish;
  name: string;
  earned: boolean;
}) {
  return (
    <div className={`achievement ${earned ? "earned" : ""}`}>
      <span>
        <Icon />
      </span>
      <div>
        <strong>{name}</strong>
        <small>{earned ? "¡Conseguido!" : "Sigue pescando"}</small>
      </div>
    </div>
  );
}

function HistoryView({
  data,
  newTrip,
  openTrip,
  editTrip,
}: {
  data: AppData;
  newTrip: () => void;
  openTrip: (id: string) => void;
  editTrip: (t: Trip) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const filtered = useMemo(
    () =>
      [...data.trips]
        .filter((t) =>
          `${t.title} ${t.port}`.toLowerCase().includes(query.toLowerCase()),
        )
        .filter((t) => status === "ALL" || t.status === status)
        .sort((a, b) =>
          sort === "weight"
            ? tripWeight(b.id, data.catches) - tripWeight(a.id, data.catches)
            : sort === "fish"
              ? tripCatches(b.id, data.catches).length -
                tripCatches(a.id, data.catches).length
              : b.fishingDate.localeCompare(a.fishingDate),
        ),
    [data, query, status, sort],
  );
  return (
    <>
      <PageHeader
        eyebrow="Tu archivo personal"
        title="Mis pescas"
        subtitle={`${data.trips.length} salidas guardadas en tu bitácora`}
        action={
          <PrimaryButton onClick={newTrip}>
            <Plus size={18} />
            Nueva pesca
          </PrimaryButton>
        }
      />
      <div className="filters card">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título o puerto"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="ALL">Todos los estados</option>
          <option value="COMPLETED">Finalizadas</option>
          <option value="DRAFT">Borradores</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Ordenar pescas"
        >
          <option value="recent">Más recientes</option>
          <option value="fish">Mayor cantidad</option>
          <option value="weight">Mayor peso</option>
        </select>
      </div>
      {filtered.length ? (
        <div className="trip-card-grid">
          {filtered.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              catches={data.catches}
              media={data.media}
              unit={data.profile.weightUnit}
              open={() => openTrip(trip.id)}
              edit={() => editTrip(trip)}
            />
          ))}
        </div>
      ) : (
        <div className="card no-results">
          <Search />
          <h2>No encontramos pescas</h2>
          <p>Prueba otra búsqueda o registra una salida nueva.</p>
          <PrimaryButton onClick={newTrip}>
            <Plus size={18} />
            Nueva pesca
          </PrimaryButton>
        </div>
      )}
    </>
  );
}

function TripCard({
  trip,
  catches,
  media,
  unit,
  open,
  edit,
}: {
  trip: Trip;
  catches: Catch[];
  media: Media[];
  unit: string;
  open: () => void;
  edit: () => void;
}) {
  const list = tripCatches(trip.id, catches);
  const photo = media.find((m) => m.tripId === trip.id);
  return (
    <article className="card trip-card">
      <button
        className="trip-cover"
        onClick={open}
        aria-label={`Abrir ${trip.title}`}
      >
        {photo ? (
          <img src={photo.url} alt={photo.altText || trip.title} />
        ) : (
          <span>
            <Waves />
            <Fish />
          </span>
        )}
        <em className={trip.status === "COMPLETED" ? "complete" : "draft"}>
          {trip.status === "COMPLETED" ? "Finalizada" : "Borrador"}
        </em>
      </button>
      <div className="trip-card-body">
        <div>
          <p className="trip-date">
            <CalendarDays size={15} />
            {formatDate(trip.fishingDate)}
          </p>
          <h2>
            <button onClick={open}>{trip.title}</button>
          </h2>
          <p>
            <MapPin size={15} />
            {trip.port}
          </p>
        </div>
        <div className="trip-metrics">
          <span>
            <Fish size={17} />
            <b>{list.length}</b> peces
          </span>
          <span>
            <Weight size={17} />
            <b>{weightLabel(tripWeight(trip.id, catches), unit)}</b> total
          </span>
        </div>
        <div className="trip-actions">
          <button className="button secondary" onClick={open}>
            Ver detalle
          </button>
          <button
            className="icon-button"
            onClick={edit}
            aria-label="Editar pesca"
          >
            <Edit3 size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
function TripRow({
  trip,
  catches,
  unit,
  open,
}: {
  trip: Trip;
  catches: Catch[];
  unit: string;
  open: () => void;
}) {
  const list = tripCatches(trip.id, catches);
  return (
    <button className="trip-row" onClick={open}>
      <span className="row-icon">
        <Ship />
      </span>
      <span className="row-main">
        <b>{trip.title}</b>
        <small>
          <MapPin size={13} />
          {trip.port} · {formatDate(trip.fishingDate)}
        </small>
      </span>
      <span>
        <b>{list.length}</b>
        <small>peces</small>
      </span>
      <span>
        <b>{weightLabel(tripWeight(trip.id, catches), unit)}</b>
        <small>peso total</small>
      </span>
      <ChevronDown size={18} />
    </button>
  );
}

function TripDetail({
  data,
  tripId,
  back,
  addCatch,
  editCatch,
  editTrip,
  captureWeather,
  duplicate,
  deleteTrip,
  deleteCatch,
  deletePhoto,
}: {
  data: AppData;
  tripId: string;
  back: () => void;
  addCatch: () => void;
  editCatch: (c: Catch) => void;
  editTrip: (t: Trip) => void;
  captureWeather: () => void;
  duplicate: () => void;
  deleteTrip: () => void;
  deleteCatch: (id: string) => void;
  deletePhoto: (id: string) => void;
}) {
  const trip = data.trips.find((t) => t.id === tripId);
  if (!trip)
    return <ErrorScreen message="No encontramos esta pesca." retry={back} />;
  const list = tripCatches(tripId, data.catches);
  const heaviest = Math.max(...list.map((c) => c.weightKg), 0);
  const snapshot = data.snapshots.find((item) => item.fishingTripId === tripId);
  return (
    <>
      <button className="back-link" onClick={back}>
        <ChevronLeft size={18} />
        Volver a mis pescas
      </button>
      <div className="trip-hero">
        <div>
          <span className={`status ${trip.status.toLowerCase()}`}>
            {trip.status === "COMPLETED" ? "Finalizada" : "Borrador"}
          </span>
          <h1>{trip.title}</h1>
          <p>
            <CalendarDays size={17} />
            {formatDate(trip.fishingDate, true)} <i /> <MapPin size={17} />
            {trip.port}
          </p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={captureWeather}>
            <CloudSun size={17} />
            {snapshot ? "Actualizar clima" : "Guardar clima"}
          </button>
          <button className="button secondary" onClick={() => editTrip(trip)}>
            <Edit3 size={17} />
            Editar
          </button>
          <button
            className="icon-button"
            onClick={duplicate}
            aria-label="Duplicar pesca"
          >
            <MoreHorizontal />
          </button>
          <button
            className="icon-button danger"
            onClick={deleteTrip}
            aria-label="Eliminar pesca"
          >
            <Trash2 />
          </button>
        </div>
      </div>
      <div className="detail-stats">
        <Stat
          icon={Fish}
          label="Capturas"
          value={String(list.length)}
          trend={`${new Set(list.map((c) => c.species)).size} especies`}
        />
        <Stat
          icon={Weight}
          label="Peso total"
          value={weightLabel(
            tripWeight(tripId, data.catches),
            data.profile.weightUnit,
          )}
          trend="En esta salida"
        />
        <Stat
          icon={Trophy}
          label="Más pesada"
          value={weightLabel(heaviest, data.profile.weightUnit)}
          trend={
            [...list].sort((a, b) => b.weightKg - a.weightKg)[0]?.species ||
            "Sin capturas"
          }
        />
      </div>
      {snapshot && (
        <WeatherSnapshotCard snapshot={snapshot} update={captureWeather} />
      )}
      <div className="detail-grid">
        <section className="card">
          <CardTitle
            title="Capturas"
            subtitle="Peces registrados en esta salida"
            action={
              <PrimaryButton onClick={addCatch}>
                <Plus size={17} />
                Agregar pez
              </PrimaryButton>
            }
          />
          {list.length ? (
            <div className="catch-list">
              {list.map((item) => (
                <CatchRow
                  key={item.id}
                  item={item}
                  media={data.media}
                  unit={data.profile.weightUnit}
                  edit={() => editCatch(item)}
                  remove={() => deleteCatch(item.id)}
                  removePhoto={deletePhoto}
                />
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              <span>
                <Fish />
              </span>
              <h3>Aún no hay peces</h3>
              <p>Registra tu primera captura de esta salida.</p>
              <PrimaryButton onClick={addCatch}>
                <Plus size={17} />
                Agregar pez
              </PrimaryButton>
            </div>
          )}
        </section>
        <aside className="card trip-info">
          <CardTitle title="Detalles de la salida" />
          <Info
            icon={Ship}
            label="Embarcación"
            value={trip.vessel || "Sin especificar"}
          />
          <Info
            icon={Gauge}
            label="Capitán"
            value={trip.captain || "Sin especificar"}
          />
          <Info
            icon={Compass}
            label="Zona"
            value={trip.area || "Sin especificar"}
          />
          <Info
            icon={CalendarDays}
            label="Horario"
            value={
              trip.departureTime
                ? `${trip.departureTime} – ${trip.returnTime || "—"}`
                : "Sin especificar"
            }
          />
          {trip.notes && (
            <div className="notes">
              <b>Notas</b>
              <p>{trip.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
function WeatherSnapshotCard({
  snapshot,
  update,
}: {
  snapshot: WeatherSnapshot;
  update: () => void;
}) {
  return (
    <section className="card snapshot-card">
      <CardTitle
        title="Condiciones guardadas"
        subtitle={`${snapshot.snapshotType === "FORECAST" ? "Pronóstico" : snapshot.snapshotType === "CURRENT_CONDITION" ? "Condición consultada" : "Captura manual"} · ${formatWeatherTime(snapshot.capturedAt)}`}
        action={
          <button className="link-button" onClick={update}>
            Actualizar
          </button>
        }
      />
      <div>
        <WeatherMetric
          icon={Thermometer}
          label="Temperatura"
          value={metric(snapshot.temperatureC, "°C")}
        />
        <WeatherMetric
          icon={Wind}
          label="Viento"
          value={directionMetric(
            snapshot.windSpeedKmh,
            snapshot.windDirectionDegrees,
            "km/h",
          )}
        />
        <WeatherMetric
          icon={Wind}
          label="Ráfagas"
          value={metric(snapshot.windGustKmh, "km/h")}
        />
        <WeatherMetric
          icon={Waves}
          label="Oleaje"
          value={directionMetric(
            snapshot.waveHeightMeters,
            snapshot.waveDirectionDegrees,
            "m",
          )}
        />
        <WeatherMetric
          icon={Gauge}
          label="Periodo"
          value={metric(snapshot.wavePeriodSeconds, "s")}
        />
        <WeatherMetric
          icon={Thermometer}
          label="Mar"
          value={metric(snapshot.seaSurfaceTemperatureC, "°C")}
        />
      </div>
      <p>Este snapshot no cambia cuando el pronóstico se actualiza.</p>
    </section>
  );
}
function CatchRow({
  item,
  media,
  unit,
  edit,
  remove,
  removePhoto,
}: {
  item: Catch;
  media: Media[];
  unit: string;
  edit: () => void;
  remove: () => void;
  removePhoto: (id: string) => void;
}) {
  const photo = media.find((m) => m.catchId === item.id);
  return (
    <div className="catch-row">
      <div className="catch-photo">
        {photo ? (
          <>
            <img src={photo.url} alt={photo.altText || item.species} />
            <button
              onClick={() => removePhoto(photo.id)}
              aria-label={`Eliminar fotografía de ${item.species}`}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <Fish />
        )}
      </div>
      <div className="catch-main">
        <h3>{item.species}</h3>
        <p>{item.lure || "Sin señuelo registrado"}</p>
        <span className={`release ${item.releaseStatus.toLowerCase()}`}>
          {item.releaseStatus === "RELEASED"
            ? "Liberado"
            : item.releaseStatus === "KEPT"
              ? "Conservado"
              : "Sin especificar"}
        </span>
      </div>
      <div className="catch-weight">
        <strong>{weightLabel(item.weightKg, unit)}</strong>
        <small>
          {item.lengthCm ? `${item.lengthCm} cm` : "Peso individual"}
        </small>
      </div>
      <button
        className="icon-button"
        onClick={edit}
        aria-label={`Editar ${item.species}`}
      >
        <Edit3 size={17} />
      </button>
      <button
        className="icon-button danger"
        onClick={remove}
        aria-label={`Eliminar ${item.species}`}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Fish;
  label: string;
  value: string;
}) {
  return (
    <div className="info-row">
      <span>
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function StatsView({
  data,
  period,
  setPeriod,
}: {
  data: AppData;
  period: string;
  setPeriod: (v: string) => void;
}) {
  const s = calculate(data, period);
  const ports = Object.entries(
    s.trips.reduce<Record<string, number>>(
      (a, t) => ({ ...a, [t.port]: (a[t.port] || 0) + 1 }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader
        eyebrow="Tus números"
        title="Estadísticas"
        subtitle="Descubre patrones y celebra tus mejores capturas."
      />
      <PeriodTabs value={period} setValue={setPeriod} />
      <div className="stat-grid five">
        <Stat
          icon={Ship}
          label="Total pescas"
          value={String(s.trips.length)}
          trend="Salidas"
        />
        <Stat
          icon={Fish}
          label="Capturas"
          value={String(s.catches.length)}
          trend={`${new Set(s.catches.map((c) => c.species)).size} especies`}
        />
        <Stat
          icon={Weight}
          label="Peso total"
          value={weightLabel(s.totalWeight, data.profile.weightUnit)}
          trend={`Promedio ${weightLabel(s.catches.length ? s.totalWeight / s.catches.length : 0, data.profile.weightUnit)}`}
        />
        <Stat
          icon={Trophy}
          label="Más pesada"
          value={weightLabel(s.heaviest, data.profile.weightUnit)}
          trend={s.topSpecies || "—"}
        />
        <Stat
          icon={Waves}
          label="Liberación"
          value={`${s.catches.length ? Math.round((s.released / s.catches.length) * 100) : 0}%`}
          trend={`${s.released} peces`}
        />
      </div>
      <div className="dashboard-grid">
        <div className="card chart-card">
          <CardTitle title="Peso por salida" subtitle="Kilogramos acumulados" />
          <div className="horizontal-bars">
            {s.trips.slice(0, 6).map((t) => (
              <div key={t.id}>
                <span>{t.title}</span>
                <i>
                  <b
                    style={{
                      width: `${Math.min((tripWeight(t.id, s.catches) / Math.max(...s.trips.map((x) => tripWeight(x.id, s.catches)), 1)) * 100, 100)}%`,
                    }}
                  />
                </i>
                <strong>
                  {weightLabel(
                    tripWeight(t.id, s.catches),
                    data.profile.weightUnit,
                  )}
                </strong>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <CardTitle
            title="Puertos frecuentes"
            subtitle="Tus puntos de salida favoritos"
          />
          <div className="ranking">
            {ports.slice(0, 5).map(([name, count], i) => (
              <div key={name}>
                <span>{i + 1}</span>
                <MapPin />
                <b>{name}</b>
                <strong>
                  {count} {count === 1 ? "salida" : "salidas"}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <CardTitle
          title="Capturas por mes"
          subtitle="Resumen visual de actividad"
        />
        <ActivityChart data={{ ...data, trips: s.trips, catches: s.catches }} />
      </div>
    </>
  );
}

function ProfileView({
  data,
  save,
  saving,
}: {
  data: AppData;
  save: (p: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState(data.profile);
  const update = (key: keyof Profile, value: string) =>
    setForm({ ...form, [key]: value });
  return (
    <>
      <PageHeader
        eyebrow="Tu cuenta"
        title="Perfil y preferencias"
        subtitle="Personaliza cómo ves y registras tu bitácora."
      />
      <form
        className="profile-layout"
        onSubmit={(e) => {
          e.preventDefault();
          void save(form as unknown as Record<string, string>);
        }}
      >
        <div className="card profile-card">
          <div className="profile-avatar">{initials(form.displayName)}</div>
          <h2>{form.displayName}</h2>
          <p>{form.email}</p>
          <span className="verified">
            <ShieldCheck size={15} />
            Cuenta verificada
          </span>
          <hr />
          <p className="privacy-note">
            <ShieldCheck />
            Tus pescas y fotografías son privadas. Solo tú puedes acceder a
            ellas.
          </p>
        </div>
        <div className="card form-card">
          <CardTitle title="Información personal" />
          <div className="form-grid">
            <Field
              label="Nombre"
              value={form.firstName}
              set={(v) => update("firstName", v)}
              required
            />
            <Field
              label="Apellidos"
              value={form.lastName}
              set={(v) => update("lastName", v)}
            />
            <Field
              label="Nombre visible"
              value={form.displayName}
              set={(v) => update("displayName", v)}
              required
              wide
            />
            <Field
              label="Ciudad"
              value={form.city}
              set={(v) => update("city", v)}
            />
            <Field
              label="Estado"
              value={form.state}
              set={(v) => update("state", v)}
            />
            <Field
              label="País"
              value={form.country}
              set={(v) => update("country", v)}
            />
            <label>
              Zona horaria
              <select
                value={form.timezone}
                onChange={(e) => update("timezone", e.target.value)}
              >
                <option>America/Merida</option>
                <option>America/Mexico_City</option>
                <option>America/Cancun</option>
              </select>
            </label>
            <label>
              Unidad de peso
              <select
                value={form.weightUnit}
                onChange={(e) => update("weightUnit", e.target.value)}
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="lb">Libras (lb)</option>
              </select>
            </label>
          </div>
          <div className="form-footer">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </PrimaryButton>
          </div>
        </div>
        <div className="card account-card">
          <CardTitle title="Seguridad de la cuenta" />
          <div>
            <span>
              <ShieldCheck />
            </span>
            <b>Acceso protegido</b>
            <p>
              Tu identidad se verifica mediante inicio de sesión seguro.
              YucaFish nunca almacena tu contraseña.
            </p>
          </div>
          <a className="button secondary" href="/cerrar-sesion">
            Cerrar todas las sesiones
          </a>
        </div>
      </form>
    </>
  );
}

function AdminView({
  data,
  mutate,
  saving,
}: {
  data: AppData;
  mutate: (p: Record<string, unknown>, s: string) => Promise<unknown>;
  saving: boolean;
}) {
  const [tab, setTab] = useState<
    "overview" | "species" | "ports" | "weather" | "audit"
  >("overview");
  const [name, setName] = useState("");
  if (data.profile.role !== "ADMIN")
    return (
      <ErrorScreen
        message="No tienes permiso para entrar al panel administrativo."
        retry={() => location.assign("/app")}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="Panel protegido"
        title="Administración"
        subtitle="Gestiona catálogos y revisa la salud general de YucaFish."
      />
      <div className="admin-tabs">
        {[
          ["overview", "Resumen"],
          ["species", "Especies"],
          ["ports", "Puertos"],
          ["weather", "Clima"],
          ["audit", "Auditoría"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id as typeof tab)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="stat-grid">
            <Stat
              icon={UserRound}
              label="Usuarios"
              value="1"
              trend="1 verificado"
            />
            <Stat
              icon={Ship}
              label="Pescas"
              value={String(data.trips.length)}
              trend="Registros activos"
            />
            <Stat
              icon={Fish}
              label="Capturas"
              value={String(data.catches.length)}
              trend="En la plataforma"
            />
            <Stat
              icon={ImageIcon}
              label="Fotografías"
              value={String(data.media.length)}
              trend="Almacenamiento privado"
            />
          </div>
          <div className="card admin-welcome">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <h2>Todo en orden</h2>
              <p>
                Los catálogos están activos y las operaciones sensibles quedan
                registradas sin exponer datos privados.
              </p>
            </div>
          </div>
        </>
      )}
      {(tab === "species" || tab === "ports") && (
        <div className="card admin-table">
          <CardTitle
            title={
              tab === "species" ? "Catálogo de especies" : "Marinas y puertos"
            }
            subtitle="Activa, desactiva o agrega opciones al selector."
            action={
              <form
                className="inline-add"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  void mutate(
                    {
                      op: tab === "species" ? "createSpecies" : "createPort",
                      name,
                    },
                    tab === "species" ? "Especie agregada" : "Puerto agregado",
                  ).then(() => setName(""));
                }}
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    tab === "species" ? "Nueva especie" : "Nuevo puerto"
                  }
                />
                <PrimaryButton type="submit" disabled={saving}>
                  <Plus size={16} />
                  Agregar
                </PrimaryButton>
              </form>
            }
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Alias / tipo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "species" ? data.species : data.ports).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Fish size={17} />
                      {item.commonName || item.name}
                    </td>
                    <td>{item.aliases || item.type || "—"}</td>
                    <td>
                      <span
                        className={item.active ? "active-dot" : "inactive-dot"}
                      >
                        {item.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          void mutate(
                            {
                              op:
                                tab === "species"
                                  ? "toggleSpecies"
                                  : "togglePort",
                              id: item.id,
                            },
                            "Estado actualizado",
                          )
                        }
                      >
                        {item.active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === "weather" && (
        <WeatherAdmin data={data} mutate={mutate} saving={saving} />
      )}
      {tab === "audit" && (
        <div className="card admin-table">
          <CardTitle
            title="Registro de auditoría"
            subtitle="Eventos técnicos recientes; los correos se almacenan como hash."
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log, i) => (
                  <tr key={String(log.id || i)}>
                    <td>
                      {new Date(String(log.createdAt)).toLocaleString("es-MX")}
                    </td>
                    <td>{String(log.action).replaceAll("_", " ")}</td>
                    <td>{String(log.entityType)}</td>
                    <td>
                      <code>{String(log.actorEmailHash)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function WeatherAdmin({
  data,
  mutate,
  saving,
}: {
  data: AppData;
  mutate: (p: Record<string, unknown>, s: string) => Promise<unknown>;
  saving: boolean;
}) {
  const configured = data.ports.filter((port) => port.name !== "Otro");
  const valuesFor = (port?: CatalogItem) => ({
    latitude: String(port?.latitude ?? ""),
    longitude: String(port?.longitude ?? ""),
    marineLatitude: String(port?.marineLatitude ?? ""),
    marineLongitude: String(port?.marineLongitude ?? ""),
    timezone: port?.timezone || "America/Merida",
    isWeatherEnabled: Boolean(port?.isWeatherEnabled),
  });
  const [portId, setPortId] = useState(configured[0]?.id || "");
  const [portForm, setPortForm] = useState(() => valuesFor(configured[0]));
  const defaults = data.weatherSettings || {
    maximumFavorableWindKmh: 25,
    maximumCautionWindKmh: 40,
    maximumFavorableGustKmh: 35,
    maximumCautionGustKmh: 55,
    maximumFavorableWaveMeters: 1.2,
    maximumCautionWaveMeters: 2,
    minimumFavorableWavePeriodSeconds: 5,
  };
  const [rules, setRules] = useState(defaults);
  const [testStatus, setTestStatus] = useState("");
  const updatePort = (key: keyof typeof portForm, value: string | boolean) =>
    setPortForm({ ...portForm, [key]: value });
  const updateRule = (key: keyof WeatherSettings, value: string) =>
    setRules({ ...rules, [key]: Number(value) });
  const test = async () => {
    setTestStatus("Consultando…");
    const response = await fetch(
      `/api/weather/locations/${encodeURIComponent(portId)}`,
    );
    setTestStatus(
      response.ok
        ? "Proveedor disponible y respuesta válida."
        : `La prueba falló (${response.status}).`,
    );
  };
  return (
    <div className="weather-admin">
      <div className="admin-diagnostics">
        <Stat
          icon={MapPin}
          label="Puertos con clima"
          value={String(
            data.ports.filter((port) => port.isWeatherEnabled).length,
          )}
          trend="Catálogo activo"
        />
        <Stat
          icon={CloudSun}
          label="Entradas en caché"
          value={String(data.weatherDiagnostics?.cacheEntries ?? 0)}
          trend={`${data.weatherDiagnostics?.staleEntries ?? 0} obsoletas`}
        />
        <Stat
          icon={RefreshCw}
          label="Última actualización"
          value={
            data.weatherDiagnostics?.lastUpdate
              ? formatWeatherTime(data.weatherDiagnostics.lastUpdate)
              : "Sin consultas"
          }
          trend="Open-Meteo"
        />
      </div>
      <div className="admin-weather-grid">
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(
              { op: "updatePortWeather", id: portId, ...portForm },
              "Configuración meteorológica actualizada",
            );
          }}
        >
          <CardTitle
            title="Puerto y coordenadas"
            subtitle="El punto marino puede ubicarse frente a la costa."
          />
          <label>
            Puerto
            <select
              value={portId}
              onChange={(event) => {
                const next = event.target.value;
                setPortId(next);
                setPortForm(
                  valuesFor(configured.find((port) => port.id === next)),
                );
              }}
            >
              <option value="">Selecciona</option>
              {configured.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <Field
              label="Latitud terrestre"
              type="number"
              value={portForm.latitude}
              set={(value) => updatePort("latitude", value)}
              required
            />
            <Field
              label="Longitud terrestre"
              type="number"
              value={portForm.longitude}
              set={(value) => updatePort("longitude", value)}
              required
            />
            <Field
              label="Latitud marina"
              type="number"
              value={portForm.marineLatitude}
              set={(value) => updatePort("marineLatitude", value)}
            />
            <Field
              label="Longitud marina"
              type="number"
              value={portForm.marineLongitude}
              set={(value) => updatePort("marineLongitude", value)}
            />
            <label className="wide">
              Zona horaria
              <input
                value={portForm.timezone}
                onChange={(event) => updatePort("timezone", event.target.value)}
              />
            </label>
            <label className="check-row wide">
              <input
                type="checkbox"
                checked={portForm.isWeatherEnabled}
                onChange={(event) =>
                  updatePort("isWeatherEnabled", event.target.checked)
                }
              />
              Habilitar clima para este puerto
            </label>
          </div>
          <div className="form-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() => void test()}
            >
              Probar consulta
            </button>
            <PrimaryButton type="submit" disabled={saving}>
              Guardar puerto
            </PrimaryButton>
          </div>
          {testStatus && (
            <p className="test-status" role="status">
              {testStatus}
            </p>
          )}
        </form>
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(
              { op: "updateWeatherThresholds", ...rules },
              "Umbrales actualizados",
            );
          }}
        >
          <CardTitle
            title="Indicador orientativo"
            subtitle="El peor nivel entre viento, ráfagas y oleaje define el resultado."
          />
          <div className="form-grid">
            <Field
              label="Viento favorable (km/h)"
              type="number"
              value={String(rules.maximumFavorableWindKmh)}
              set={(value) => updateRule("maximumFavorableWindKmh", value)}
              required
            />
            <Field
              label="Viento precaución (km/h)"
              type="number"
              value={String(rules.maximumCautionWindKmh)}
              set={(value) => updateRule("maximumCautionWindKmh", value)}
              required
            />
            <Field
              label="Ráfaga favorable (km/h)"
              type="number"
              value={String(rules.maximumFavorableGustKmh)}
              set={(value) => updateRule("maximumFavorableGustKmh", value)}
              required
            />
            <Field
              label="Ráfaga precaución (km/h)"
              type="number"
              value={String(rules.maximumCautionGustKmh)}
              set={(value) => updateRule("maximumCautionGustKmh", value)}
              required
            />
            <Field
              label="Ola favorable (m)"
              type="number"
              value={String(rules.maximumFavorableWaveMeters)}
              set={(value) => updateRule("maximumFavorableWaveMeters", value)}
              required
            />
            <Field
              label="Ola precaución (m)"
              type="number"
              value={String(rules.maximumCautionWaveMeters)}
              set={(value) => updateRule("maximumCautionWaveMeters", value)}
              required
            />
            <Field
              label="Periodo mínimo (s)"
              type="number"
              value={String(rules.minimumFavorableWavePeriodSeconds)}
              set={(value) =>
                updateRule("minimumFavorableWavePeriodSeconds", value)
              }
              required
            />
          </div>
          <div className="form-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                void mutate(
                  { op: "clearWeatherCache", locationId: portId },
                  "Caché del puerto limpiada",
                )
              }
            >
              Limpiar caché
            </button>
            <PrimaryButton type="submit" disabled={saving}>
              Guardar umbrales
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function TripForm({
  item,
  ports,
  save,
  close,
  saving,
}: {
  item: Trip;
  ports: CatalogItem[];
  save: (p: Record<string, unknown>, addFish: boolean) => Promise<void>;
  close: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    title: item.title,
    port: item.port,
    fishingDate: item.fishingDate || mxDate(),
    departureTime: item.departureTime || "",
    returnTime: item.returnTime || "",
    area: item.area || "",
    vessel: item.vessel || "",
    captain: item.captain || "",
    notes: item.notes || "",
    status: item.status || "DRAFT",
  });
  const [customPort, setCustomPort] = useState("");
  const [captureWeather, setCaptureWeather] = useState(!item.id);
  const update = (key: string, value: string) =>
    setForm({ ...form, [key]: value });
  const submit = async (event: FormEvent, addFish = false) => {
    event.preventDefault();
    if (
      !form.title.trim() ||
      !(form.port === "Otro" ? customPort.trim() : form.port)
    )
      return;
    const selected = ports.find((port) => port.name === form.port);
    await save(
      {
        ...form,
        port: form.port === "Otro" ? customPort : form.port,
        departureLocationId: form.port === "Otro" ? null : selected?.id || null,
        captureWeather: captureWeather && Boolean(selected?.isWeatherEnabled),
      },
      addFish,
    );
  };
  const weatherAvailable = Boolean(
    ports.find((port) => port.name === form.port)?.isWeatherEnabled,
  );
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-form-title"
    >
      <div className="sheet wide-sheet">
        <div className="sheet-head">
          <div>
            <span className="eyebrow">PASO 1 DE 2 · INFORMACIÓN</span>
            <h2 id="trip-form-title">
              {item.id ? "Editar pesca" : "Nueva pesca"}
            </h2>
            <p>Registra los datos principales de tu salida.</p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="stepper">
          <i className="active" />
          <i />
        </div>
        <form
          onSubmit={(event) =>
            void submit(
              event,
              (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "data-add-fish",
              ) === "true",
            )
          }
        >
          <div className="form-grid">
            <Field
              label="Título de la pesca"
              value={form.title}
              set={(value) => update("title", value)}
              placeholder="Ej. Amanecer en Progreso"
              required
              wide
            />
            <label>
              Marina o puerto <em>*</em>
              <select
                value={form.port}
                onChange={(event) => update("port", event.target.value)}
                required
              >
                <option value="">Selecciona un puerto</option>
                {ports
                  .filter((port) => port.active)
                  .map((port) => (
                    <option key={port.id}>{port.name}</option>
                  ))}
              </select>
            </label>
            <Field
              label="Fecha"
              type="date"
              value={form.fishingDate}
              set={(value) => update("fishingDate", value)}
              required
            />
            <Field
              label="Hora de salida"
              type="time"
              value={form.departureTime}
              set={(value) => update("departureTime", value)}
            />
            <Field
              label="Hora de regreso"
              type="time"
              value={form.returnTime}
              set={(value) => update("returnTime", value)}
            />
            {form.port === "Otro" && (
              <Field
                label="Nombre del puerto"
                value={customPort}
                set={setCustomPort}
                placeholder="Escribe el puerto o marina"
                required
                wide
              />
            )}
            <Field
              label="Zona aproximada"
              value={form.area}
              set={(value) => update("area", value)}
              placeholder="Ej. Arrecife Alacranes"
              wide
            />
            <Field
              label="Embarcación"
              value={form.vessel}
              set={(value) => update("vessel", value)}
              placeholder="Nombre opcional"
            />
            <Field
              label="Capitán"
              value={form.captain}
              set={(value) => update("captain", value)}
              placeholder="Nombre opcional"
            />
            <label className="wide">
              Notas
              <textarea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Condiciones, acompañantes o recuerdos de la salida"
                rows={3}
              />
            </label>
            <label className="wide">
              Estado
              <select
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
              >
                <option value="DRAFT">Borrador</option>
                <option value="COMPLETED">Finalizada</option>
              </select>
            </label>
            {weatherAvailable && (
              <label className="weather-capture-option wide">
                <input
                  type="checkbox"
                  checked={captureWeather}
                  onChange={(event) => setCaptureWeather(event.target.checked)}
                />
                <CloudSun />
                <span>
                  <b>Guardar las condiciones de esta salida</b>
                  <small>
                    Se conservará un snapshot del clima y el mar disponible para
                    la fecha seleccionada.
                  </small>
                </span>
              </label>
            )}
          </div>
          <div className="sheet-footer">
            <button className="button secondary" type="button" onClick={close}>
              Cancelar
            </button>
            <button
              className="button secondary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar pesca"}
            </button>
            <button
              className="button primary"
              type="submit"
              data-add-fish="true"
              disabled={saving}
            >
              Guardar y agregar peces <ChevronDown size={17} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CatchForm({
  config,
  species,
  save,
  close,
  saving,
}: {
  config: { tripId: string; item?: Catch };
  species: CatalogItem[];
  save: (p: Record<string, unknown>, file: File | null) => Promise<void>;
  close: () => void;
  saving: boolean;
}) {
  const item = config.item;
  const initialSpecies = item?.customSpecies ? "Otro" : item?.species || "";
  const [form, setForm] = useState({
    species: initialSpecies,
    customSpeciesName: item?.customSpecies ? item.species : "",
    weight: item?.originalWeight?.toString() || "",
    weightUnit: item?.originalUnit || "kg",
    releaseStatus: item?.releaseStatus || "UNSPECIFIED",
    length: item?.lengthCm?.toString() || "",
    caughtAt: item?.caughtAt || "",
    lure: item?.lure || "",
    notes: item?.notes || "",
  });
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const update = (key: string, value: string) =>
    setForm({ ...form, [key]: value });
  const filtered = species.filter(
    (s) =>
      s.active &&
      `${s.commonName} ${s.aliases}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const other = filtered.find((s) => s.commonName === "Otro");
  const shownSpecies = search
    ? filtered.slice(0, 12)
    : [
        ...filtered.filter((s) => s.commonName !== "Otro").slice(0, 11),
        ...(other ? [other] : []),
      ];
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catch-form-title"
    >
      <div className="sheet catch-sheet">
        <div className="sheet-head">
          <div>
            <span className="eyebrow">PASO 2 DE 2 · CAPTURA</span>
            <h2 id="catch-form-title">
              {item ? "Editar captura" : "Agregar pez"}
            </h2>
            <p>Un registro por pez para estadísticas más claras.</p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="stepper">
          <i className="active" />
          <i className="active" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(form, file);
          }}
        >
          <label className="species-search">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar especie o alias (ej. curél)"
            />
          </label>
          <div
            className="species-picker"
            role="radiogroup"
            aria-label="Seleccionar especie"
          >
            {shownSpecies.map((s) => (
              <button
                type="button"
                role="radio"
                aria-checked={form.species === s.commonName}
                className={form.species === s.commonName ? "selected" : ""}
                key={s.id}
                onClick={() => update("species", s.commonName || "")}
              >
                <span>
                  <Fish />
                </span>
                {s.commonName}
              </button>
            ))}
          </div>
          {form.species === "Otro" && (
            <Field
              label="Nombre del pez"
              value={form.customSpeciesName}
              set={(v) => update("customSpeciesName", v)}
              placeholder="Nombre común"
              required
            />
          )}
          <div className="form-grid catch-fields">
            <Field
              label="Peso individual"
              type="number"
              value={form.weight}
              set={(v) => update("weight", v)}
              placeholder="0.00"
              required
            />
            <label>
              Unidad
              <select
                value={form.weightUnit}
                onChange={(e) => update("weightUnit", e.target.value)}
              >
                <option value="kg">Kilogramos</option>
                <option value="lb">Libras</option>
              </select>
            </label>
            <label>
              Captura
              <select
                value={form.releaseStatus}
                onChange={(e) => update("releaseStatus", e.target.value)}
              >
                <option value="UNSPECIFIED">No especificado</option>
                <option value="KEPT">Conservado</option>
                <option value="RELEASED">Liberado</option>
              </select>
            </label>
            <Field
              label="Longitud (cm)"
              type="number"
              value={form.length}
              set={(v) => update("length", v)}
              placeholder="Opcional"
            />
            <Field
              label="Hora aproximada"
              type="time"
              value={form.caughtAt}
              set={(v) => update("caughtAt", v)}
            />
            <Field
              label="Señuelo o carnada"
              value={form.lure}
              set={(v) => update("lure", v)}
              placeholder="Ej. sardina"
            />
            <label className="wide">
              Observaciones
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Detalles de la captura"
              />
            </label>
            <label className="photo-drop wide">
              <Camera />
              <b>{file ? file.name : "Agregar fotografía"}</b>
              <small>JPG, PNG o WebP · máximo 8 MB</small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <div className="sheet-footer">
            <button className="button secondary" type="button" onClick={close}>
              Cancelar
            </button>
            <PrimaryButton
              type="submit"
              disabled={saving || !form.species || !form.weight}
            >
              {saving
                ? "Guardando…"
                : item
                  ? "Actualizar captura"
                  : "Registrar captura"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  set,
  type = "text",
  placeholder,
  required = false,
  wide = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      {required && <em> *</em>}
      <input
        type={type}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0.01" : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    </label>
  );
}
function ConfirmDialog({
  title,
  body,
  action,
  close,
  saving,
}: {
  title: string;
  body: string;
  action: () => void;
  close: () => void;
  saving: boolean;
}) {
  return (
    <div className="modal-layer" role="alertdialog" aria-modal="true">
      <div className="confirm-box">
        <span className="danger-icon">
          <Trash2 />
        </span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div>
          <button className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button
            className="button danger-fill"
            onClick={action}
            disabled={saving}
          >
            {saving ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
function EmptyState({ newTrip }: { newTrip: () => void }) {
  return (
    <div className="card empty-state">
      <div className="empty-illustration">
        <Waves />
        <span>
          <Fish />
        </span>
        <Anchor />
      </div>
      <h2>Tu próxima historia empieza en el mar</h2>
      <p>
        Aún no has registrado pescas. Crea tu primera salida y conserva cada
        captura, foto y récord.
      </p>
      <PrimaryButton onClick={newTrip}>
        <Plus size={18} />
        Registrar mi primera pesca
      </PrimaryButton>
    </div>
  );
}
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Brand />
      <div className="loading-fish">
        <Fish />
      </div>
      <p>Preparando tu bitácora…</p>
    </div>
  );
}
function ErrorScreen({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="error-screen">
      <span>
        <Waves />
      </span>
      <h1>Algo se movió con la marea</h1>
      <p>{message}</p>
      <PrimaryButton onClick={retry}>Intentar nuevamente</PrimaryButton>
    </div>
  );
}
function Noop() {
  return null;
}

function initials(name: string) {
  return (name || "YF")
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}
function metric(value: number | null | undefined, unit: string) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "No disponible"
    : `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${unit}`;
}
function directionMetric(
  value: number | null | undefined,
  degrees: number | null | undefined,
  unit: string,
) {
  const amount = metric(value, unit);
  if (amount === "No disponible") return amount;
  const compass = degreesToCompass(degrees ?? null);
  return compass ? `${amount} ${compass}` : amount;
}
function formatWeatherTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function hourLabel(value: string) {
  return value.includes("T") ? `${value.split("T")[1]?.slice(0, 5)} h` : value;
}
function timeOnly(value: string | null) {
  return value?.includes("T")
    ? value.split("T")[1]?.slice(0, 5) || "No disponible"
    : "No disponible";
}
function tripCatches(id: string, catches: Catch[]) {
  return catches.filter((c) => c.tripId === id);
}
function tripWeight(id: string, catches: Catch[]) {
  return tripCatches(id, catches).reduce(
    (sum, c) => sum + Number(c.weightKg),
    0,
  );
}
function groupSpecies(catches: Catch[]) {
  return Object.entries(
    catches.reduce<Record<string, number>>(
      (a, c) => ({ ...a, [c.species]: (a[c.species] || 0) + 1 }),
      {},
    ),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
function filteredData(data: AppData, period: string) {
  const today = new Date(`${mxDate()}T12:00:00`);
  const start = new Date(today);
  if (period === "week") start.setDate(start.getDate() - 7);
  else if (period === "month") start.setMonth(start.getMonth() - 1);
  else if (period === "year") start.setFullYear(start.getFullYear() - 1);
  else return { trips: data.trips, catches: data.catches };
  const trips = data.trips.filter(
    (t) => new Date(`${t.fishingDate}T12:00:00`) >= start,
  );
  const ids = new Set(trips.map((t) => t.id));
  return { trips, catches: data.catches.filter((c) => ids.has(c.tripId)) };
}
function calculate(data: AppData, period: string) {
  const { trips, catches } = filteredData(data, period);
  const groups = groupSpecies(catches);
  return {
    trips,
    catches,
    totalWeight: catches.reduce((s, c) => s + Number(c.weightKg), 0),
    heaviest: Math.max(...catches.map((c) => Number(c.weightKg)), 0),
    released: catches.filter((c) => c.releaseStatus === "RELEASED").length,
    topSpecies: groups[0]?.name || "",
  };
}
function monthCounts(data: AppData) {
  const formatter = new Intl.DateTimeFormat("es-MX", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - index));
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: formatter.format(d).replace(".", ""),
      value: 0,
    };
  });
  const byTrip = new Map(
    data.trips.map((t) => [t.id, t.fishingDate.slice(0, 7)]),
  );
  data.catches.forEach((c) => {
    const m = months.find((x) => x.key === byTrip.get(c.tripId));
    if (m) m.value++;
  });
  return months;
}

void Noop;
