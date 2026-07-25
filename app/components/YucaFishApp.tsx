"use client";
/* eslint-disable @next/next/no-img-element -- protected R2 images use authenticated API URLs */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor,
  Award,
  BarChart3,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  CloudRain,
  CloudSun,
  Compass,
  Copy,
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
  Share2,
  Users,
} from "lucide-react";
import { degreesToCompass, wmoCondition } from "@/lib/weather/domain";
import type { PortForecast } from "@/lib/weather/types";

type Profile = {
  email: string;
  newEmail?: string;
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
  publicSlug?: string;
  publicProfileEnabled?: number | boolean;
  avatarUrl?: string | null;
};
type Trip = {
  id: string;
  title: string;
  port: string;
  ownerEmail?: string;
  departureLocationId?: string;
  coverImageUrl?: string | null;
  publicShare?: number | boolean;
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
  tideCheckEnabled?: number | boolean;
  tideCheckStationId?: string | null;
  tideCheckStationName?: string | null;
  tideCheckStationState?: string | null;
  tideCheckStationCountry?: string | null;
  stationVerifiedAt?: string | null;
  active: number | boolean;
};
type Media = {
  id: string;
  tripId: string;
  catchId?: string | null;
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
  adminUsers: Array<Record<string, unknown>>;
  adminTrips: Array<Record<string, unknown>>;
  adminCatches: Array<Record<string, unknown>>;
  adminMedia: Array<Record<string, unknown>>;
};
type View =
  | "dashboard"
  | "history"
  | "stats"
  | "weather"
  | "closures"
  | "profile"
  | "admin"
  | "trip";
