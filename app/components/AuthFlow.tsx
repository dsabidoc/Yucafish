"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Check, Fish, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";

type Mode = "login" | "register" | "verify" | "forgot" | "reset" | "logout";

const content: Record<Mode, { eyebrow: string; title: string; body: string }> = {
  login: { eyebrow: "BIENVENIDO DE VUELTA", title: "Inicia sesión en YucaFish", body: "Accede a tu bitácora mediante un inicio de sesión administrado y protegido." },
  register: { eyebrow: "CREA TU BITÁCORA", title: "Comienza a guardar tus historias", body: "Tu identidad se verifica con un proveedor seguro. YucaFish nunca almacena tu contraseña." },
  verify: { eyebrow: "VERIFICACIÓN", title: "Verifica tu correo", body: "La verificación se completa dentro del proveedor de acceso seguro. Continúa para revisar el estado de tu cuenta." },
  forgot: { eyebrow: "RECUPERAR ACCESO", title: "Recupera tu cuenta", body: "La recuperación y los enlaces con expiración son administrados por el proveedor de identidad." },
  reset: { eyebrow: "NUEVA CONTRASEÑA", title: "Restablece tu acceso", body: "Por seguridad, el cambio de contraseña ocurre en el proveedor de identidad y no dentro de YucaFish." },
  logout: { eyebrow: "CERRAR SESIÓN", title: "¿Terminaste por hoy?", body: "Cierra tu sesión protegida. Tus pescas y fotografías permanecerán guardadas." },
};

export default function AuthFlow({ mode }: { mode: Mode }) {
  const [accepted, setAccepted] = useState(false);
  const copy = content[mode];
  const isLogout = mode === "logout";
  function proceed(event: FormEvent) { event.preventDefault(); if (mode === "register" && !accepted) return; const local = ["localhost", "127.0.0.1"].includes(window.location.hostname); const destination = isLogout ? (local ? "/" : "/signout-with-chatgpt?return_to=/") : (local ? "/app" : "/signin-with-chatgpt?return_to=/app"); window.location.assign(destination); }

  return <main className="auth-page" id="main-content"><section className="auth-scene"><Link className="brand" href="/"><span className="brand-mark"><Fish size={25} /></span><span><strong>YucaFish</strong><small>Bitácora de pesca</small></span></Link><div><span className="auth-quote">“</span><h2>Cada captura tiene una historia que merece recordarse.</h2><p>Guarda tus salidas, fotografías y récords en un espacio privado.</p></div><small><ShieldCheck size={16} />Acceso cifrado y administrado</small></section><section className="auth-panel"><div className="auth-box"><Link className="back-link" href="/"><ArrowLeft size={17} />Volver al inicio</Link><span className="eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.body}</p><form onSubmit={proceed}>
    {mode === "register" && <><label>Nombre completo<div className="auth-input"><UserRound /><input name="name" autoComplete="name" placeholder="Tu nombre" required /></div></label><label>Correo electrónico<div className="auth-input"><Mail /><input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required /></div></label><label className="check-row"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>Acepto los <Link href="/terminos">términos</Link> y el <Link href="/privacidad">aviso de privacidad</Link>.</span></label></>}
    {mode === "login" && <div className="auth-security"><LockKeyhole /><div><b>Acceso sin contraseñas en YucaFish</b><span>El proveedor verificará tu identidad y correo de forma segura.</span></div></div>}
    {(mode === "verify" || mode === "forgot" || mode === "reset") && <div className="auth-security"><Mail /><div><b>Proceso protegido</b><span>No confirmamos públicamente si un correo pertenece a una cuenta.</span></div></div>}
    <button className="button primary auth-submit" type="submit" disabled={mode === "register" && !accepted}>{isLogout ? "Cerrar sesión" : "Continuar con acceso seguro"}</button>
  </form>{!isLogout && <div className="demo-notice"><Check />En local se usa una cuenta demo; al publicar se activa el proveedor seguro.</div>}{mode === "login" && <div className="auth-links"><Link href="/olvide-mi-contrasena">¿Olvidaste tu acceso?</Link><span>¿No tienes cuenta? <Link href="/registro">Crear cuenta</Link></span></div>}{mode === "register" && <div className="auth-links"><span>¿Ya tienes cuenta? <Link href="/iniciar-sesion">Iniciar sesión</Link></span></div>}</div></section></main>;
}
