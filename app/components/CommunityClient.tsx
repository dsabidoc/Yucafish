"use client";

import { Fish, MapPin, Menu, Share2, Trophy, Waves, Weight } from "lucide-react";
import { useMemo, useState } from "react";

type PublicProfile = {
  displayName: string;
  publicSlug: string;
  avatarUrl?: string | null;
  catchesCount?: number;
  tripsCount?: number;
  topSpecies?: string;
  totalWeight?: number;
  profileOnly?: boolean;
};

type PublicTrip = {
  id: string;
  ownerEmail: string;
  ownerSlug: string;
  ownerName: string;
  title: string;
  port: string;
  coverImageUrl?: string | null;
};

type PublicCatch = {
  id: string;
  tripId: string;
  species: string;
  weightKg: number;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function shareLink(url: string, title: string) {
  if (navigator.share) {
    await navigator.share({ url, title });
    return;
  }
  await navigator.clipboard.writeText(url);
  alert("Enlace copiado para compartir.");
}

export function CommunityClient({
  title,
  subtitle,
  profiles,
  trips,
  catches,
  profileMode = false,
}: {
  title: string;
  subtitle: string;
  profiles: PublicProfile[];
  trips: PublicTrip[];
  catches: PublicCatch[];
  profileMode?: boolean;
}) {
  const [selectedTrip, setSelectedTrip] = useState<PublicTrip | null>(null);
  const featuredProfile = profiles[0];
  const selectedCatches = useMemo(
    () => catches.filter((item) => item.tripId === selectedTrip?.id),
    [catches, selectedTrip],
  );
  const totalWeight = selectedCatches.reduce(
    (sum, item) => sum + Number(item.weightKg || 0),
    0,
  );
  const heaviest = [...selectedCatches].sort((a, b) => b.weightKg - a.weightKg)[0];

  return (
    <main className="landing">
      <div className="landing-nav-shell">
        <div className="landing-nav">
          <a className="brand" href="/">
            <img
              className="brand-logo-full"
              src="/gofishing-logo.svg"
              alt="GoFishing.mx"
            />
          </a>
          <nav>
            <a href="/">Inicio</a>
            <a href="/comunidad">Comunidad</a>
            <a href="/#beneficios">Beneficios</a>
            <a href="/#privacidad">Privacidad</a>
          </nav>
          <div>
            <a className="button secondary" href="/iniciar-sesion">
              Iniciar sesión
            </a>
            <a className="button primary" href="/registro">
              Crear cuenta
            </a>
          </div>
          <details className="landing-mobile-menu">
            <summary aria-label="Abrir menú">
              <Menu size={20} />
            </summary>
            <div>
              <a href="/">Inicio</a>
              <a href="/comunidad">Comunidad</a>
              <a href="/#beneficios">Beneficios</a>
              <a href="/#privacidad">Privacidad</a>
              <a href="/iniciar-sesion">Iniciar sesión</a>
              <a href="/registro">Crear cuenta</a>
            </div>
          </details>
        </div>
      </div>
      <section className="benefits" style={{ paddingTop: 50 }}>
        <div className="section-heading">
          <span className="eyebrow">{profileMode ? "PERFIL DE PESCADOR" : "COMUNIDAD"}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div
          className={profileMode ? "public-profile-hero" : "trip-card-grid community-profiles-grid"}
          style={{ marginBottom: 28 }}
        >
          {profiles.map((profile) => (
            <article
              className={`card ${profileMode ? "public-profile-card" : "trip-card"}`}
              key={profile.publicSlug}
            >
              <div className="trip-card-body" style={{ display: "grid", gap: 14 }}>
                <div className="profile-avatar" style={{ margin: profileMode ? "0" : "0 auto" }}>
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                    />
                  ) : (
                    initials(profile.displayName)
                  )}
                </div>
                <div
                  className={profileMode ? "public-profile-summary" : ""}
                  style={{ textAlign: profileMode ? "left" : "center" }}
                >
                  {profileMode ? (
                    <div className="public-profile-stats">
                      <article className="card stat-card">
                        <span className="stat-icon"><Fish /></span>
                        <div><p>Capturas</p><strong>{profile.catchesCount || 0}</strong></div>
                      </article>
                      <article className="card stat-card">
                        <span className="stat-icon"><Waves /></span>
                        <div><p>Salidas</p><strong>{profile.tripsCount || 0}</strong></div>
                      </article>
                      <article className="card stat-card">
                        <span className="stat-icon"><Trophy /></span>
                        <div><p>Especie top</p><strong>{profile.topSpecies || "Sin registros"}</strong></div>
                      </article>
                      <article className="card stat-card">
                        <span className="stat-icon"><Weight /></span>
                        <div><p>Peso total</p><strong>{(profile.totalWeight || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg</strong></div>
                      </article>
                    </div>
                  ) : (
                    <a href={`/u/${profile.publicSlug}`} className="button secondary small">
                      Ver perfil
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="section-heading" style={{ marginBottom: 26 }}>
          <h2>{profileMode ? "Mis Pescas" : "Pescas compartidas"}</h2>
          <p>
            {profileMode
              ? "Solo se muestran las pescas públicas que este usuario decidió compartir."
              : "Explora las salidas públicas que cada pescador decidió mostrar a la comunidad."}
          </p>
        </div>
        <div className="trip-card-grid community-trip-list">
          {trips.map((trip) => (
            <article className="card trip-card" key={trip.id}>
              <button className="trip-cover community-trip-cover" onClick={() => setSelectedTrip(trip)}>
                {trip.coverImageUrl ? (
                  <img className="community-trip-cover-image" src={trip.coverImageUrl} alt={trip.title} />
                ) : (
                  <span>
                    <Waves />
                    <Fish />
                  </span>
                )}
                <em className="complete">Compartida</em>
              </button>
              <div className="trip-card-body">
                <p className="trip-date">
                  <MapPin size={13} /> {trip.port}
                </p>
                <h2>{trip.title}</h2>
                <p>Por {trip.ownerName}</p>
                <div className="trip-actions">
                  <button className="button secondary" onClick={() => setSelectedTrip(trip)}>
                    Ver detalle
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      void shareLink(
                        `${window.location.origin}/u/${trip.ownerSlug}`,
                        trip.title,
                      )
                    }
                  >
                    <Share2 size={15} />
                    Compartir
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {selectedTrip && (
        <div className="modal-layer" role="dialog" aria-modal="true">
          <div className="sheet" style={{ maxWidth: 760, borderRadius: 18 }}>
            <div className="sheet-head">
              <div>
                <span className="eyebrow">PESCA COMPARTIDA</span>
                <h2>{selectedTrip.title}</h2>
                <p>{selectedTrip.port}</p>
              </div>
              <button className="icon-button" onClick={() => setSelectedTrip(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 18 }}>
              {selectedTrip.coverImageUrl && (
                <div className="community-trip-modal-cover">
                  <img
                    className="community-trip-modal-cover-image"
                    src={selectedTrip.coverImageUrl}
                    alt={selectedTrip.title}
                  />
                </div>
              )}
              <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                <article className="card stat-card"><span className="stat-icon"><Fish /></span><div><p>Capturas</p><strong>{selectedCatches.length}</strong></div></article>
                <article className="card stat-card"><span className="stat-icon"><Weight /></span><div><p>Peso total</p><strong>{totalWeight.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg</strong></div></article>
                <article className="card stat-card"><span className="stat-icon"><Trophy /></span><div><p>Más pesada</p><strong>{heaviest ? `${heaviest.weightKg.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg` : "—"}</strong><small>{heaviest?.species || "Sin dato"}</small></div></article>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="card-title">
                  <div>
                    <h2>Capturas compartidas</h2>
                    <p>Resumen público de esta salida.</p>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      void shareLink(
                        `${window.location.origin}/u/${selectedTrip.ownerSlug}`,
                        selectedTrip.title,
                      )
                    }
                  >
                    <Share2 size={15} />
                    Compartir
                  </button>
                </div>
                <div className="catch-list">
                  {selectedCatches.map((item) => (
                    <div className="catch-row" key={item.id}>
                      <div className="catch-photo"><Fish /></div>
                      <div className="catch-main">
                        <h3>{item.species}</h3>
                        <p>Captura compartida por la comunidad</p>
                      </div>
                      <div className="catch-weight">
                        <strong>{item.weightKg.toLocaleString("es-MX", { maximumFractionDigits: 1 })} kg</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