type CropTask = {
  file: File;
  title: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  round?: boolean;
};

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
    publicSlug: "",
    publicProfileEnabled: true,
    avatarUrl: "",
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
  adminUsers: [],
  adminTrips: [],
  adminCatches: [],
  adminMedia: [],
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
const slugInput = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const fileNameWithExtension = (name: string, fallback: string) => {
  const normalized = name.replace(/\.[^.]+$/, "") || fallback;
  return `${normalized}.jpg`;
};
async function readFileAsImage(file: File) {
  const src = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No pudimos abrir la imagen."));
  });
  return { image, src };
}
async function renderCroppedImage(
  file: File,
  crop: {
    aspect: number;
    outputWidth: number;
    outputHeight: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
  },
) {
  const { image, src } = await readFileAsImage(file);
  try {
    const cropWidth = 1000;
    const cropHeight = cropWidth / crop.aspect;
    const baseScale = Math.max(cropWidth / image.naturalWidth, cropHeight / image.naturalHeight);
    const displayWidth = image.naturalWidth * baseScale * crop.zoom;
    const displayHeight = image.naturalHeight * baseScale * crop.zoom;
    const left = (cropWidth - displayWidth) / 2 + crop.offsetX;
    const top = (cropHeight - displayHeight) / 2 + crop.offsetY;
    const sourceX = clamp((-left * image.naturalWidth) / displayWidth, 0, image.naturalWidth);
    const sourceY = clamp((-top * image.naturalHeight) / displayHeight, 0, image.naturalHeight);
    const sourceWidth = clamp(
      (cropWidth * image.naturalWidth) / displayWidth,
      1,
      image.naturalWidth - sourceX,
    );
    const sourceHeight = clamp(
      (cropHeight * image.naturalHeight) / displayHeight,
      1,
      image.naturalHeight - sourceY,
    );
    const canvas = document.createElement("canvas");
    canvas.width = crop.outputWidth;
    canvas.height = crop.outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No pudimos preparar el recorte.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      crop.outputWidth,
      crop.outputHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("No pudimos exportar la imagen recortada."));
        },
        "image/jpeg",
        0.92,
      );
    });
    return new File([blob], fileNameWithExtension(file.name, "imagen"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}

export default function YucaFishApp() {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined"
      ? window.location.pathname === "/app/clima"
        ? "weather"
        : window.location.pathname === "/app/vedas"
          ? "closures"
          : "dashboard"
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
    action: () => void | Promise<void>;
    confirmLabel?: string;
    loadingLabel?: string;
    tone?: "danger" | "primary";
  } | null>(null);
  const [period, setPeriod] = useState("all");
  const [cropTask, setCropTask] = useState<CropTask | null>(null);
  const cropResolver = useRef<((file: File | null) => void) | null>(null);

  function requestCrop(task: CropTask) {
    return new Promise<File | null>((resolve) => {
      cropResolver.current = resolve;
      setCropTask(task);
    });
  }
  function closeCropper(result: File | null) {
    cropResolver.current?.(result);
    cropResolver.current = null;
    setCropTask(null);
  }

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
      next === "weather"
        ? "/app/clima"
        : next === "closures"
          ? "/app/vedas"
          : "/app",
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
          {view === "closures" && <ClosuresView />}
          {view === "profile" && (
            <ProfileView
              data={data}
              requestCrop={requestCrop}
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
              uploadCover={async (file) => {
                const cropped = await requestCrop({
                  file,
                  title: "Recortar portada de la pesca",
                  aspect: 16 / 6,
                  outputWidth: 1600,
                  outputHeight: 600,
                });
                if (!cropped) return;
                const form = new FormData();
                form.set("file", cropped);
                form.set("tripId", selectedTrip);
                const upload = await fetch("/api/media", {
                  method: "POST",
                  body: form,
                });
                const body = (await upload.json()) as {
                  error?: string;
                  url?: string;
                };
                if (!upload.ok || !body.url)
                  throw new Error(
                    body.error || "No pudimos subir la portada de la pesca.",
                  );
                await mutate(
                  {
                    op: "setTripCover",
                    id: selectedTrip,
                    coverImageUrl: body.url,
                  },
                  "Portada actualizada",
                );
              }}
              captureWeather={() =>
                setConfirm({
                  title: "¿Guardar estas condiciones?",
                  body: "Se reemplazará el snapshot meteorológico de esta pesca con la información disponible ahora.",
                  confirmLabel: "Sí, guardar",
                  loadingLabel: "Guardando…",
                  tone: "primary",
                  action: async () => {
                    setSaving(true);
                    setError("");
                    try {
                      const res = await fetch(
                        `/api/fishing-trips/${encodeURIComponent(selectedTrip)}/weather-snapshot`,
                        { method: "POST" },
                      );
                      const body = (await res.json()) as { error?: string };
                      if (!res.ok)
                        throw new Error(
                          body.error || "No pudimos guardar las condiciones.",
                        );
                      await load();
                      setConfirm(null);
                      setToast("Condiciones guardadas en la pesca");
                      window.setTimeout(() => setToast(""), 3200);
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "No pudimos guardar las condiciones.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  },
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
          requestCrop={requestCrop}
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
      {cropTask && (
        <ImageCropModal
          task={cropTask}
          cancel={() => closeCropper(null)}
          confirm={(file) => closeCropper(file)}
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
        <img src="/favicon.svg" alt="GoFishing.mx" />
      </span>
      {!compact && (
        <span>
          <strong>GoFishing.mx</strong>
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
    ["closures", "Vedas", Anchor],
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
}: {
  profile: Profile;
  openMenu: () => void;
  navigate: (v: View) => void;
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
      <button
        className="topbar-center-mark mobile-only"
        onClick={() => navigate("dashboard")}
        aria-label="Ir al inicio del portal"
      >
        <img src="/favicon.svg" alt="GoFishing.mx" />
      </button>
      <div className="topbar-spacer desktop-only" />
      <button className="user-chip" onClick={() => navigate("profile")}>
        <span>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName} />
          ) : (
            initials(profile.displayName)
          )}
        </span>
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
        <span>Mis pescas</span>
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
  if (!location)
    return (
      <button
        className="card weather-teaser weather-teaser-loading"
        onClick={open}
        aria-label="Abrir clima y condiciones del mar"
      >
        <span className="weather-teaser-icon">
          <CloudSun />
        </span>
        <span>
          <small>CLIMA Y MAR</small>
          <b>Consulta el clima de tu próxima pesca</b>
          <em>Pronóstico marino, viento y oleaje desde puertos de Yucatán.</em>
        </span>
        <strong>
          Ver clima <ChevronDown />
        </strong>
      </button>
    );
  if (!forecast)
    return (
      <button
        className="card weather-teaser weather-teaser-loading"
        onClick={open}
        aria-label="Abrir clima y condiciones del mar"
      >
        <span className="weather-teaser-icon">
          <CloudSun />
        </span>
        <span>
          <small>CLIMA Y MAR · {location.name}</small>
          <b>Consulta el pronóstico de tu próxima salida</b>
          <em>Temperatura, viento y oleaje actualizándose…</em>
        </span>
        <strong>
          Ver clima <ChevronDown />
        </strong>
      </button>
    );
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
          {wmoCondition(weather?.weatherCode ?? null, weather?.isDay ?? true).label}
        </b>
        <em>
          {`${metric(weather?.temperatureC, "°C")} · viento ${metric(weather?.windSpeedKmh, "km/h")} · olas ${metric(marine?.waveHeightMeters, "m")}`}
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
  const [tab, setTab] = useState<"selected" | "hours" | "days">(
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
  const selectedTideDay = forecast?.tides?.dailyConditions.find(
    (day) => day.date === selectedDate,
  );
  const selectedExtremes =
    forecast?.tides?.extremes.filter(
      (item) =>
        tideDateKey(item.localTime || item.time) === selectedDate,
    ) || [];
  const selectedTideSeries =
    forecast?.tides?.timeSeries
      .filter((item) => tideDateKey(item.time) === selectedDate)
      .filter((_, index) => index % 8 === 0)
      .slice(0, 12) || [];
  const nextHigh =
    forecast?.tides?.extremes.find(
      (item) => item.type === "high" && new Date(item.time) > new Date(),
    ) || null;
  const nextLow =
    forecast?.tides?.extremes.find(
      (item) => item.type === "low" && new Date(item.time) > new Date(),
    ) || null;
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
              {(forecast.tides || forecast.tideUnavailableReason) && (
                <div className="tide-overview">
                  {forecast.tides ? (
                    <>
                      <div>
                        <small>PRÓXIMA PLEAMAR</small>
                        <b>
                          {nextHigh ? tideTimeLabel(nextHigh.localTime || nextHigh.time) : "No disponible"}
                        </b>
                        <span>{nextHigh ? metric(nextHigh.heightMeters, "m") : "Sin evento"}</span>
                      </div>
                      <div>
                        <small>PRÓXIMA BAJAMAR</small>
                        <b>
                          {nextLow ? tideTimeLabel(nextLow.localTime || nextLow.time) : "No disponible"}
                        </b>
                        <span>{nextLow ? metric(nextLow.heightMeters, "m") : "Sin evento"}</span>
                      </div>
                      <div>
                        <small>FASE LUNAR</small>
                        <b>{forecast.tides.moonPhase || "No disponible"}</b>
                        <span>
                          {forecast.tides.moonIllumination == null
                            ? "Sin iluminación"
                            : `${forecast.tides.moonIllumination}% iluminada`}
                        </span>
                      </div>
                      <div>
                        <small>ACTIVIDAD SOLUNAR</small>
                        <b>{selectedTideDay?.solunarLabel || "No disponible"}</b>
                        <span>
                          {selectedTideDay?.solunarRating == null
                            ? "Sin calificación"
                            : `${selectedTideDay.solunarRating}/4`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="tide-unavailable-inline">
                      <CircleHelp />
                      <span>{forecast.tideUnavailableReason}</span>
                    </div>
                  )}
                </div>
              )}
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
                  {forecast.tides && selectedTideDay ? (
                    <div className="tide-solunar-grid">
                      <article className="card tide-card">
                        <div className="card-title">
                          <div>
                            <h3>Mareas del día</h3>
                            <small>
                              {forecast.tides.station.name} · {forecast.tides.datum}
                            </small>
                          </div>
                        </div>
                        <div className="tide-event-grid">
                          {selectedExtremes.length ? (
                            selectedExtremes.map((event) => (
                              <div key={`${event.type}-${event.time}`}>
                                <small>
                                  {event.type === "high" ? "Pleamar" : "Bajamar"}
                                </small>
                                <b>{tideTimeLabel(event.localTime || event.time)}</b>
                                <span>{metric(event.heightMeters, "m")}</span>
                              </div>
                            ))
                          ) : (
                            <em>No hay eventos de marea disponibles para este día.</em>
                          )}
                        </div>
                        <p className="tide-footnote">
                          Estado mareal orientativo: {selectedTideDay.springNeap || forecast.tides.springNeap || "Sin dato"}.
                        </p>
                      </article>
                      <article className="card tide-card">
                        <div className="card-title">
                          <div>
                            <h3>Luna y ventanas solunares</h3>
                            <small>
                              {selectedTideDay.moonPhase || "Fase lunar no disponible"}
                            </small>
                          </div>
                        </div>
                        <div className="tide-event-grid solunar">
                          <div>
                            <small>Iluminación</small>
                            <b>
                              {selectedTideDay.moonIllumination == null
                                ? "No disponible"
                                : `${selectedTideDay.moonIllumination}%`}
                            </b>
                            <span>{selectedTideDay.springNeap || "Sin dato de marea"}</span>
                          </div>
                          <div>
                            <small>Calificación</small>
                            <b>{selectedTideDay.solunarLabel || "No disponible"}</b>
                            <span>
                              {selectedTideDay.solunarRating == null
                                ? "Sin rating"
                                : `${selectedTideDay.solunarRating}/4`}
                            </span>
                          </div>
                          {(selectedTideDay.solunarPeriods || []).map((period, index) => (
                            <div key={`${period.type}-${period.start}-${index}`}>
                              <small>
                                {period.type === "major" ? "Periodo mayor" : "Periodo menor"}
                              </small>
                              <b>
                                {tideTimeLabel(period.startLocal || period.start)} -{" "}
                                {tideTimeLabel(period.endLocal || period.end)}
                              </b>
                              <span>
                                Pico {tideTimeLabel(period.peakLocal || period.peak)}
                                {period.enhanced ? " · reforzado" : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    </div>
                  ) : null}
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
            <div className="weather-safety">
              <ShieldCheck />
              <p>
                <b>
                  Estos semáforos e indicadores son únicamente orientativos.
                </b>{" "}
                GoFishing.mx no garantiza una pesca exitosa ni se
                responsabiliza por decisiones de navegación, pesca o seguridad
                tomadas con esta información. Las condiciones pueden cambiar
                rápidamente; consulta siempre los avisos oficiales, la
                Capitanía de Puerto y las autoridades correspondientes antes de
                salir.
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
              {forecast.tides ? (
                <>
                  {" · "}Mareas y solunar:{" "}
                  <a
                    href="https://tidecheck.com/developers/docs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    TideCheck
                  </a>
                </>
              ) : null}
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
  const photo = trip.coverImageUrl
    ? { url: trip.coverImageUrl, altText: trip.title }
    : media.find((m) => m.tripId === trip.id && !m.catchId);
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
  uploadCover,
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
  uploadCover: (file: File) => Promise<void>;
  captureWeather: () => void;
  duplicate: () => void;
  deleteTrip: () => void;
  deleteCatch: (id: string) => void;
  deletePhoto: (id: string) => void;
}) {
  const trip = data.trips.find((t) => t.id === tripId);
  const [uploadingCover, setUploadingCover] = useState(false);
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
          <label className="button secondary upload-cover-button">
            <Camera size={17} />
            {uploadingCover
              ? "Subiendo…"
              : trip.coverImageUrl
                ? "Cambiar portada"
                : "Subir portada"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploadingCover(true);
                void uploadCover(file).finally(() => {
                  setUploadingCover(false);
                  event.target.value = "";
                });
              }}
            />
          </label>
          <button className="button secondary" onClick={() => editTrip(trip)}>
            <Edit3 size={17} />
            Editar
          </button>
          <button className="button secondary" onClick={duplicate}>
            <Copy size={17} />
            Duplicar
          </button>
          <button className="button secondary danger-button" onClick={deleteTrip}>
            <Trash2 size={17} />
            Eliminar
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
      <TripForecastSummary trip={trip} ports={data.ports} />
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
      <div className="card-title snapshot-title">
        <div>
          <h2>Condiciones guardadas</h2>
          <p>
            {snapshot.snapshotType === "FORECAST"
              ? "Pronóstico"
              : snapshot.snapshotType === "CURRENT_CONDITION"
                ? "Condición consultada"
                : "Captura manual"}{" "}
            · {formatWeatherTime(snapshot.capturedAt)}
          </p>
        </div>
        <button className="link-button" onClick={update}>
          Actualizar
        </button>
      </div>
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

function TripForecastSummary({
  trip,
  ports,
}: {
  trip: Trip;
  ports: CatalogItem[];
}) {
  const [state, setState] = useState<{
    key: string;
    forecast: PortForecast | null;
    error: string;
  }>({ key: "", forecast: null, error: "" });
  const location = ports.find((port) => port.id === trip.departureLocationId);
  const isFutureTrip = trip.fishingDate >= mxDate();
  const canQueryForecast = Boolean(
    location?.id && location.isWeatherEnabled && isFutureTrip,
  );
  const requestKey =
    canQueryForecast && location?.id ? `${location.id}:${trip.fishingDate}` : "";

  useEffect(() => {
    if (!canQueryForecast || !location?.id) return;
    const controller = new AbortController();
    fetch(`/api/weather/locations/${encodeURIComponent(location.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as PortForecast & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(body.error || "No pudimos consultar el clima.");
        if (!controller.signal.aborted)
          setState({ key: requestKey, forecast: body, error: "" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key: requestKey,
            forecast: null,
            error:
              reason instanceof Error
                ? reason.message
                : "No pudimos consultar el clima.",
          });
      });
    return () => controller.abort();
  }, [canQueryForecast, location?.id, requestKey]);

  const activeForecast =
    canQueryForecast && state.key === requestKey ? state.forecast : null;
  const activeError =
    canQueryForecast && state.key === requestKey ? state.error : "";
  const loading = canQueryForecast && !activeForecast && !activeError;
  const selectedDaily = activeForecast?.daily.find(
    (day) => day.date === trip.fishingDate,
  );
  const selectedOutlook = activeForecast?.dailyFishingOutlooks.find(
    (day) => day.date === trip.fishingDate,
  );

  if (!location?.isWeatherEnabled || !isFutureTrip)
    return (
      <section className="card trip-forecast-card trip-forecast-empty">
        <CardTitle
          title="Clima estimado para tu salida"
          subtitle="Consulta previa de la fecha elegida"
        />
        <p>
          {trip.fishingDate < mxDate()
            ? "Esta salida ya ocurrió. Si quieres conservar una referencia, puedes guardar un snapshot meteorológico."
            : "Este puerto todavía no tiene clima disponible para mostrar una estimación."}
        </p>
      </section>
    );

  if (loading && !activeForecast)
    return (
      <section className="card trip-forecast-card trip-forecast-empty">
        <CardTitle
          title="Clima estimado para tu salida"
          subtitle={`Consultando ${location.name}`}
        />
        <p>Estamos revisando el pronóstico más cercano para tu fecha de pesca.</p>
      </section>
    );

  if (activeError)
    return (
      <section className="card trip-forecast-card trip-forecast-empty">
        <CardTitle
          title="Clima estimado para tu salida"
          subtitle={`Consulta para ${location.name}`}
        />
        <p>{activeError}</p>
      </section>
    );

  if (!selectedDaily || !selectedOutlook)
    return (
      <section className="card trip-forecast-card trip-forecast-empty">
        <CardTitle
          title="Clima estimado para tu salida"
          subtitle={formatDate(trip.fishingDate, true)}
        />
        <p>
          Días cercanos a la pesca podrás consultar el clima de tu día de
          pesca. Cuando el proveedor tenga ese rango disponible, aparecerá aquí
          un resumen orientativo.
        </p>
      </section>
    );

  return (
    <section className="card trip-forecast-card">
      <CardTitle
        title="Clima estimado para tu salida"
        subtitle={`${formatDate(trip.fishingDate, true)} · ${location.name}`}
      />
      <div className="trip-forecast-top">
        <div>
          <small>INDICADOR ORIENTATIVO</small>
          <h2>{selectedOutlook.condition.label}</h2>
          <p>
            {wmoCondition(selectedDaily.weatherCode).label} · amanecer{" "}
            {timeOnly(selectedDaily.sunrise)} · atardecer{" "}
            {timeOnly(selectedDaily.sunset)}
          </p>
        </div>
        <div
          className={`condition-badge ${selectedOutlook.condition.level.toLowerCase()}`}
        >
          <ShieldCheck />
          {selectedOutlook.condition.label}
          <small>
            {selectedOutlook.condition.reasons.join(" · ") ||
              "Indicador orientativo"}
          </small>
        </div>
      </div>
      <div className="selected-day-metrics trip-forecast-metrics">
        <WeatherMetric
          icon={Thermometer}
          label="Temperatura"
          value={`${metric(selectedDaily.temperatureMinC, "°C")} – ${metric(selectedDaily.temperatureMaxC, "°C")}`}
        />
        <WeatherMetric
          icon={CloudRain}
          label="Lluvia"
          value={metric(selectedDaily.precipitationProbabilityMaxPercent, "%")}
        />
        <WeatherMetric
          icon={Wind}
          label="Viento"
          value={directionMetric(
            selectedDaily.windSpeedMaxKmh,
            selectedDaily.windDirectionDominantDegrees,
            "km/h",
          )}
        />
        <WeatherMetric
          icon={Wind}
          label="Ráfaga"
          value={metric(selectedDaily.windGustMaxKmh, "km/h")}
        />
        <WeatherMetric
          icon={Waves}
          label="Oleaje"
          value={metric(selectedOutlook.waveHeightMaxMeters, "m")}
        />
        <WeatherMetric
          icon={Gauge}
          label="Periodo"
          value={metric(selectedOutlook.wavePeriodMinSeconds, "s")}
        />
      </div>
      <div className="trip-forecast-note">
        Estos indicadores son informativos y pueden cambiar. GoFishing.mx no se
        responsabiliza por los resultados de pesca ni por decisiones de
        navegación o seguridad.
      </div>
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

function ClosuresView() {
  const seasons = [
    {
      species: "Mero",
      closure: "Del 1 de febrero al 31 de marzo",
      fishing: "Del 1 de abril al 31 de enero",
      tone: "emerald",
      icon: Fish,
    },
    {
      species: "Pulpo",
      closure: "Del 16 de diciembre al 31 de julio",
      fishing: "Del 1 de agosto al 15 de diciembre",
      tone: "violet",
      icon: Waves,
    },
    {
      species: "Langosta",
      closure: "Del 1 de marzo al 30 de junio",
      fishing: "Del 1 de julio al 28 de febrero",
      tone: "rose",
      icon: Anchor,
    },
    {
      species: "Tiburón",
      closure: "Del 15 de mayo al 15 de junio y del 1 al 29 de agosto",
      fishing: "Del 30 de agosto al 14 de mayo y del 16 de junio al 31 de julio",
      tone: "navy",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Consulta informativa"
        title="Vedas"
        subtitle="Calendario orientativo de vedas aplicables en Yucatán para revisar antes de planear una salida."
      />
      <section className="card closures-card">
        <div className="closures-list">
          {seasons.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.species} className={`closure-item ${item.tone}`}>
                <span>
                  <Icon />
                </span>
                <div>
                  <h2>{item.species}</h2>
                  <p>
                    La temporada de <b>veda</b> comprende <strong>{item.closure}</strong>.
                  </p>
                  <p>
                    La temporada de <b>captura</b> comprende{" "}
                    <strong>{item.fishing}</strong>.
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <div className="closures-note">
          <ShieldCheck />
          <p>
            Este módulo es informativo. Verifica siempre avisos vigentes de
            CONAPESCA, DOF y Capitanía de Puerto antes de pescar.
          </p>
        </div>
        <p className="closures-sources">
          Fuentes oficiales:{" "}
          <a
            href="https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5751372"
            target="_blank"
            rel="noreferrer"
          >
            DOF acuerdo de vedas
          </a>
          {" · "}
          <a
            href="https://www.gob.mx/conapesca/articulos/inicia-la-veda-de-todas-las-especies-de-mero-en-el-golfo-de-mexico-233773"
            target="_blank"
            rel="noreferrer"
          >
            CONAPESCA mero
          </a>
          {" · "}
          <a
            href="https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5659177"
            target="_blank"
            rel="noreferrer"
          >
            DOF pulpo
          </a>
          {" · "}
          <a
            href="https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5336757"
            target="_blank"
            rel="noreferrer"
          >
            DOF langosta
          </a>
          {" · "}
          <a
            href="https://www.gob.mx/conapesca/prensa/inicia-veda-de-tiburon-y-raya-a-partir-del-1-de-mayo-271220?idiom=es-MX"
            target="_blank"
            rel="noreferrer"
          >
            CONAPESCA tiburón
          </a>
        </p>
      </section>
    </>
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
        <div className="card chart-card stats-side-card">
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
      <div className="card chart-card stats-chart-card">
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
  requestCrop,
  save,
  saving,
}: {
  data: AppData;
  requestCrop: (task: CropTask) => Promise<File | null>;
  save: (p: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [form, setForm] = useState({ ...data.profile, newEmail: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
          <div className="profile-avatar">
            {form.avatarUrl ? (
              <img
                src={String(form.avatarUrl)}
                alt={form.displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              initials(form.displayName)
            )}
          </div>
          <h2>{form.displayName}</h2>
          <p>{form.email}</p>
          <span className="verified">
            <ShieldCheck size={15} />
            Cuenta verificada
          </span>
          <label className="button secondary small" style={{ margin: "10px auto 0", position: "relative", overflow: "hidden" }}>
            <Camera size={15} />
            {uploadingAvatar ? "Subiendo foto…" : "Subir foto de perfil"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploadingAvatar}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const cropped = await requestCrop({
                  file,
                  title: "Recortar foto de perfil",
                  aspect: 1,
                  outputWidth: 800,
                  outputHeight: 800,
                  round: true,
                });
                if (!cropped) {
                  event.target.value = "";
                  return;
                }
                setUploadingAvatar(true);
                try {
                  const body = new FormData();
                  body.set("file", cropped);
                  body.set("kind", "avatar");
                  const response = await fetch("/api/media", {
                    method: "POST",
                    body,
                  });
                  const payload = (await response.json()) as {
                    error?: string;
                    url?: string;
                  };
                  if (!response.ok || !payload.url)
                    throw new Error(
                      payload.error || "No pudimos subir la foto de perfil.",
                    );
                  const nextForm = {
                    ...form,
                    avatarUrl: payload.url,
                  };
                  setForm((current) => ({
                    ...current,
                    avatarUrl: payload.url,
                  }));
                  await save(nextForm as unknown as Record<string, string>);
                } catch (error) {
                  alert(
                    error instanceof Error
                      ? error.message
                      : "No pudimos subir la foto de perfil.",
                  );
                } finally {
                  setUploadingAvatar(false);
                }
                event.target.value = "";
              }}
            />
          </label>
          <hr />
          <div className="public-link-card">
            <small>Tu perfil público</small>
            <a
              href={`/u/${form.publicSlug || ""}`}
              target="_blank"
              rel="noreferrer"
            >
              {`gofishing.mx/u/${form.publicSlug || "tu-slug"}`}
            </a>
          </div>
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
              label="Nombre visible (Nombre público)"
              value={form.displayName}
              set={(v) => update("displayName", v)}
              required
              wide
            />
            <Field
              label="Nuevo correo"
              value={String(form.newEmail || "")}
              set={(v) => update("newEmail", v)}
              type="email"
              placeholder="nuevo@correo.com"
              wide
            />
            <Field
              label="Link público"
              value={form.publicSlug || ""}
              set={(v) => update("publicSlug", slugInput(v))}
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
            <label className="share-switch wide">
              <div>
                <b>Perfil público</b>
                <small>
                  Si lo activas, otros podrán ver tu ficha pública en
                  {" "}gofishing.mx/u/{form.publicSlug || "tu-slug"}.
                </small>
              </div>
              <button
                type="button"
                className={`toggle-switch ${form.publicProfileEnabled ? "on" : ""}`}
                aria-pressed={Boolean(form.publicProfileEnabled)}
                onClick={() =>
                  setForm({
                    ...form,
                    publicProfileEnabled: !Boolean(form.publicProfileEnabled),
                  })
                }
              >
                <span />
              </button>
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
              GoFishing.mx nunca almacena tu contraseña.
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
  const [overviewList, setOverviewList] = useState<
    "users" | "trips" | "catches" | "media"
  >("users");
  const [selectedAdminUser, setSelectedAdminUser] = useState<Record<string, unknown> | null>(null);
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
        subtitle="Gestiona catálogos y revisa la salud general de GoFishing.mx."
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
            <button className={`card stat-card admin-select ${overviewList === "users" ? "selected" : ""}`} onClick={() => setOverviewList("users")}><span className="stat-icon"><UserRound /></span><div><p>Usuarios</p><strong>{data.adminUsers.length}</strong><small>{data.adminUsers.filter((item) => String(item.status) === "ACTIVE").length} activos</small></div></button>
            <button className={`card stat-card admin-select ${overviewList === "trips" ? "selected" : ""}`} onClick={() => setOverviewList("trips")}><span className="stat-icon"><Ship /></span><div><p>Pescas</p><strong>{data.adminTrips.length}</strong><small>Registros activos</small></div></button>
            <button className={`card stat-card admin-select ${overviewList === "catches" ? "selected" : ""}`} onClick={() => setOverviewList("catches")}><span className="stat-icon"><Fish /></span><div><p>Capturas</p><strong>{data.adminCatches.length}</strong><small>En la plataforma</small></div></button>
            <button className={`card stat-card admin-select ${overviewList === "media" ? "selected" : ""}`} onClick={() => setOverviewList("media")}><span className="stat-icon"><ImageIcon /></span><div><p>Fotografías</p><strong>{data.adminMedia.length}</strong><small>Almacenamiento privado</small></div></button>
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
          <div className="card admin-table">
            <CardTitle
              title={
                overviewList === "users"
                  ? "Usuarios registrados"
                  : overviewList === "trips"
                    ? "Listado de pescas"
                    : overviewList === "catches"
                      ? "Listado de capturas"
                      : "Listado de fotografías"
              }
              subtitle="Desde aquí puedes revisar y moderar contenido o cuentas de la comunidad."
            />
            <div className="table-wrap">
              {overviewList === "users" && (
                <table>
                  <thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th><th>Perfil público</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {data.adminUsers.map((item) => (
                      <tr key={String(item.email)}>
                        <td>{String(item.displayName || item.firstName || item.email)}</td>
                        <td>{String(item.email)}</td>
                        <td>{String(item.status || "ACTIVE")}</td>
                        <td>{item.publicProfileEnabled ? "Activo" : "Oculto"}</td>
                        <td>
                          <div className="trip-actions">
                            <button
                              className="button secondary small"
                              onClick={() => {
                                const reason = window.prompt(
                                  String(item.status) === "ACTIVE"
                                    ? "Motivo para deshabilitar esta cuenta:"
                                    : "Motivo para reactivar esta cuenta:",
                                  "",
                                );
                                if (reason === null) return;
                                void mutate(
                                  {
                                    op: "adminSetUserStatus",
                                    email: item.email,
                                    status: String(item.status) === "ACTIVE" ? "DISABLED" : "ACTIVE",
                                    reason,
                                  },
                                  String(item.status) === "ACTIVE" ? "Cuenta deshabilitada" : "Cuenta reactivada",
                                );
                              }}
                            >
                              {String(item.status) === "ACTIVE" ? "Deshabilitar" : "Reactivar"}
                            </button>
                            <button
                              className="button secondary small"
                              onClick={() => setSelectedAdminUser(item)}
                            >
                              Ver perfil
                            </button>
                            {item.publicSlug ? (
                              <a
                                className="button secondary small"
                                href={`/u/${item.publicSlug || ""}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Ver perfil público de ${String(item.displayName || item.firstName || item.email)}`}
                              >
                                <Eye size={15} />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {overviewList === "trips" && (
                <table>
                  <thead><tr><th>Pesca</th><th>Dueño</th><th>Puerto</th><th>Estado</th><th>Comunidad</th><th>Acción</th></tr></thead>
                  <tbody>
                    {data.adminTrips.map((item) => (
                      <tr key={String(item.id)}>
                        <td>{String(item.title)}</td>
                        <td>{String(item.ownerEmail)}</td>
                        <td>{String(item.port)}</td>
                        <td>{String(item.status)}</td>
                        <td>{item.publicShare ? "Compartida" : "Privada"}</td>
                        <td><button className="button secondary small" onClick={() => { const reason = window.prompt("Motivo para retirar esta pesca:", ""); if (reason === null) return; void mutate({ op: "adminDeleteTrip", id: item.id, reason }, "Pesca retirada"); }}>Retirar pesca</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {overviewList === "catches" && (
                <table>
                  <thead><tr><th>Captura</th><th>Dueño</th><th>Pesca</th><th>Peso</th><th>Acción</th></tr></thead>
                  <tbody>
                    {data.adminCatches.map((item) => (
                      <tr key={String(item.id)}>
                        <td>{String(item.species)}</td>
                        <td>{String(item.ownerEmail)}</td>
                        <td>{String(item.tripId)}</td>
                        <td>{weightLabel(Number(item.weightKg || 0), "kg")}</td>
                        <td><button className="button secondary small" onClick={() => void mutate({ op: "adminDeleteCatch", id: item.id }, "Captura eliminada")}>Eliminar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {overviewList === "media" && (
                <table>
                  <thead><tr><th>Archivo</th><th>Dueño</th><th>Pesca</th><th>Tipo</th><th>Acción</th></tr></thead>
                  <tbody>
                    {data.adminMedia.map((item) => (
                      <tr key={String(item.id)}>
                        <td>{String(item.altText || item.id)}</td>
                        <td>{String(item.ownerEmail)}</td>
                        <td>{String(item.tripId || "—")}</td>
                        <td>{String(item.mimeType || "imagen")}</td>
                        <td><button className="button secondary small" onClick={() => void mutate({ op: "adminDeleteMedia", id: item.id }, "Fotografía eliminada")}>Eliminar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
      {selectedAdminUser && (
        <AdminUserDetailModal
          user={selectedAdminUser}
          close={() => setSelectedAdminUser(null)}
        />
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

function AdminUserDetailModal({
  user,
  close,
}: {
  user: Record<string, unknown>;
  close: () => void;
}) {
  const entries: Array<[string, unknown]> = [
    ["Nombre visible", user.displayName],
    ["Nombre", user.firstName],
    ["Apellidos", user.lastName],
    ["Correo", user.email],
    ["Estado de cuenta", user.status],
    ["Rol", user.role],
    ["Perfil público", user.publicProfileEnabled ? "Activo" : "Oculto"],
    [
      "Link público",
      user.publicSlug ? `/u/${String(user.publicSlug)}` : "No configurado",
    ],
    ["Ciudad", user.city],
    ["Estado", user.state],
    ["País", user.country],
    ["Zona horaria", user.timezone],
    ["Unidad de peso", user.weightUnit],
    ["Avatar", user.avatarUrl ? "Configurado" : "Sin foto"],
    ["Creado", user.createdAt],
    ["Actualizado", user.updatedAt],
  ];
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-user-detail-title"
    >
      <div className="sheet wide-sheet">
        <div className="sheet-head">
          <div>
            <span className="eyebrow">PERFIL INTERNO</span>
            <h2 id="admin-user-detail-title">
              {String(user.displayName || user.firstName || user.email || "Usuario")}
            </h2>
            <p>
              Vista interna del perfil capturado por el usuario. La contraseña
              nunca se muestra aquí.
            </p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="form-grid" style={{ padding: "0 22px 22px" }}>
          {entries.map(([label, value]) => (
            <label key={label}>
              <span className="field-label">{label}</span>
              <input value={String(value || "Sin especificar")} readOnly />
            </label>
          ))}
        </div>
      </div>
    </div>
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
  const [stations, setStations] = useState<
    Array<{
      id: string;
      name: string;
      region: string | null;
      country: string | null;
      distanceKm: number | null;
    }>
  >([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState("");
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
  const loadStations = async () => {
    if (!portId) return;
    setStationsLoading(true);
    setStationsError("");
    try {
      const response = await fetch(
        `/api/weather/locations/${encodeURIComponent(portId)}/stations`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        items?: Array<{
          id: string;
          name: string;
          region: string | null;
          country: string | null;
          distanceKm: number | null;
        }>;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "No pudimos buscar estaciones.");
      setStations(body.items || []);
    } catch (error) {
      setStationsError(
        error instanceof Error ? error.message : "No pudimos buscar estaciones.",
      );
    } finally {
      setStationsLoading(false);
    }
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
          <div className="admin-tide-stations">
            <div className="card-title">
              <div>
                <h3>Estación de mareas</h3>
                <small>
                  Usa solo estaciones verificadas por el servidor para Yucatán.
                </small>
              </div>
            </div>
            <div className="admin-tide-current">
              <small>Actual</small>
              <b>
                {configured.find((port) => port.id === portId)?.tideCheckStationName ||
                  "Sin estación asignada"}
              </b>
              <span>
                {configured.find((port) => port.id === portId)?.stationVerifiedAt
                  ? `Verificada ${formatWeatherTime(String(configured.find((port) => port.id === portId)?.stationVerifiedAt))}`
                  : "Pendiente de verificación"}
              </span>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => void loadStations()}
              >
                {stationsLoading ? "Buscando…" : "Buscar estaciones cercanas"}
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() =>
                  void mutate(
                    { op: "clearTideStation", id: portId },
                    "Estación de mareas eliminada",
                  )
                }
              >
                Quitar estación
              </button>
            </div>
            {stationsError && <p className="test-status">{stationsError}</p>}
            {!!stations.length && (
              <div className="admin-tide-list">
                {stations.map((station) => (
                  <button
                    type="button"
                    key={station.id}
                    className="admin-tide-item"
                    onClick={() =>
                      void mutate(
                        { op: "assignTideStation", id: portId, stationId: station.id },
                        "Estación de mareas verificada",
                      )
                    }
                  >
                    <b>{station.name}</b>
                    <span>
                      {station.region || "Sin región"} · {station.country || "Sin país"}
                    </span>
                    <small>
                      {station.distanceKm == null
                        ? "Distancia no disponible"
                        : `${station.distanceKm.toFixed(1)} km`}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
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
    publicShare: Boolean(item.publicShare),
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
      className="modal-layer mobile-form-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-form-title"
    >
      <div className="sheet wide-sheet mobile-form-sheet">
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
              <span className="field-label">
                Marina o puerto <em>*</em>
              </span>
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
            <label className="share-switch wide">
              <div>
                <b>Compartir a comunidad</b>
                <small>
                  Si la finalizas y activas esta opción, podrá verse en tu
                  perfil público y en la sección Comunidad.
                </small>
              </div>
              <button
                type="button"
                className={`toggle-switch ${form.publicShare ? "on" : ""}`}
                aria-pressed={Boolean(form.publicShare)}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    publicShare: !current.publicShare,
                  }))
                }
              >
                <span />
              </button>
            </label>
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
  requestCrop,
  save,
  close,
  saving,
}: {
  config: { tripId: string; item?: Catch };
  species: CatalogItem[];
  requestCrop: (task: CropTask) => Promise<File | null>;
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
      className="modal-layer mobile-form-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catch-form-title"
    >
      <div className="sheet catch-sheet mobile-form-sheet">
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
                onChange={async (e) => {
                  const image = e.target.files?.[0];
                  if (!image) return;
                  const cropped = await requestCrop({
                    file: image,
                    title: "Recortar foto de captura",
                    aspect: 1,
                    outputWidth: 1200,
                    outputHeight: 1200,
                  });
                  setFile(cropped);
                  e.target.value = "";
                }}
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

function ImageCropModal({
  task,
  cancel,
  confirm,
}: {
  task: CropTask;
  cancel: () => void;
  confirm: (file: File) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const cropWidth = 1000;
  const cropHeight = cropWidth / task.aspect;
  const baseScale = useMemo(
    () => Math.max(cropWidth / dimensions.width, cropHeight / dimensions.height),
    [cropHeight, dimensions.height, dimensions.width],
  );
  const displayWidth = dimensions.width * baseScale * zoom;
  const displayHeight = dimensions.height * baseScale * zoom;
  const maxOffsetX = Math.max(0, (displayWidth - cropWidth) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - cropHeight) / 2);
  const normalizedOffset = {
    x: clamp(offset.x, -maxOffsetX, maxOffsetX),
    y: clamp(offset.y, -maxOffsetY, maxOffsetY),
  };

  useEffect(() => {
    const url = URL.createObjectURL(task.file);
    setPreviewUrl(url);
    const image = new Image();
    image.onload = () => {
      setDimensions({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [task.file]);

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -maxOffsetX, maxOffsetX),
      y: clamp(current.y, -maxOffsetY, maxOffsetY),
    }));
  }, [maxOffsetX, maxOffsetY]);

  return (
    <div
      className="modal-layer cropper-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-title"
    >
      <div className="sheet cropper-sheet">
        <div className="sheet-head">
          <div>
            <span className="eyebrow">AJUSTA TU IMAGEN</span>
            <h2 id="crop-title">{task.title}</h2>
            <p>Mueve y acerca la imagen hasta que el encuadre quede como quieres.</p>
          </div>
          <button className="icon-button" onClick={cancel} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="cropper-layout">
          <div
            className={`cropper-stage ${task.round ? "round" : ""}`}
            style={{ aspectRatio: `${task.aspect}` }}
            onPointerDown={(event) => {
              event.preventDefault();
              (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
              dragState.current = {
                x: event.clientX,
                y: event.clientY,
                startX: normalizedOffset.x,
                startY: normalizedOffset.y,
                pointerId: event.pointerId,
              };
            }}
            onPointerMove={(event) => {
              if (!dragState.current || dragState.current.pointerId !== event.pointerId)
                return;
              event.preventDefault();
              setOffset({
                x: clamp(
                  dragState.current.startX + (event.clientX - dragState.current.x),
                  -maxOffsetX,
                  maxOffsetX,
                ),
                y: clamp(
                  dragState.current.startY + (event.clientY - dragState.current.y),
                  -maxOffsetY,
                  maxOffsetY,
                ),
              });
            }}
            onPointerUp={() => {
              dragState.current = null;
            }}
            onPointerCancel={() => {
              dragState.current = null;
            }}
            onPointerLeave={() => {
              dragState.current = null;
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Vista previa"
                draggable={false}
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) translate(${normalizedOffset.x}px, ${normalizedOffset.y}px)`,
                }}
              />
            ) : null}
            <div className="cropper-frame" />
          </div>
          <div className="cropper-controls">
            <label>
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <div className="cropper-hint">
              <b>Tip</b>
              <p>Arrastra la imagen dentro del recuadro y luego guarda el recorte.</p>
            </div>
          </div>
        </div>
        <div className="sheet-footer">
          <button className="button secondary" type="button" onClick={cancel}>
            Cancelar
          </button>
          <button
            className="button primary"
            type="button"
            onClick={async () => {
              const cropped = await renderCroppedImage(task.file, {
                aspect: task.aspect,
                outputWidth: task.outputWidth,
                outputHeight: task.outputHeight,
                zoom,
                offsetX: normalizedOffset.x,
                offsetY: normalizedOffset.y,
              });
              confirm(cropped);
            }}
          >
            Recortar y guardar
          </button>
        </div>
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
      <span className="field-label">
        {label}
        {required && <em>*</em>}
      </span>
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
  confirmLabel,
  loadingLabel,
  tone = "danger",
}: {
  title: string;
  body: string;
  action: () => void | Promise<void>;
  close: () => void;
  saving: boolean;
  confirmLabel?: string;
  loadingLabel?: string;
  tone?: "danger" | "primary";
}) {
  return (
    <div className="modal-layer" role="alertdialog" aria-modal="true">
      <div className="confirm-box">
        <span className={tone === "primary" ? "danger-icon info" : "danger-icon"}>
          <Trash2 />
        </span>
        <h2>{title}</h2>
        <p>{body}</p>
        <div>
          <button className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button
            className={`button ${tone === "primary" ? "primary" : "danger-fill"}`}
            onClick={() => void action()}
            disabled={saving}
          >
            {saving
              ? loadingLabel || "Procesando…"
              : confirmLabel || "Sí, eliminar"}
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
function tideDateKey(value: string | null) {
  if (!value) return "";
  if (value.includes("T")) return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}
function tideTimeLabel(value: string | null) {
  return value?.includes("T")
    ? `${value.split("T")[1]?.slice(0, 5) || "--:--"} h`
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
