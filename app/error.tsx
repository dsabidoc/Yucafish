"use client";
import { Waves } from "lucide-react";
export default function GlobalError({ reset }: { reset: () => void }) { return <main className="error-screen" id="main-content"><span><Waves /></span><h1>Algo se movió con la marea</h1><p>No pudimos completar esta acción. Tus datos no se perdieron.</p><button className="button primary" onClick={reset}>Intentar nuevamente</button></main>; }
