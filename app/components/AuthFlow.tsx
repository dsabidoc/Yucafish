"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "logout";

const content: Record<
  Mode,
  { eyebrow: string; title: string; body: string; action: string }
> = {
  login: {
    eyebrow: "BIENVENIDO DE VUELTA",
    title: "Inicia sesión en GoFishing.mx",
    body: "Accede a tu bitácora con tu correo y contraseña.",
    action: "Entrar a mi bitácora",
  },
  register: {
    eyebrow: "CREA TU BITÁCORA",
    title: "Comienza a guardar tus historias",
    body: "Crea tu cuenta para registrar salidas, capturas y fotografías.",
    action: "Crear cuenta",
  },
  verify: {
    eyebrow: "VERIFICACIÓN",
    title: "Confirma tu nuevo correo",
    body: "Valida esta dirección para terminar el cambio de correo de tu cuenta.",
    action: "Confirmar correo",
  },
  forgot: {
    eyebrow: "RECUPERAR ACCESO",
    title: "Recupera tu cuenta",
    body: "Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña.",
    action: "Enviar enlace",
  },
  reset: {
    eyebrow: "NUEVA CONTRASEÑA",
    title: "Crea una nueva contraseña",
    body: "Elige una contraseña nueva para volver a entrar a tu cuenta.",
    action: "Guardar nueva contraseña",
  },
  logout: {
    eyebrow: "CERRAR SESIÓN",
    title: "¿Terminaste por hoy?",
    body: "Cierra tu sesión. Tus pescas y fotografías permanecerán guardadas.",
    action: "Cerrar sesión",
  },
};

export default function AuthFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const copy = content[mode];
  const isLogout = mode === "logout";
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function proceed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "register" && !accepted) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
      if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        setError(
          "Tu contraseña debe tener al menos 8 caracteres, una mayúscula y un número.",
        );
        return;
      }
    }
    const payload =
      mode === "login"
        ? {
            action: "login",
            email: String(formData.get("email") || ""),
            password,
          }
        : mode === "register"
          ? {
              action: "register",
              name: String(formData.get("name") || ""),
              email: String(formData.get("email") || ""),
              password,
            }
          : mode === "forgot"
            ? {
                action: "forgot",
                email: String(formData.get("email") || ""),
              }
            : mode === "reset"
              ? {
                  action: "reset",
                  token: params.get("token") || "",
                  password: String(formData.get("password") || ""),
                }
              : mode === "verify"
                ? {
                    token: params.get("token") || "",
                  }
                : { action: "logout" };

    setSaving(true);
    try {
      const response =
        mode === "verify"
          ? await fetch("/api/auth/email/confirm", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/auth/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload),
            });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "No pudimos procesar el acceso.");
      router.push(
        mode === "forgot" || mode === "reset" || mode === "verify"
          ? "/iniciar-sesion"
          : isLogout
            ? "/"
            : "/app",
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos procesar el acceso.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page" id="main-content">
      <section className="auth-scene">
        <Link className="brand" href="/">
          <img
            className="brand-logo-full"
            src="/gofishing-logo.svg"
            alt="GoFishing.mx"
          />
        </Link>
        <div>
          <span className="auth-quote">“</span>
          <h2>Cada captura tiene una historia que merece recordarse.</h2>
          <p>Guarda tus salidas, fotografías y récords en un espacio privado.</p>
        </div>
        <small>
          <ShieldCheck size={16} />
          Acceso protegido con sesión segura
        </small>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            Volver al inicio
          </Link>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <form onSubmit={proceed}>
            {mode === "register" && (
              <>
                <label>
                  Nombre completo
                  <div className="auth-input">
                    <UserRound />
                    <input
                      name="name"
                      autoComplete="name"
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                </label>
                <label>
                  Correo electrónico
                  <div className="auth-input">
                    <Mail />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      required
                    />
                  </div>
                </label>
                <label>
                  Contraseña
                  <div className="auth-input">
                    <LockKeyhole />
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      required
                    />
                  </div>
                </label>
                <label>
                  Confirmar contraseña
                  <div className="auth-input">
                    <LockKeyhole />
                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repite tu contraseña"
                      minLength={8}
                      required
                    />
                  </div>
                </label>
                <div className="password-guidelines">
                  <b>Tu contraseña debe incluir:</b>
                  <ul>
                    <li>Al menos 8 caracteres</li>
                    <li>1 letra mayúscula</li>
                    <li>1 número</li>
                  </ul>
                </div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    Acepto los <Link href="/terminos">términos</Link> y el{" "}
                    <Link href="/privacidad">aviso de privacidad</Link>.
                  </span>
                </label>
              </>
            )}
            {mode === "login" && (
              <>
                <label>
                  Correo electrónico
                  <div className="auth-input">
                    <Mail />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      required
                    />
                  </div>
                </label>
                <label>
                  Contraseña
                  <div className="auth-input">
                    <LockKeyhole />
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Tu contraseña"
                      minLength={8}
                      required
                    />
                  </div>
                </label>
              </>
            )}
            {mode === "forgot" && (
              <label>
                Correo electrónico
                <div className="auth-input">
                  <Mail />
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    required
                  />
                </div>
              </label>
            )}
            {mode === "reset" && (
              <label>
                Nueva contraseña
                <div className="auth-input">
                  <LockKeyhole />
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    required
                  />
                </div>
              </label>
            )}
            {(mode === "verify" || mode === "forgot" || mode === "reset") && (
              <div className="auth-security">
                <Mail />
                <div>
                  <b>
                    {mode === "verify"
                      ? "Confirmación requerida"
                      : mode === "forgot"
                        ? "Correo de recuperación"
                        : "Contraseña nueva"}
                  </b>
                  <span>
                    {mode === "verify"
                      ? "Usaremos este enlace para confirmar el cambio de correo."
                      : mode === "forgot"
                        ? "Si la cuenta existe, enviaremos el enlace de recuperación."
                        : "Después de guardar la nueva contraseña podrás iniciar sesión normalmente."}
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                <ShieldCheck size={16} />
                {error}
              </div>
            )}
            {(mode !== "verify" || Boolean(params.get("token"))) && (
              <button
                className="button primary auth-submit"
                type="submit"
                disabled={saving || (mode === "register" && !accepted)}
              >
                {saving ? "Procesando…" : copy.action}
              </button>
            )}
          </form>
          {!isLogout && mode !== "forgot" && mode !== "reset" && mode !== "verify" && (
            <div className="demo-notice">
              <Check />
              Acceso seguro para tu bitácora personal.
            </div>
          )}
          {mode === "login" && (
            <div className="auth-links">
              <Link href="/olvide-mi-contrasena">¿Olvidaste tu acceso?</Link>
              <span>
                ¿No tienes cuenta? <Link href="/registro">Crear cuenta</Link>
              </span>
            </div>
          )}
          {mode === "register" && (
            <div className="auth-links">
              <span>
                ¿Ya tienes cuenta?{" "}
                <Link href="/iniciar-sesion">Iniciar sesión</Link>
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
